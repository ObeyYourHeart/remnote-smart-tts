import type { RNPlugin } from '@remnote/plugin-sdk';
import { useEffect, useMemo, useState } from 'react';
import { readAzureKey, readSettings, writeAzureKey, writeSettings } from '../core/settings';
import { getAvailableBrowserVoices, SpeechController } from '../core/speech';
import type { InterfaceLanguage, LanguageVoiceMap, SpeechSettings, SupportedLanguage } from '../core/types';
import '../style.css';

const LANGUAGE_META: Record<SupportedLanguage, { english: string; native: string; locale: string; sample: string }> = {
  zh: { english: 'Chinese', native: '中文', locale: 'zh-CN', sample: '你好，我是晓晓。今天也要认真复习。' },
  en: { english: 'English', native: 'English', locale: 'en-US', sample: 'A clear voice makes every review easier.' },
  ja: { english: 'Japanese', native: '日本語', locale: 'ja-JP', sample: 'こんにちは。今日も日本語を勉強しましょう。' },
};

const AZURE_VOICE_OPTIONS: Record<SupportedLanguage, Array<{ value: string; label: string }>> = {
  zh: [
    { value: 'zh-CN-XiaoxiaoNeural', label: 'Xiaoxiao Neural — Recommended' },
    { value: 'zh-CN-XiaoxiaoMultilingualNeural', label: 'Xiaoxiao Multilingual' },
    { value: 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural', label: 'Xiaoxiao Dragon HD' },
    { value: 'zh-CN-YunxiNeural', label: 'Yunxi Neural — Male' },
  ],
  en: [
    { value: 'en-US-JennyNeural', label: 'Jenny Neural — Recommended' },
    { value: 'en-US-AriaNeural', label: 'Aria Neural' },
    { value: 'en-US-GuyNeural', label: 'Guy Neural — Male' },
    { value: 'en-US-RyanMultilingualNeural', label: 'Ryan Multilingual — Male' },
  ],
  ja: [
    { value: 'ja-JP-NanamiNeural', label: 'Nanami Neural — Recommended' },
    { value: 'ja-JP-Nanami:DragonHDLatestNeural', label: 'Nanami Dragon HD' },
    { value: 'ja-JP-AoiNeural', label: 'Aoi Neural' },
    { value: 'ja-JP-ShioriNeural', label: 'Shiori Neural' },
    { value: 'ja-JP-KeitaNeural', label: 'Keita Neural — Male' },
    { value: 'ja-JP-MasaruMultilingualNeural', label: 'Masaru Multilingual — Male' },
  ],
};

const COPY = {
  en: {
    eyebrow: 'SMART FLASHCARD TTS',
    title: 'Advanced voice setup',
    subtitle: 'Choose and test the voice used for each card language.',
    nativeNoticeTitle: 'Everyday settings are now built into RemNote',
    nativeNoticeBody: 'Open Settings → Plugins → Smart Flashcard TTS for autoplay, Cloze prompts, rate, volume, and provider.',
    provider: 'Active provider',
    browser: 'Browser voice',
    azure: 'Azure Neural Voice',
    credentials: 'Azure connection',
    key: 'Speech key',
    keyPlaceholder: 'Stored only on this device',
    region: 'Region',
    regionMissing: 'Set the region in RemNote plugin settings.',
    privacy: 'Your key stays in local RemNote storage and is never synced.',
    voices: 'Language voices',
    voice: 'Voice',
    automatic: 'Automatic — best available voice',
    preview: 'Preview',
    previewing: 'Playing…',
    save: 'Save voice setup',
    saving: 'Saving…',
    saved: 'Voice setup saved.',
    saveFailed: 'Could not save voice setup. Please try again.',
    previewFailed: 'Voice preview failed. Check the selected voice, Azure key, and region.',
    fallback: 'Azure was unavailable, so this preview used a browser voice.',
    close: 'Close',
  },
  zh: {
    eyebrow: '智能卡片朗读',
    title: '高级声音设置',
    subtitle: '为每种卡片语言选择并试听声音。',
    nativeNoticeTitle: '日常设置现已集成到 RemNote',
    nativeNoticeBody: '前往 设置 → 插件 → Smart Flashcard TTS 调整自动朗读、Cloze 用词、语速、音量和声音来源。',
    provider: '当前声音来源',
    browser: '浏览器声音',
    azure: 'Azure Neural Voice',
    credentials: 'Azure 连接',
    key: 'Speech Key',
    keyPlaceholder: '仅保存在这台设备上',
    region: '区域',
    regionMissing: '请在 RemNote 插件设置中填写 Region。',
    privacy: 'Key 只保存在本机 RemNote storage，不会同步。',
    voices: '语言声音',
    voice: '声音',
    automatic: '自动选择最佳可用声音',
    preview: '试听',
    previewing: '播放中…',
    save: '保存声音设置',
    saving: '保存中…',
    saved: '声音设置已保存。',
    saveFailed: '声音设置保存失败，请重试。',
    previewFailed: '试听失败，请检查声音、Azure Key 和 Region。',
    fallback: 'Azure 暂不可用，本次试听已改用浏览器声音。',
    close: '关闭',
  },
} as const;

const testController = new SpeechController();

function WaveMark() {
  return <span className="voice-setup__wave" aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function SettingsPanel({ plugin }: { plugin: RNPlugin }) {
  const [settings, setSettings] = useState<SpeechSettings | null>(null);
  const [displayLanguage, setDisplayLanguage] = useState<InterfaceLanguage>('en');
  const [azureKey, setAzureKey] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [testingLanguage, setTestingLanguage] = useState<SupportedLanguage | null>(null);

  useEffect(() => {
    void Promise.all([readSettings(plugin), readAzureKey(plugin)]).then(([savedSettings, savedKey]) => {
      setSettings(savedSettings);
      setDisplayLanguage(savedSettings.uiLanguage);
      setAzureKey(savedKey);
    });

    const refreshVoices = () => setVoices([...getAvailableBrowserVoices()]);
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
    return () => {
      testController.cancel();
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
    };
  }, [plugin]);

  const browserVoices = useMemo(() => {
    const result: Record<SupportedLanguage, SpeechSynthesisVoice[]> = { zh: [], en: [], ja: [] };
    for (const voice of voices) {
      const locale = voice.lang.toLowerCase();
      if (locale.startsWith('zh')) result.zh.push(voice);
      if (locale.startsWith('en')) result.en.push(voice);
      if (locale.startsWith('ja')) result.ja.push(voice);
    }
    return result;
  }, [voices]);

  if (!settings) return <main className="voice-setup voice-setup--loading"><WaveMark /></main>;
  const copy = COPY[displayLanguage];

  const updateVoice = (field: 'browserVoices' | 'azureVoices', language: SupportedLanguage, value: string) => {
    setSettings((current) => current && ({
      ...current,
      [field]: { ...current[field], [language]: value } as LanguageVoiceMap,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([writeSettings(plugin, settings), writeAzureKey(plugin, azureKey)]);
      await plugin.app.toast(copy.saved);
    } catch (error) {
      console.error('Smart Flashcard TTS could not save advanced voice settings.', error);
      await plugin.app.toast(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const testVoice = async (language: SupportedLanguage) => {
    setTestingLanguage(language);
    try {
      const result = await testController.speak(
        { text: LANGUAGE_META[language].sample, language },
        settings,
        azureKey,
      );
      if (result.fallbackReason) await plugin.app.toast(copy.fallback);
    } catch (error) {
      console.error('Smart Flashcard TTS voice preview failed.', error);
      await plugin.app.toast(copy.previewFailed);
    } finally {
      setTestingLanguage(null);
    }
  };

  return (
    <main className="voice-setup" lang={displayLanguage === 'zh' ? 'zh-CN' : 'en'}>
      <header className="voice-setup__header">
        <div className="voice-setup__identity">
          <WaveMark />
          <div>
            <p>{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <span>{copy.subtitle}</span>
          </div>
        </div>
        <div className="voice-setup__header-actions">
          <div className="language-toggle" aria-label="Interface language">
            <button type="button" className={displayLanguage === 'en' ? 'is-active' : ''} onClick={() => setDisplayLanguage('en')}>EN</button>
            <button type="button" className={displayLanguage === 'zh' ? 'is-active' : ''} onClick={() => setDisplayLanguage('zh')}>中文</button>
          </div>
          <button className="icon-button" type="button" onClick={() => void plugin.widget.closePopup()} aria-label={copy.close} title={copy.close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </header>

      <section className="native-settings-notice">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /><circle cx="12" cy="12" r="4" /></svg>
        <div><strong>{copy.nativeNoticeTitle}</strong><p>{copy.nativeNoticeBody}</p></div>
      </section>

      <section className="voice-setup__section voice-setup__section--provider">
        <div className="section-title"><span>01</span><h2>{copy.provider}</h2></div>
        <div className="provider-summary">
          <div className="provider-summary__icon"><WaveMark /></div>
          <div><strong>{settings.provider === 'azure' ? copy.azure : copy.browser}</strong><small>{settings.provider === 'azure' ? 'Microsoft Cognitive Services' : 'Web Speech API'}</small></div>
          <span className="status-chip">{settings.provider === 'azure' ? 'AZURE' : 'LOCAL'}</span>
        </div>

        {settings.provider === 'azure' && (
          <div className="credential-panel">
            <div className="section-title section-title--inverse"><span>02</span><h2>{copy.credentials}</h2></div>
            <div className="credential-grid">
              <label><span>{copy.key}</span><input type="password" autoComplete="off" value={azureKey} onChange={(event) => setAzureKey(event.target.value)} placeholder={copy.keyPlaceholder} /></label>
              <div className="read-only-field"><span>{copy.region}</span><strong>{settings.azureRegion || copy.regionMissing}</strong></div>
            </div>
            <p className="privacy-note"><span aria-hidden="true">●</span>{copy.privacy}</p>
          </div>
        )}
      </section>

      <section className="voice-setup__section">
        <div className="section-title"><span>{settings.provider === 'azure' ? '03' : '02'}</span><h2>{copy.voices}</h2></div>
        <div className="voice-list">
          {(Object.keys(LANGUAGE_META) as SupportedLanguage[]).map((language) => {
            const meta = LANGUAGE_META[language];
            return (
              <article className="voice-row" key={language} data-language={language}>
                <div className="voice-row__language"><small>{meta.locale}</small><strong>{displayLanguage === 'zh' ? meta.native : meta.english}</strong></div>
                <label>
                  <span>{copy.voice}</span>
                  {settings.provider === 'azure' ? (
                    <select value={settings.azureVoices[language]} onChange={(event) => updateVoice('azureVoices', language, event.target.value)}>
                      {AZURE_VOICE_OPTIONS[language].map((voice) => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
                    </select>
                  ) : (
                    <select value={settings.browserVoices[language]} onChange={(event) => updateVoice('browserVoices', language, event.target.value)}>
                      <option value="">{copy.automatic}</option>
                      {browserVoices[language].map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}{voice.localService ? ' · Local' : ''}</option>)}
                    </select>
                  )}
                </label>
                <button className="preview-button" type="button" onClick={() => void testVoice(language)} disabled={testingLanguage !== null}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  {testingLanguage === language ? copy.previewing : copy.preview}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="voice-setup__footer">
        <button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? copy.saving : copy.save}</button>
      </footer>
    </main>
  );
}
