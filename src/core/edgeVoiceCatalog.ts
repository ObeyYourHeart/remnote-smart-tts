import type { SupportedLanguage } from './types';

/** A voice exposed by the local edge-tts service. */
export interface EdgeLocalVoice {
  name: string;
  locale: string;
  gender: 'Female' | 'Male' | '';
  friendlyName?: string;
}

/**
 * Small curated catalog shown before the local service answers. These are the
 * same free Microsoft neural voices Edge exposes as "Online (Natural)".
 */
export const CURATED_EDGE_VOICES: Record<SupportedLanguage, EdgeLocalVoice[]> = {
  zh: [
    { name: 'zh-CN-XiaoxiaoNeural', locale: 'zh-CN', gender: 'Female' },
    { name: 'zh-CN-YunxiNeural', locale: 'zh-CN', gender: 'Male' },
    { name: 'zh-CN-XiaoyiNeural', locale: 'zh-CN', gender: 'Female' },
    { name: 'zh-CN-YunyangNeural', locale: 'zh-CN', gender: 'Male' },
  ],
  en: [
    { name: 'en-US-AriaNeural', locale: 'en-US', gender: 'Female' },
    { name: 'en-US-JennyNeural', locale: 'en-US', gender: 'Female' },
    { name: 'en-US-GuyNeural', locale: 'en-US', gender: 'Male' },
    { name: 'en-US-ChristopherNeural', locale: 'en-US', gender: 'Male' },
  ],
  ja: [
    { name: 'ja-JP-NanamiNeural', locale: 'ja-JP', gender: 'Female' },
    { name: 'ja-JP-KeitaNeural', locale: 'ja-JP', gender: 'Male' },
  ],
};
