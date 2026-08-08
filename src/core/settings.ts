import type { RNPlugin } from '@remnote/plugin-sdk';
import type { SpeechSettings, SupportedLanguage } from './types';
import { readNativeSettings } from './nativeSettings';
import { DEFAULT_EDGE_LOCAL_URL, normalizeEdgeLocalUrl } from './edgeLocalClient';

export const SETTINGS_STORAGE_KEY = 'card-speech-settings-v1';
export const AZURE_KEY_STORAGE_KEY = 'card-speech-azure-key-v1';
export const DEFAULT_SETTINGS: SpeechSettings = {
  uiLanguage: 'en',
  enabled: true,
  autoReadQuestion: true,
  autoReadAnswer: true,
  provider: 'browser',
  fallbackToBrowser: true,
  defaultLanguage: 'zh',
  rate: 0.9,
  volume: 1,
  browserVoices: {
    zh: '',
    en: '',
    ja: '',
  },
  azureRegion: '',
  azureVoices: {
    zh: 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural',
    en: 'en-US-Jenny:DragonHDLatestNeural',
    ja: 'ja-JP-Nanami:DragonHDLatestNeural',
  },
  edgeServerUrl: DEFAULT_EDGE_LOCAL_URL,
  edgeVoices: {
    zh: 'zh-CN-XiaoxiaoNeural',
    en: 'en-US-AriaNeural',
    ja: 'ja-JP-NanamiNeural',
  },
  clozeWords: {
    zh: '什么',
    en: 'what',
    ja: 'なに',
  },
};

const LANGUAGES: SupportedLanguage[] = ['zh', 'en', 'ja'];

function clamp(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

/**
 * Normalizes saved settings so an older or partially corrupted value cannot break speech.
 */
export function normalizeSettings(saved?: Partial<SpeechSettings> | null): SpeechSettings {
  const uiLanguage = saved?.uiLanguage === 'zh' ? 'zh' : 'en';
  const provider =
    saved?.provider === 'azure' || saved?.provider === 'edge-local'
      ? saved.provider
      : 'browser';
  const defaultLanguage = LANGUAGES.includes(saved?.defaultLanguage as SupportedLanguage)
    ? (saved?.defaultLanguage as SupportedLanguage)
    : DEFAULT_SETTINGS.defaultLanguage;
  const savedAzureVoices = saved?.azureVoices;
  // Preserve every valid Azure catalog choice, including Standard Neural and
  // preview models. Defaults are used only when no voice was saved.
  const normalizeAzureVoice = (language: SupportedLanguage): string =>
    savedAzureVoices?.[language]?.trim() || DEFAULT_SETTINGS.azureVoices[language];
  const normalizedAzureVoices: SpeechSettings['azureVoices'] = {
    zh: normalizeAzureVoice('zh'),
    en: normalizeAzureVoice('en'),
    ja: normalizeAzureVoice('ja'),
  };
  const savedEdgeVoices = saved?.edgeVoices;
  const normalizeEdgeVoice = (language: SupportedLanguage): string =>
    savedEdgeVoices?.[language]?.trim() || DEFAULT_SETTINGS.edgeVoices[language];
  const normalizedEdgeVoices: SpeechSettings['edgeVoices'] = {
    zh: normalizeEdgeVoice('zh'),
    en: normalizeEdgeVoice('en'),
    ja: normalizeEdgeVoice('ja'),
  };
  const edgeServerUrl = normalizeEdgeLocalUrl(
    saved?.edgeServerUrl?.trim() || DEFAULT_SETTINGS.edgeServerUrl,
  );

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    uiLanguage,
    provider,
    defaultLanguage,
    autoReadQuestion: saved?.autoReadQuestion ?? DEFAULT_SETTINGS.autoReadQuestion,
    autoReadAnswer: saved?.autoReadAnswer ?? DEFAULT_SETTINGS.autoReadAnswer,
    rate: clamp(saved?.rate, 0.5, 2, DEFAULT_SETTINGS.rate),
    volume: clamp(saved?.volume, 0, 1, DEFAULT_SETTINGS.volume),
    browserVoices: {
      ...DEFAULT_SETTINGS.browserVoices,
      ...saved?.browserVoices,
    },
    azureVoices: {
      ...normalizedAzureVoices,
    },
    edgeServerUrl,
    edgeVoices: {
      ...normalizedEdgeVoices,
    },
    clozeWords: {
      ...DEFAULT_SETTINGS.clozeWords,
      ...saved?.clozeWords,
    },
  };
}

export async function readSettings(plugin: RNPlugin): Promise<SpeechSettings> {
  try {
    const [saved, nativeSettings] = await Promise.all([
      plugin.storage.getSynced<Partial<SpeechSettings>>(SETTINGS_STORAGE_KEY),
      readNativeSettings(plugin),
    ]);
    return normalizeSettings({ ...saved, ...nativeSettings });
  } catch (error) {
    console.error('RemNote Smart TTS could not read settings.', error);
    return DEFAULT_SETTINGS;
  }
}

export async function writeSettings(plugin: RNPlugin, settings: SpeechSettings): Promise<void> {
  await plugin.storage.setSynced(SETTINGS_STORAGE_KEY, normalizeSettings(settings));
}

export async function readAzureKey(plugin: RNPlugin): Promise<string> {
  try {
    return (await plugin.storage.getLocal<string>(AZURE_KEY_STORAGE_KEY))?.trim() ?? '';
  } catch (error) {
    console.error('RemNote Smart TTS could not read the local Azure key.', error);
    return '';
  }
}

export async function writeAzureKey(plugin: RNPlugin, key: string): Promise<void> {
  // The subscription key intentionally uses local storage, never synced storage.
  await plugin.storage.setLocal(AZURE_KEY_STORAGE_KEY, key.trim());
}
