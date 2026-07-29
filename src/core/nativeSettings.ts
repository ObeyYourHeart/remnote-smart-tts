import type { RNPlugin } from '@remnote/plugin-sdk';
import type { InterfaceLanguage, SpeechProvider, SpeechSettings, SupportedLanguage } from './types';

export const NATIVE_SETTING_IDS = {
  uiLanguage: 'smart-tts-ui-language',
  enabled: 'smart-tts-enabled',
  provider: 'smart-tts-provider',
  defaultLanguage: 'smart-tts-default-language',
  officialTtsDisabledConfirmed: 'smart-tts-official-tts-disabled',
  autoReadQuestion: 'smart-tts-auto-question',
  autoReadAnswer: 'smart-tts-auto-answer',
  rate: 'smart-tts-rate',
  volumePercent: 'smart-tts-volume-percent',
  fallbackToBrowser: 'smart-tts-browser-fallback',
  azureRegion: 'smart-tts-azure-region',
  clozeZh: 'smart-tts-cloze-zh',
  clozeEn: 'smart-tts-cloze-en',
  clozeJa: 'smart-tts-cloze-ja',
} as const;

/** Registers the everyday controls directly in RemNote's own plugin settings page. */
export async function registerNativeSettings(plugin: RNPlugin): Promise<void> {
  await plugin.settings.registerDropdownSetting({
    id: NATIVE_SETTING_IDS.uiLanguage,
    title: 'Interface language / 界面语言',
    description: 'Language used by playback messages and Advanced Voice Setup. / 播放提示与高级声音设置所使用的语言。',
    defaultValue: 'en',
    options: [
      { key: 'en', label: 'English', value: 'en' },
      { key: 'zh', label: '简体中文', value: 'zh' },
    ],
  });
  await plugin.settings.registerBooleanSetting({
    id: NATIVE_SETTING_IDS.enabled,
    title: 'Enable Smart Flashcard TTS / 启用智能卡片朗读',
    description: 'Show the compact player and allow card speech. / 显示极简播放器并允许卡片朗读。',
    defaultValue: true,
  });
  await plugin.settings.registerDropdownSetting({
    id: NATIVE_SETTING_IDS.provider,
    title: 'Voice provider / 声音来源',
    description: 'Browser voices are free. Azure Neural supports Xiaoxiao with your own Speech resource. / 浏览器声音免费；Azure Neural 可使用你自己的晓晓语音服务。',
    defaultValue: 'browser',
    options: [
      { key: 'browser', label: 'Browser voice / 浏览器声音', value: 'browser' },
      { key: 'azure', label: 'Azure Neural Voice', value: 'azure' },
    ],
  });
  await plugin.settings.registerDropdownSetting({
    id: NATIVE_SETTING_IDS.defaultLanguage,
    title: 'Fallback language / 默认语言',
    description: 'Used only when the card language cannot be detected. / 仅在无法判断卡片语言时使用。',
    defaultValue: 'zh',
    options: [
      { key: 'zh', label: 'Chinese / 中文', value: 'zh' },
      { key: 'en', label: 'English', value: 'en' },
      { key: 'ja', label: 'Japanese / 日本語', value: 'ja' },
    ],
  });
  await plugin.settings.registerBooleanSetting({
    id: NATIVE_SETTING_IDS.officialTtsDisabledConfirmed,
    title: "I disabled RemNote's autoplay TTS / 我已关闭 RemNote 官方自动 TTS",
    description: 'Required before plugin autoplay can be enabled, preventing two voices from playing together. / 开启插件自动朗读前必须确认，避免两套声音同时播放。',
    defaultValue: false,
  });
  await plugin.settings.registerBooleanSetting({
    id: NATIVE_SETTING_IDS.autoReadQuestion,
    title: 'Autoplay question / 自动朗读问题面',
    description: 'Read the question when a new card appears. Requires the safety confirmation above. / 新卡片出现时朗读问题面，需要先完成上方安全确认。',
    // Question-side autoplay is the primary feature. The separate safety
    // confirmation below still prevents it from running alongside RemNote TTS.
    defaultValue: true,
  });
  await plugin.settings.registerBooleanSetting({
    id: NATIVE_SETTING_IDS.autoReadAnswer,
    title: 'Autoplay answer / 自动朗读答案面',
    description: 'Read the answer after revealing it. Requires the safety confirmation above. / 翻面后朗读答案，需要先完成上方安全确认。',
    defaultValue: false,
  });
  await plugin.settings.registerNumberSetting({
    id: NATIVE_SETTING_IDS.rate,
    title: 'Speech rate / 语速',
    description: 'Recommended range: 0.5 to 2.0. / 建议范围：0.5 到 2.0。',
    defaultValue: 1,
  });
  await plugin.settings.registerNumberSetting({
    id: NATIVE_SETTING_IDS.volumePercent,
    title: 'Volume (%) / 音量（百分比）',
    description: 'From 0 to 100. / 范围 0 到 100。',
    defaultValue: 100,
  });
  await plugin.settings.registerBooleanSetting({
    id: NATIVE_SETTING_IDS.fallbackToBrowser,
    title: 'Browser fallback / 浏览器声音回退',
    description: 'Use a browser voice when Azure is unavailable. / Azure 不可用时自动改用浏览器声音。',
    defaultValue: true,
  });
  await plugin.settings.registerStringSetting({
    id: NATIVE_SETTING_IDS.azureRegion,
    title: 'Azure Speech region / Azure Speech 区域',
    description: 'Example: eastasia. Keep your API key in Advanced Voice Setup; it stays local. / 例如 eastasia；API Key 请在高级声音设置中填写并仅保存在本机。',
    defaultValue: '',
  });
  await plugin.settings.registerStringSetting({
    id: NATIVE_SETTING_IDS.clozeZh,
    title: 'Chinese Cloze prompt / 中文挖空读法',
    description: 'Spoken in place of the active Chinese Cloze. / 替代当前中文挖空位置朗读。',
    defaultValue: '什么',
  });
  await plugin.settings.registerStringSetting({
    id: NATIVE_SETTING_IDS.clozeEn,
    title: 'English Cloze prompt / 英文挖空读法',
    description: 'Spoken in place of the active English Cloze. / 替代当前英文挖空位置朗读。',
    defaultValue: 'what',
  });
  await plugin.settings.registerStringSetting({
    id: NATIVE_SETTING_IDS.clozeJa,
    title: 'Japanese Cloze prompt / 日文挖空读法',
    description: 'Spoken in place of the active Japanese Cloze. / 替代当前日文挖空位置朗读。',
    defaultValue: 'なに',
  });
}

