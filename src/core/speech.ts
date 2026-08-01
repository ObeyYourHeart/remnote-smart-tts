import type {
  SpeechContent,
  SpeechPlaybackCallbacks,
  SpeechPlaybackResult,
  SpeechSettings,
  SupportedLanguage,
} from './types';

type AzureSpeechSdk = typeof import('microsoft-cognitiveservices-speech-sdk');

let azureSpeechSdkPromise: Promise<AzureSpeechSdk> | null = null;

/**
 * Starts loading the optional Azure SDK before the first synthesis request.
 * This removes module download and parsing time from the first card playback.
 */
export function preloadAzureSpeechSdk(): Promise<AzureSpeechSdk> {
  if (!azureSpeechSdkPromise) {
    azureSpeechSdkPromise = import('microsoft-cognitiveservices-speech-sdk');
  }
  return azureSpeechSdkPromise;
}

const LOCALES: Record<SupportedLanguage, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
};

export function splitSpeechText(text: string, maximumLength = 220): string[] {
  const sentences = text
    .split(/(?<=[。！？.!?；;])\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = '';

  const flushCurrentChunk = () => {
    if (!currentChunk) return;
    chunks.push(currentChunk);
    currentChunk = '';
  };

  for (const sentence of sentences.length > 0 ? sentences : [text]) {
    if (sentence.length <= maximumLength) {
      const combined = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      if (combined.length <= maximumLength) {
        currentChunk = combined;
      } else {
        flushCurrentChunk();
        currentChunk = sentence;
      }
      continue;
    }

    // Long sentences are cut at punctuation or whitespace before using a hard boundary.
    flushCurrentChunk();
    let remaining = sentence;
    while (remaining.length > maximumLength) {
      const candidate = remaining.slice(0, maximumLength);
      const breakIndex = Math.max(
        candidate.lastIndexOf('，'),
        candidate.lastIndexOf(','),
        candidate.lastIndexOf(' '),
      );
      const safeIndex = breakIndex > maximumLength * 0.45 ? breakIndex + 1 : maximumLength;
      chunks.push(remaining.slice(0, safeIndex).trim());
      remaining = remaining.slice(safeIndex).trim();
    }
    if (remaining) currentChunk = remaining;
  }

  flushCurrentChunk();
  return chunks;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rateAsSsmlPercent(rate: number): string {
  const percentage = Math.round((rate - 1) * 100);
  return `${percentage >= 0 ? '+' : ''}${percentage}%`;
}

async function waitForBrowserVoices(): Promise<SpeechSynthesisVoice[]> {
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return existing;

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    }, 1200);

    const handleVoicesChanged = () => {
      window.clearTimeout(timeoutId);
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
  });
}

function chooseBrowserVoice(
  voices: SpeechSynthesisVoice[],
  language: SupportedLanguage,
  selectedName: string,
): SpeechSynthesisVoice | undefined {
  if (selectedName) {
    const exact = voices.find((voice) => voice.name === selectedName);
    if (exact) return exact;
  }

  const localePrefix = LOCALES[language].split('-')[0].toLowerCase();
  const matching = voices.filter((voice) => voice.lang.toLowerCase().startsWith(localePrefix));
  return (
    matching.find((voice) => /natural|neural|online/i.test(voice.name)) ??
    matching.find((voice) => /microsoft|google/i.test(voice.name)) ??
    matching[0]
  );
}

/**
 * Owns all active audio so moving to another card can reliably stop the previous card.
 */
export class SpeechController {
  private generation = 0;
  private activeSynthesizer: import('microsoft-cognitiveservices-speech-sdk').SpeechSynthesizer | null = null;
  private activePlayer: import('microsoft-cognitiveservices-speech-sdk').SpeakerAudioDestination | null = null;

  cancel(): void {
    this.generation += 1;
    window.speechSynthesis.cancel();

    if (this.activeSynthesizer) {
      this.activeSynthesizer.close();
      this.activeSynthesizer = null;
    }
    if (this.activePlayer) {
      this.activePlayer.pause();
      this.activePlayer.close();
      this.activePlayer = null;
    }
  }

