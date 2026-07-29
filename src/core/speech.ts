import type {
  SpeechContent,
  SpeechPlaybackResult,
  SpeechSettings,
  SupportedLanguage,
} from './types';

const LOCALES: Record<SupportedLanguage, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
};

function splitSpeechText(text: string, maximumLength = 220): string[] {
  const sentences = text
    .split(/(?<=[。！？.!?；;])\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks: string[] = [];

  for (const sentence of sentences.length > 0 ? sentences : [text]) {
    if (sentence.length <= maximumLength) {
      chunks.push(sentence);
      continue;
    }

    // Long sentences are cut at punctuation or whitespace before using a hard boundary.
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
    if (remaining) chunks.push(remaining);
  }

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
  private activeAudio: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;

  cancel(): void {
    this.generation += 1;
    window.speechSynthesis.cancel();

    if (this.activeSynthesizer) {
      this.activeSynthesizer.close();
      this.activeSynthesizer = null;
    }
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.src = '';
      this.activeAudio = null;
    }
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
  }

  async speak(
    content: SpeechContent,
    settings: SpeechSettings,
    azureKey: string,
  ): Promise<SpeechPlaybackResult> {
    this.cancel();
    const currentGeneration = this.generation;

    if (settings.provider === 'azure') {
      if (!azureKey || !settings.azureRegion.trim()) {
        const reason = 'Azure Speech key or region is missing.';
        if (!settings.fallbackToBrowser) throw new Error(reason);
        await this.speakWithBrowser(content, settings, currentGeneration);
        return { provider: 'browser', fallbackReason: reason };
      }

      try {
        await this.speakWithAzure(content, settings, azureKey, currentGeneration);
        return { provider: 'azure' };
      } catch (error) {
        this.cleanupAzureAudio();
        if (!settings.fallbackToBrowser || currentGeneration !== this.generation) throw error;
        const reason = error instanceof Error ? error.message : 'Azure Speech failed.';
        await this.speakWithBrowser(content, settings, currentGeneration);
        return { provider: 'browser', fallbackReason: reason };
      }
    }

    await this.speakWithBrowser(content, settings, currentGeneration);
    return { provider: 'browser' };
  }

  private async speakWithBrowser(
    content: SpeechContent,
    settings: SpeechSettings,
    generation: number,
  ): Promise<void> {
    const voices = await waitForBrowserVoices();
    const voice = chooseBrowserVoice(voices, content.language, settings.browserVoices[content.language]);

    for (const chunk of splitSpeechText(content.text)) {
      if (generation !== this.generation) return;
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = LOCALES[content.language];
        utterance.voice = voice ?? null;
        utterance.rate = settings.rate;
        utterance.volume = settings.volume;
        utterance.pitch = 1;
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
  ): Promise<void> {
    // Azure is a large optional dependency. Dynamic import keeps normal browser-voice cards fast.
    const SpeechSDK = await import('microsoft-cognitiveservices-speech-sdk');
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(azureKey, settings.azureRegion.trim());
    speechConfig.speechSynthesisVoiceName = settings.azureVoices[content.language];
    speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

    for (const chunk of splitSpeechText(content.text, 450)) {
      if (generation !== this.generation) return;
      // Passing null disables the SDK's default-speaker output. The plugin
      // plays result.audioData itself so volume, cancellation, and cleanup have
      // one owner and Azure speech is never heard twice.
      const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null);
      this.activeSynthesizer = synthesizer;

      const ssml = [
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${LOCALES[content.language]}">`,
        `<voice name="${escapeXml(settings.azureVoices[content.language])}">`,
        `<prosody rate="${rateAsSsmlPercent(settings.rate)}">${escapeXml(chunk)}</prosody>`,
        '</voice>',
        '</speak>',
      ].join('');

      const audioData = await new Promise<ArrayBuffer>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            synthesizer.close();
            this.activeSynthesizer = null;
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              resolve(result.audioData);
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
      await this.playAzureAudio(audioData, settings.volume, generation);
    }
  }

  private async playAzureAudio(audioData: ArrayBuffer, volume: number, generation: number): Promise<void> {
    this.cleanupAzureAudio();
    const objectUrl = URL.createObjectURL(new Blob([audioData], { type: 'audio/mpeg' }));
    const audio = new Audio(objectUrl);
    audio.volume = volume;
    this.activeAudio = audio;
    this.activeObjectUrl = objectUrl;

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Chrome could not play the Azure audio response.'));
      audio.play().catch((error) => reject(error));
    });

    if (generation === this.generation) this.cleanupAzureAudio();
  }

  private cleanupAzureAudio(): void {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.src = '';
      this.activeAudio = null;
    }
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
  }
}

export function getAvailableBrowserVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}