async function getSetting<T>(plugin: RNPlugin, id: string): Promise<T | undefined> {
  try {
    return await plugin.settings.getSetting<T>(id);
  } catch {
    // Local previews and older RemNote builds can fall back to legacy synced storage.
    return undefined;
  }
}

/** Reads RemNote-native values while leaving dynamic voice choices in plugin storage. */
export async function readNativeSettings(plugin: RNPlugin): Promise<Partial<SpeechSettings>> {
  if (!plugin.settings) return {};
  const [
    uiLanguage,
    enabled,
    provider,
    defaultLanguage,
    officialTtsDisabledConfirmed,
    autoReadQuestion,
    autoReadAnswer,
    rate,
    volumePercent,
    fallbackToBrowser,
    azureRegion,
    clozeZh,
    clozeEn,
    clozeJa,
  ] = await Promise.all([
    getSetting<InterfaceLanguage>(plugin, NATIVE_SETTING_IDS.uiLanguage),
    getSetting<boolean>(plugin, NATIVE_SETTING_IDS.enabled),
    getSetting<SpeechProvider>(plugin, NATIVE_SETTING_IDS.provider),
    getSetting<SupportedLanguage>(plugin, NATIVE_SETTING_IDS.defaultLanguage),
    getSetting<boolean>(plugin, NATIVE_SETTING_IDS.officialTtsDisabledConfirmed),
    getSetting<boolean>(plugin, NATIVE_SETTING_IDS.autoReadQuestion),
    getSetting<boolean>(plugin, NATIVE_SETTING_IDS.autoReadAnswer),
    getSetting<number>(plugin, NATIVE_SETTING_IDS.rate),
    getSetting<number>(plugin, NATIVE_SETTING_IDS.volumePercent),
    getSetting<boolean>(plugin, NATIVE_SETTING_IDS.fallbackToBrowser),
    getSetting<string>(plugin, NATIVE_SETTING_IDS.azureRegion),
    getSetting<string>(plugin, NATIVE_SETTING_IDS.clozeZh),
    getSetting<string>(plugin, NATIVE_SETTING_IDS.clozeEn),
    getSetting<string>(plugin, NATIVE_SETTING_IDS.clozeJa),
  ]);

  return {
    ...(uiLanguage ? { uiLanguage } : {}),
    ...(typeof enabled === 'boolean' ? { enabled } : {}),
    ...(provider ? { provider } : {}),
    ...(defaultLanguage ? { defaultLanguage } : {}),
    ...(typeof officialTtsDisabledConfirmed === 'boolean' ? { officialTtsDisabledConfirmed } : {}),
    ...(typeof autoReadQuestion === 'boolean' ? { autoReadQuestion } : {}),
    ...(typeof autoReadAnswer === 'boolean' ? { autoReadAnswer } : {}),
    ...(typeof rate === 'number' ? { rate } : {}),
    ...(typeof volumePercent === 'number' ? { volume: volumePercent / 100 } : {}),
    ...(typeof fallbackToBrowser === 'boolean' ? { fallbackToBrowser } : {}),
    ...(typeof azureRegion === 'string' ? { azureRegion } : {}),
    clozeWords: {
      zh: clozeZh || '什么',
      en: clozeEn || 'what',
      ja: clozeJa || 'なに',
    },
  };
}