  async speak(
    content: SpeechContent,
    settings: SpeechSettings,
    azureKey: string,
    callbacks: SpeechPlaybackCallbacks = {},
  ): Promise<SpeechPlaybackResult> {
    this.cancel();
    const currentGeneration = this.generation;

    if (settings.provider === 'azure') {
      if (!azureKey || !settings.azureRegion.trim()) {
        const reason = 'Azure Speech key or region is missing.';
        if (!settings.fallbackToBrowser) throw new Error(reason);
        await this.speakWithBrowser(content, settings, currentGeneration, callbacks);
        return { provider: 'browser', fallbackReason: reason };
      }

      try {
        await this.speakWithAzure(content, settings, azureKey, currentGeneration, callbacks);
        return { provider: 'azure' };
      } catch (error) {
        this.cleanupAzureAudio();
        const blockedByChrome = error instanceof Error && error.message.startsWith('Chrome blocked autoplay');
        // Browser speech is blocked by the same RemNote iframe policy. Keep the
        // precise Azure message instead of failing a second time with a vague
        // browser `not-allowed` error.
        if (blockedByChrome) throw error;
        if (!settings.fallbackToBrowser || currentGeneration !== this.generation) throw error;
        const reason = error instanceof Error ? error.message : 'Azure Speech failed.';
        await this.speakWithBrowser(content, settings, currentGeneration, callbacks);
        return { provider: 'browser', fallbackReason: reason };
      }
    }

    await this.speakWithBrowser(content, settings, currentGeneration, callbacks);
    return { provider: 'browser' };
  }

