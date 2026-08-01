import type { SupportedLanguage } from './types';

const LANGUAGE_BY_LOCALE: Record<string, SupportedLanguage> = {
  'zh-CN': 'zh',
  'en-US': 'en',
  'ja-JP': 'ja',
};

export interface AzureVoice {
  shortName: string;
  displayName: string;
  localName: string;
  gender: string;
  locale: string;
  localeName: string;
  voiceType: string;
  status: string;
  styles: string[];
  secondaryLocales: string[];
}

export type AzureVoiceCatalog = Record<SupportedLanguage, AzureVoice[]>;

export const CURATED_AZURE_VOICES: Record<SupportedLanguage, AzureVoice[]> = {
  zh: [
    createPreset('zh-CN-Xiaoxiao:DragonHDFlashLatestNeural', 'Xiaoxiao Dragon HD Flash Latest', '晓晓 Dragon HD Flash Latest', 'Female', 'zh-CN'),
    createPreset('zh-CN-Xiaochen:DragonHDLatestNeural', 'Xiaochen Dragon HD Latest', '晓辰 Dragon HD Latest', 'Female', 'zh-CN'),
    createPreset('zh-CN-Yunfan:DragonHDLatestNeural', 'Yunfan Dragon HD Latest', '云帆 Dragon HD Latest', 'Male', 'zh-CN'),
  ],
  en: [
    createPreset('en-US-Jenny:DragonHDLatestNeural', 'Jenny Dragon HD Latest', 'Jenny Dragon HD Latest', 'Female', 'en-US'),
    createPreset('en-US-Ava:DragonHDLatestNeural', 'Ava Dragon HD Latest', 'Ava Dragon HD Latest', 'Female', 'en-US'),
    createPreset('en-US-Andrew:DragonHDLatestNeural', 'Andrew Dragon HD Latest', 'Andrew Dragon HD Latest', 'Male', 'en-US'),
  ],
  ja: [
    createPreset('ja-JP-Nanami:DragonHDLatestNeural', 'Nanami Dragon HD Latest', '七海 Dragon HD Latest', 'Female', 'ja-JP'),
    createPreset('ja-JP-Masaru:DragonHDLatestNeural', 'Masaru Dragon HD Latest', '勝 Dragon HD Latest', 'Male', 'ja-JP'),
  ],
};

function createPreset(
  shortName: string,
  displayName: string,
  localName: string,
  gender: string,
  locale: string,
): AzureVoice {
  return {
    shortName,
    displayName,
    localName,
    gender,
    locale,
    localeName: locale,
    voiceType: 'Neural HD',
    status: 'GA',
    styles: [],
    secondaryLocales: [],
  };
}

/** Accept only Azure region identifiers, never an arbitrary host or URL. */
export function normalizeAzureRegion(region: string): string {
  const normalized = region.trim().toLowerCase();
  if (!normalized) throw new Error('Azure region is required.');
  if (!/^[a-z0-9-]+$/.test(normalized)) throw new Error('Azure region is invalid.');
  return normalized;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Azure's VoiceType field can label preview MAI voices as NeuralHD. The voice
 * name is the stable contract: genuine Speech HD voices use a DragonHD model.
 */
export function isAzureHdVoiceName(shortName: string): boolean {
  return /:DragonHD/i.test(shortName.trim());
}

/** Convert Microsoft's response into the three locales currently supported by the plugin. */
export function parseAzureVoiceCatalog(input: unknown): AzureVoiceCatalog {
  const catalog: AzureVoiceCatalog = { zh: [], en: [], ja: [] };
  if (!Array.isArray(input)) return catalog;

  const seen = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const shortName = stringValue(raw.ShortName);
    const locale = stringValue(raw.Locale);
    const language = LANGUAGE_BY_LOCALE[locale];
    if (!shortName || !language || seen.has(shortName) || !isAzureHdVoiceName(shortName)) continue;

    seen.add(shortName);
    catalog[language].push({
      shortName,
      displayName: stringValue(raw.DisplayName) || shortName,
      localName: stringValue(raw.LocalName) || stringValue(raw.DisplayName) || shortName,
      gender: stringValue(raw.Gender),
      locale,
      localeName: stringValue(raw.LocaleName) || locale,
      voiceType: stringValue(raw.VoiceType),
      status: stringValue(raw.Status),
      styles: stringArray(raw.StyleList),
      secondaryLocales: stringArray(raw.SecondaryLocaleList),
    });
  }

  for (const language of Object.keys(catalog) as SupportedLanguage[]) {
    catalog[language].sort((left, right) =>
      left.localName.localeCompare(right.localName, localeForLanguage(language), { sensitivity: 'base' }),
    );
  }
  return catalog;
}

function localeForLanguage(language: SupportedLanguage): string {
  return language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja-JP' : 'en-US';
}

export interface FetchAzureVoiceCatalogOptions {
  key: string;
  region: string;
  signal?: AbortSignal;
}

/** Fetch the voice directory without persisting or logging the Speech Key. */
export async function fetchAzureVoiceCatalog(
  options: FetchAzureVoiceCatalogOptions,
  fetchImplementation: typeof fetch = fetch,
): Promise<AzureVoiceCatalog> {
  const key = options.key.trim();
  if (!key) throw new Error('Azure Speech key is required.');
  const region = normalizeAzureRegion(options.region);
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
  const response = await fetchImplementation(endpoint, {
    method: 'GET',
    headers: { 'Ocp-Apim-Subscription-Key': key },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Azure voice catalog request failed (${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Azure voice catalog returned invalid JSON.');
  }
  return parseAzureVoiceCatalog(payload);
}

