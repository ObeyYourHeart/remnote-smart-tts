import { AzureMp3StreamPlayer } from './azureStreamPlayer';
import type {
  SpeechContent,
  SpeechPlaybackCallbacks,
  SpeechPlaybackResult,
  SpeechSegment,
  SpeechSettings,
  SupportedLanguage,
} from './types';

type AzureSpeechSdk = typeof import('microsoft-cognitiveservices-speech-sdk');

interface AzureSpeechSession {
  key: string;
  region: string;
  synthesizer: import('microsoft-cognitiveservices-speech-sdk').SpeechSynthesizer;
}

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

function normalizeSpeechSegments(content: SpeechContent): SpeechSegment[] {
  return (content.segments ?? [])
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => Boolean(segment.text));
}

/**
 * Builds one Azure request that can switch voices between semantic segments.
 * Keeping all voices in one SSML document avoids a network round-trip at each
 * language boundary.
 */
export function buildAzureSsml(content: SpeechContent, settings: SpeechSettings): string {
  const semanticSegments = normalizeSpeechSegments(content);
  const rate = rateAsSsmlPercent(settings.rate);
  const spokenBody = semanticSegments.length > 0
    ? semanticSegments
      .map((segment) => [
        `<voice name="${escapeXml(settings.azureVoices[segment.language])}">`,
        '<s>',
        `<prosody rate="${rate}">${escapeXml(segment.text)}</prosody>`,
        '</s>',
        '</voice>',
      ].join(''))
      .join('<break time="220ms"/>')
    : [
      `<voice name="${escapeXml(settings.azureVoices[content.language])}">`,
      `<prosody rate="${rate}">${escapeXml(content.text)}</prosody>`,
      '</voice>',
    ].join('');

  return [
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${LOCALES[content.language]}">`,
    spokenBody,
    '</speak>',
  ].join('');
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
  private azureSession: AzureSpeechSession | null = null;
  private azureSessionBusy = false;
  private activeAzurePlayer: AzureMp3StreamPlayer | null = null;

  cancel(): void {
    this.generation += 1;
    window.speechSynthesis.cancel();

    // A completed Azure session stays alive so the next card can reuse its
    // WebSocket. An in-flight session is disposed because starting a second
    // synthesis while cancellation is settling can corrupt the SDK player.
    if (this.azureSessionBusy) this.disposeAzureSession();
  }

  /** Fully releases the Azure connection when the queue is finished. */
  dispose(): void {
    this.generation += 1;
    window.speechSynthesis.cancel();
    this.disposeAzureSession();
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
        this.disposeAzureSession();
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
    const semanticSegments = normalizeSpeechSegments(content);
    const sources = semanticSegments.length > 0
      ? semanticSegments
      : [{ text: content.text, language: content.language }];
    const chunks = sources.flatMap((segment) =>
      splitSpeechText(segment.text).map((text) => ({ text, language: segment.language })),
    );

    for (const chunk of chunks) {
      if (generation !== this.generation) return;
      const voice = chooseBrowserVoice(
        voices,
        chunk.language,
        settings.browserVoices[chunk.language],
      );
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(chunk.text);
        utterance.lang = LOCALES[chunk.language];
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
    const region = settings.azureRegion.trim();
    const session = this.getOrCreateAzureSession(SpeechSDK, azureKey, region);
    const { synthesizer } = session;

    const semanticSegments = normalizeSpeechSegments(content);
    const azurePayloads: SpeechContent[] = semanticSegments.length > 0
      ? [{ ...content, segments: semanticSegments }]
      : splitSpeechText(content.text, 450).map((text) => ({
        text,
        language: content.language,
      }));

    this.azureSessionBusy = true;
    try {
      for (const payload of azurePayloads) {
        if (generation !== this.generation) return;
        // Each request gets a fresh player while the synthesizer and its
        // WebSocket remain reusable. Azure pushes compressed MP3 chunks into
        // this callback as soon as they arrive.
        const streamPlayer = new AzureMp3StreamPlayer(settings.volume, callbacks.onPlaybackStart);
        this.activeAzurePlayer = streamPlayer;
        const outputCallback = new class extends SpeechSDK.PushAudioOutputStreamCallback {
          write(dataBuffer: ArrayBuffer): void {
            streamPlayer.write(dataBuffer);
          }

          close(): void {
            streamPlayer.closeStream();
          }
        }();
      const ssml = buildAzureSsml(payload, settings);

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (operation: () => void) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(synthesisTimeoutId);
          operation();
        };
        const synthesisTimeoutId = window.setTimeout(() => {
          this.disposeAzureSession();
          finish(() => reject(new Error('Azure speech synthesis timed out.')));
        }, 15_000);

        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              finish(resolve);
            } else {
              finish(() => reject(new Error(result.errorDetails || 'Azure Speech did not return audio.')));
            }
          },
          (error) => {
            finish(() => reject(new Error(String(error))));
          },
          outputCallback,
        );
      });

      if (generation !== this.generation) return;
      await streamPlayer.playbackStarted;
      await new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(
          () => reject(new Error('Azure audio playback timed out.')),
          90_000,
        );
        void streamPlayer.playbackFinished.then(
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
      streamPlayer.dispose();
      if (this.activeAzurePlayer === streamPlayer) this.activeAzurePlayer = null;
      }
    } finally {
      this.azureSessionBusy = false;
    }
  }

  private getOrCreateAzureSession(
    SpeechSDK: AzureSpeechSdk,
    key: string,
    region: string,
  ): AzureSpeechSession {
    if (this.azureSession?.key === key && this.azureSession.region === region) {
      return this.azureSession;
    }

    this.disposeAzureSession();
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
    // Compressed 24 kHz MP3 is small enough for short flashcards without
    // sacrificing the clarity of Chinese, English, or Japanese speech.
    speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
    // A null AudioConfig prevents the SDK from creating its own one-shot audio
    // element. Each request supplies a fresh streaming callback instead.
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null);
    this.azureSession = { key, region, synthesizer };
    return this.azureSession;
  }

  private disposeAzureSession(): void {
    this.activeAzurePlayer?.dispose();
    this.activeAzurePlayer = null;
    if (!this.azureSession) return;
    this.azureSession.synthesizer.close();
    this.azureSession = null;
    this.azureSessionBusy = false;
  }

}

export function getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}