  private async speakWithBrowser(
    content: SpeechContent,
    settings: SpeechSettings,
    generation: number,
    callbacks: SpeechPlaybackCallbacks,
  ): Promise<void> {
    const voices = await waitForBrowserVoices();
    const voice = chooseBrowserVoice(voices, content.language, settings.browserVoices[content.language]);

    const semanticSegments = content.segments?.map((segment) => segment.trim()).filter(Boolean);
    const chunks = semanticSegments?.length
      ? semanticSegments.flatMap((segment) => splitSpeechText(segment))
      : splitSpeechText(content.text);

    for (const chunk of chunks) {
      if (generation !== this.generation) return;
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = LOCALES[content.language];
        utterance.voice = voice ?? null;
        utterance.rate = settings.rate;
        utterance.volume = settings.volume;
        utterance.pitch = 1;
        utterance.onstart = () => callbacks.onPlaybackStart?.();
        utterance.onend = () => resolve();
        utterance.onerror = (event) => {
          if (event.error === 'canceled' || event.error === 'interrupted') resolve();
          else reject(new Error(`Browser speech failed: ${event.error}`));
        };
        window.speechSynthesis.speak(utterance);
      });
    }
  }

  private async speakWithAzure(
    content: SpeechContent,
    settings: SpeechSettings,
    azureKey: string,
    generation: number,
    callbacks: SpeechPlaybackCallbacks,
  ): Promise<void> {
    // Reuse the module promise started while the card was being inspected.
    const SpeechSDK = await preloadAzureSpeechSdk();
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(azureKey, settings.azureRegion.trim());
    speechConfig.speechSynthesisVoiceName = settings.azureVoices[content.language];
    speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

    const semanticSegments = content.segments?.map((segment) => segment.trim()).filter(Boolean);
    const azurePayloads = semanticSegments?.length
      ? [{ segments: semanticSegments }]
      : splitSpeechText(content.text, 450).map((text) => ({ text }));

    for (const payload of azurePayloads) {
      if (generation !== this.generation) return;
      // A single explicit SDK player avoids both double playback and a second
      // independent audio element, which previously caused echo. We still
      // observe the SDK's own element so blocked autoplay is never reported as
      // successful playback.
      const player = new SpeechSDK.SpeakerAudioDestination();
      let markPlaybackStarted: () => void = () => undefined;
      let markPlaybackBlocked: (error: Error) => void = () => undefined;
      const playbackStarted = new Promise<void>((resolve, reject) => {
        markPlaybackStarted = resolve;
        markPlaybackBlocked = reject;
      });
      // The rejection is awaited after synthesis completes. Attach a handler
      // immediately so a fast browser rejection is not treated as unhandled.
      void playbackStarted.catch(() => undefined);

      let markPlaybackFinished: () => void = () => undefined;
      let markPlaybackFailed: (error: Error) => void = () => undefined;
      let playbackSettled = false;
      const playbackFinished = new Promise<void>((resolve, reject) => {
        markPlaybackFinished = () => {
          if (playbackSettled) return;
          playbackSettled = true;
          resolve();
        };
        markPlaybackFailed = (error) => {
          if (playbackSettled) return;
          playbackSettled = true;
          reject(error);
        };
      });
      // A playback error may arrive before synthesis has completed. Attach a
      // handler immediately and await the same promise below.
      void playbackFinished.catch(() => undefined);
      player.onAudioEnd = () => markPlaybackFinished();
      player.onAudioStart = () => {
        const audio = player.internalAudio;
        if (!audio) {
          const error = new Error('Azure created no playable audio element.');
          markPlaybackBlocked(error);
          markPlaybackFailed(error);
          return;
        }

        // Some NeuralHD voices do not consistently trigger the SDK player's
        // onAudioEnd callback. The underlying HTML audio element still reports
        // its lifecycle, so use it as an additional completion/error signal.
        audio.addEventListener('ended', markPlaybackFinished, { once: true });
        audio.addEventListener('error', () => {
          markPlaybackFailed(new Error('Azure audio playback failed.'));
        }, { once: true });

        // The SDK creates its audio element only after the format is known, so
        // volume must be applied here rather than immediately after construction.
        audio.volume = settings.volume;
        audio.muted = false;
        void audio.play().then(
          () => {
            callbacks.onPlaybackStart?.();
            markPlaybackStarted();
          },
          () => {
            const error = new Error(
              'Chrome blocked autoplay / Chrome 阻止了自动播放，请点击扬声器按钮启用声音。',
            );
            markPlaybackBlocked(error);
            markPlaybackFailed(error);
          },
        );
      };
      const audioConfig = SpeechSDK.AudioConfig.fromSpeakerOutput(player);
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
      this.activeSynthesizer = synthesizer;
      this.activePlayer = player;

      const spokenBody = 'segments' in payload
        ? payload.segments
          .map((segment) => [
            '<s>',
            `<prosody rate="${rateAsSsmlPercent(settings.rate)}">${escapeXml(segment)}</prosody>`,
            '</s>',
          ].join(''))
          .join('<break time="220ms"/>')
        : `<prosody rate="${rateAsSsmlPercent(settings.rate)}">${escapeXml(payload.text)}</prosody>`;
      const ssml = [
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${LOCALES[content.language]}">`,
        `<voice name="${escapeXml(settings.azureVoices[content.language])}">`,
        spokenBody,
        '</voice>',
        '</speak>',
      ].join('');

      await new Promise<void>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            synthesizer.close();
            this.activeSynthesizer = null;
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              resolve();
            } else {
              reject(new Error(result.errorDetails || 'Azure Speech did not return audio.'));
            }
          },
          (error) => {
            synthesizer.close();
            this.activeSynthesizer = null;
            reject(new Error(String(error)));
          },
        );
      });

      if (generation !== this.generation) return;
      await playbackStarted;
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(
          () => reject(new Error('Azure audio playback timed out.')),
          90_000,
        );
        void playbackFinished.then(
          () => {
            window.clearTimeout(timeoutId);
            resolve();
          },
          (error) => {
            window.clearTimeout(timeoutId);
            reject(error);
          },
        );
      });
      if (generation !== this.generation) return;
      this.activePlayer = null;
    }
  }

  private cleanupAzureAudio(): void {
    if (this.activePlayer) {
      this.activePlayer.pause();
      this.activePlayer.close();
      this.activePlayer = null;
    }
  }
}

export function getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}
