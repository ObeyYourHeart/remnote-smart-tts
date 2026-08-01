import type { RNPlugin } from '@remnote/plugin-sdk';
import type {
  AutoplayMode,
  InterfaceLanguage,
  SpeechProvider,
  SpeechSettings,
  SupportedLanguage,
} from './types';

export const NATIVE_SETTING_IDS = {
  uiLanguage: 'smart-tts-ui-language',
  enabled: 'smart-tts-enabled',
  provider: 'smart-tts-provider',
  defaultLanguage: 'smart-tts-default-language',
  // v2 intentionally resets the old question-only default. RemNote settings
  // cannot be updated programmatically, so a new id is the safe migration path.
  autoplayMode: 'smart-tts-autoplay-mode-v2',
  replaceRemNoteTtsControls: 'smart-tts-replace-remnote-controls',
  rate: 'smart-tts-rate',
  volumePercent: 'smart-tts-volume-percent',
  fallbackToBrowser: 'smart-tts-browser-fallback',
  clozeZh: 'smart-tts-cloze-zh',
  clozeEn: 'smart-tts-cloze-en',
  clozeJa: 'smart-tts-cloze-ja',
} as const;

const LEGACY_SETTING_IDS = {
  autoReadQuestion: 'smart-tts-auto-question',
  autoReadAnswer: 'smart-tts-auto-answer',
} as const;

/** Registers everyday controls directly in RemNote's own plugin settings page. */
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
    title: 'Enable RemNote Smart TTS / 启用 RemNote 智能朗读',
    description: 'Show the compact player and allow card speech. / 显示极简播放器并允许卡片朗读。',
    defaultValue: true,
  });
  await plugin.settings.registerBooleanSetting({
    id: NATIVE_SETTING_IDS.replaceRemNoteTtsControls,
    title: 'Replace RemNote TTS controls / 替代官方朗读控件',
    description: 'Hide the Front/Back TTS row in the queue so this plugin is the only visible player. This is visual only; keep RemNote Autoplay Text to Speech off. / 隐藏队列中的官方正面/背面朗读行，只保留本插件播放器；此选项仅改变外观，请保持 RemNote 官方自动朗读关闭。',
    defaultValue: true,
  });
  await plugin.settings.registerDropdownSetting({
    id: NATIVE_SETTING_IDS.provider,
    title: 'Voice provider / 声音来源',
    description: 'Browser voices are free. External providers use your own account and credentials. / 浏览器声音免费；外部语音服务使用你自己的账户与凭据。',
    defaultValue: 'browser',
    options: [
      { key: 'browser', label: 'Browser voice / 浏览器声音', value: 'browser' },
      { key: 'azure', label: 'Azure Neural Voice', value: 'azure' },
    ],
  });
  await plugin.settings.registerDropdownSetting({
    id: NATIVE_SETTING_IDS.autoplayMode,
    title: 'Autoplay mode / 自动朗读模式',
    description: 'Choose which card sides this plugin reads automatically. RemNote does not expose a supported switch for controlling its own TTS. / 选择本插件自动朗读的卡片面；RemNote 暂未提供控制官方 TTS 的插件接口。',
    defaultValue: 'both',
    options: [
      { key: 'off', label: 'Off / 关闭', value: 'off' },
      { key: 'question', label: 'Question only / 仅问题面', value: 'question' },
      { key: 'answer', label: 'Answer only / 仅答案面', value: 'answer' },
      { key: 'both', label: 'Question and answer / 问题面和答案面', value: 'both' },
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
  await plugin.settings.registerNumberSetting({
    id: NATIVE_SETTING_IDS.rate,
    title: 'Speech rate / 语速',
    description: 'Recommended range: 0.5 to 2.0. / 建议范围：0.5 到 2.0。',
    defaultValue: 0.9,
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

function autoplayFlags(mode: AutoplayMode | undefined, legacyQuestion?: boolean, legacyAnswer?: boolean) {
  if (mode === 'off') return { autoReadQuestion: false, autoReadAnswer: false };
  if (mode === 'question') return { autoReadQuestion: true, autoReadAnswer: false };
  if (mode === 'answer') return { autoReadQuestion: false, autoReadAnswer: true };
  if (mode === 'both') return { autoReadQuestion: true, autoReadAnswer: true };
  if (typeof legacyQuestion === 'boolean' || typeof legacyAnswer === 'boolean') {
    return {
      autoReadQuestion: legacyQuestion === true,
      autoReadAnswer: legacyAnswer === true,
    };
  }
  return {};
}

/** Reads RemNote-native values while leaving credentials and dynamic voices in plugin storage. */
export async function readNativeSettings(plugin: RNPlugin): Promise<Partial<SpeechSettings>> {
  if (!plugin.settings) return {};
  const [
    uiLanguage,
    enabled,
    provider,
    autoplayMode,
    legacyQuestion,
    legacyAnswer,
    defaultLanguage,
    rate,
    volumePercent,
    fallbackToBrowser,
    clozeZh,
    clozeEn,
    clozeJa,
  ] = await Promise.all([
    getSetting<InterfaceLanguage>(plugin, NATIVE_SETTING_IDS.uiLanguage),
    getSetting<boolean>(plugin, NATIVE_SETTING_IDS.enabled),
    getSetting<SpeechProvider>(plugin, NATIVE_SETTING_IDS.provider),
    getSetting<AutoplayMode>(plugin, NATIVE_SETTING_IDS.autoplayMode),
    getSetting<boolean>(plugin, LEGACY_SETTING_IDS.autoReadQuestion),
    getSetting<boolean>(plugin, LEGACY_SETTING_IDS.autoReadAnswer),
    getSetting<SupportedLanguage>(plugin, NATIVE_SETTING_IDS.defaultLanguage),
    getSetting<number>(plugin, NATIVE_SETTING_IDS.rate),
    getSetting<number>(plugin, NATIVE_SETTING_IDS.volumePercent),
    getSetting<boolean>(plugin, NATIVE_SETTING_IDS.fallbackToBrowser),
    getSetting<string>(plugin, NATIVE_SETTING_IDS.clozeZh),
    getSetting<string>(plugin, NATIVE_SETTING_IDS.clozeEn),
    getSetting<string>(plugin, NATIVE_SETTING_IDS.clozeJa),
  ]);

  return {
    ...(uiLanguage ? { uiLanguage } : {}),
    ...(typeof enabled === 'boolean' ? { enabled } : {}),
    ...(provider ? { provider } : {}),
    ...autoplayFlags(autoplayMode, legacyQuestion, legacyAnswer),
    ...(defaultLanguage ? { defaultLanguage } : {}),
    ...(typeof rate === 'number' ? { rate } : {}),
    ...(typeof volumePercent === 'number' ? { volume: volumePercent / 100 } : {}),
    ...(typeof fallbackToBrowser === 'boolean' ? { fallbackToBrowser } : {}),
    clozeWords: {
      zh: clozeZh || '什么',
      en: clozeEn || 'what',
      ja: clozeJa || 'なに',
    },
  };
}
