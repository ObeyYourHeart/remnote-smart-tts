import type { RNPlugin } from '@remnote/plugin-sdk';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CURATED_AZURE_VOICES,
  azureVoiceModelLabel,
  fetchAzureVoiceCatalog,
  type AzureVoice,
  type AzureVoiceCatalog,
} from '../core/azureVoiceCatalog';
import { readAzureKey, readSettings, writeAzureKey, writeSettings } from '../core/settings';
import { runPreviewWithTimeout } from '../core/preview';
import { getAvailableBrowserVoices, SpeechController } from '../core/speech';
import type { InterfaceLanguage, LanguageVoiceMap, SpeechSettings, SupportedLanguage } from '../core/types';
import '../style.css';

const LANGUAGE_META: Record<SupportedLanguage, { english: string; native: string; locale: string; sample: string }> = {
  zh: { english: 'Chinese', native: '中文', locale: 'zh-CN', sample: '你好，我是晓晓。今天也要认真复习。' },
  en: { english: 'English', native: 'English', locale: 'en-US', sample: 'A clear voice makes every review easier.' },
  ja: { english: 'Japanese', native: '日本語', locale: 'ja-JP', sample: 'こんにちは。今日も日本語を勉強しましょう。' },
};

const COPY = {
  en: {
    eyebrow: 'REMNOTE SMART TTS',
    title: 'Advanced voice setup',
    subtitle: 'Choose and test the voice used for each card language.',
    nativeNoticeTitle: 'Everyday settings are now built into RemNote',
    nativeNoticeBody: 'Open Settings → Plugins → RemNote Smart TTS for autoplay, Cloze prompts, rate, volume, and provider.',
    provider: 'Active provider',
    browser: 'Browser voice',
    azure: 'Azure Neural Voice',
    credentials: 'Azure connection',
    key: 'Speech key',
    keyPlaceholder: 'Stored only on this device',
    region: 'Region',
    regionPlaceholder: 'eastasia',
    privacy: 'Your Speech Key stays in local RemNote storage. Region and voice choices are saved with this plugin.',
    voices: 'Language voices',
    catalogLoading: 'Loading the complete Azure voice catalog…',
    catalogReady: 'Azure catalog loaded: {count} compatible voices.',
    catalogFailed: 'Could not load the Azure catalog. Curated voices remain available.',
    catalogRefresh: 'Refresh catalog',
    voice: 'Voice',
    automatic: 'Automatic — best available voice',
    preview: 'Preview',
    previewing: 'Playing…',
    stop: 'Stop',
    save: 'Save voice setup',
    saving: 'Saving…',
    saved: 'Voice setup saved.',
    saveFailed: 'Could not save voice setup. Please try again.',
    previewFailed: 'Voice preview failed. Check the selected voice, Azure key, and region.',
    previewTimedOut: 'Voice preview timed out and was stopped. Please try another voice.',
    fallback: 'Azure was unavailable, so this preview used a browser voice.',
    close: 'Close',
  },
  zh: {
    eyebrow: '智能卡片朗读',
    title: '高级声音设置',
    subtitle: '为每种卡片语言选择并试听声音。',
    nativeNoticeTitle: '日常设置现已集成到 RemNote',
    nativeNoticeBody: '前往 设置 → 插件 → RemNote Smart TTS 调整自动朗读、Cloze 用词、语速、音量和声音来源。',
    provider: '当前声音来源',
    browser: '浏览器声音',
    azure: 'Azure Neural Voice',
    credentials: 'Azure 连接',
    key: 'Speech Key',
    keyPlaceholder: '仅保存在这台设备上',
    region: '区域',
    regionPlaceholder: '例如：eastasia',
    privacy: 'Speech Key 仅保存在本机 RemNote storage；Region 与声音选择保存在本插件设置中。',
    voices: '语言声音',
    catalogLoading: '正在加载 Azure 完整声音目录…',
    catalogReady: 'Azure 目录已加载：{count} 个兼容声音。',
    catalogFailed: '无法加载 Azure 目录，当前仍可使用精选声音。',
    catalogRefresh: '刷新目录',
    voice: '声音',
    automatic: '自动选择最佳可用声音',
    preview: '试听',
    previewing: '播放中…',
    stop: '停止',
    save: '保存声音设置',
    saving: '保存中…',
    saved: '声音设置已保存。',
    saveFailed: '声音设置保存失败，请重试。',
    previewFailed: '试听失败，请检查声音、Azure Key 和 Region。',
    previewTimedOut: '试听超时，已自动停止。请尝试其他声音。',
    fallback: 'Azure 暂不可用，本次试听已改用浏览器声音。',
    close: '关闭',
  },
} as const;

const testController = new SpeechController();

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

function voiceOptionLabel(voice: AzureVoice): string {
  const name = voice.localName === voice.displayName
    ? voice.displayName
    : `${voice.localName} / ${voice.displayName}`;
  const previewLabel = voice.status && voice.status.toLowerCase() !== 'ga'
    ? voice.status
    : '';
  return [name, voice.gender, azureVoiceModelLabel(voice), previewLabel].filter(Boolean).join(' · ');
}

function voicesIncludingSelection(
  voices: AzureVoice[],
  selectedVoice: string,
  language: SupportedLanguage,
): AzureVoice[] {
  if (!selectedVoice || voices.some((voice) => voice.shortName === selectedVoice)) return voices;
  const selectedPreset = CURATED_AZURE_VOICES[language]
    .find((voice) => voice.shortName === selectedVoice);
  return [selectedPreset ?? {
    shortName: selectedVoice,
    displayName: selectedVoice,
    localName: selectedVoice,
    gender: '',
    locale: LANGUAGE_META[language].locale,
    localeName: LANGUAGE_META[language].locale,
    voiceType: '',
    status: '',
    styles: [],
    secondaryLocales: [],
  }, ...voices];
}

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
  const previewRequestRef = useRef(0);
  const [azureCatalog, setAzureCatalog] = useState<AzureVoiceCatalog>(CURATED_AZURE_VOICES);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>('idle');
  const [catalogRequest, setCatalogRequest] = useState(0);

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
      previewRequestRef.current += 1;
      testController.cancel();
      window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
    };
  }, [plugin]);

  useEffect(() => {
    if (settings?.provider !== 'azure' || !azureKey.trim() || !settings.azureRegion.trim()) {
      setAzureCatalog(CURATED_AZURE_VOICES);
      setCatalogStatus('idle');
      return undefined;
    }

    const controller = new AbortController();
    let disposed = false;
    let requestTimeout: number | undefined;
    const timer = window.setTimeout(() => {
      setCatalogStatus('loading');
      requestTimeout = window.setTimeout(() => controller.abort(), 10_000);
      void fetchAzureVoiceCatalog({
        key: azureKey,
        region: settings.azureRegion,
        signal: controller.signal,
      }).then((catalog) => {
        if (disposed) return;
        const compatibleVoiceCount = Object.values(catalog)
          .reduce((sum, languageVoices) => sum + languageVoices.length, 0);
        if (compatibleVoiceCount === 0) throw new Error('Azure returned no compatible voices.');
        setAzureCatalog(catalog);
        setCatalogStatus('ready');
      }).catch((error) => {
        if (disposed) return;
        console.warn('RemNote Smart TTS could not load the Azure voice catalog.', error);
        setAzureCatalog(CURATED_AZURE_VOICES);
        setCatalogStatus('error');
      }).finally(() => {
        if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
      });
    }, 500);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [azureKey, catalogRequest, settings?.azureRegion, settings?.provider]);

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
  const compatibleVoiceCount = Object.values(azureCatalog)
    .reduce((sum, languageVoices) => sum + languageVoices.length, 0);

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
      console.error('RemNote Smart TTS could not save advanced voice settings.', error);
      await plugin.app.toast(copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const testVoice = async (language: SupportedLanguage) => {
    if (testingLanguage === language) {
      previewRequestRef.current += 1;
      testController.cancel();
      setTestingLanguage(null);
      return;
    }

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setTestingLanguage(language);
    try {
      const result = await runPreviewWithTimeout(
        testController.speak(
          { text: LANGUAGE_META[language].sample, language },
          settings,
          azureKey,
        ),
        () => testController.cancel(),
      );
      if (result.fallbackReason) {
        await plugin.app.toast(`${copy.fallback} ${result.fallbackReason}`);
      }
    } catch (error) {
      if (requestId !== previewRequestRef.current) return;
      console.error('RemNote Smart TTS voice preview failed.', error);
      const message = error instanceof Error && error.message === 'Voice preview timed out.'
        ? copy.previewTimedOut
        : copy.previewFailed;
      await plugin.app.toast(message);
    } finally {
      if (requestId === previewRequestRef.current) setTestingLanguage(null);
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
              <label>
                <span>{copy.region}</span>
                <input
                  type="text"
                  autoComplete="off"
                  value={settings.azureRegion}
                  onChange={(event) => setSettings({ ...settings, azureRegion: event.target.value })}
                  placeholder={copy.regionPlaceholder}
                />
              </label>
            </div>
            <p className="privacy-note"><span aria-hidden="true">●</span>{copy.privacy}</p>
          </div>
        )}
      </section>

      <section className="voice-setup__section">
        <div className="section-title section-title--voices">
          <span>{settings.provider === 'azure' ? '03' : '02'}</span>
          <h2>{copy.voices}</h2>
          {settings.provider === 'azure' && (
            <button
              className="catalog-refresh-button"
              type="button"
              onClick={() => setCatalogRequest((request) => request + 1)}
              disabled={catalogStatus === 'loading' || !azureKey.trim() || !settings.azureRegion.trim()}
            >
              {copy.catalogRefresh}
            </button>
          )}
        </div>
        {settings.provider === 'azure' && catalogStatus !== 'idle' && (
          <p className={`voice-catalog-status voice-catalog-status--${catalogStatus}`} role="status">
            {catalogStatus === 'loading' && copy.catalogLoading}
            {catalogStatus === 'ready' && copy.catalogReady.replace('{count}', String(compatibleVoiceCount))}
            {catalogStatus === 'error' && copy.catalogFailed}
          </p>
        )}
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
                      {voicesIncludingSelection(
                        azureCatalog[language],
                        settings.azureVoices[language],
                        language,
                      ).map((voice) => (
                        <option key={voice.shortName} value={voice.shortName}>
                          {voiceOptionLabel(voice)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select value={settings.browserVoices[language]} onChange={(event) => updateVoice('browserVoices', language, event.target.value)}>
                      <option value="">{copy.automatic}</option>
                      {browserVoices[language].map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}{voice.localService ? ' · Local' : ''}</option>)}
                    </select>
                  )}
                </label>
                <button
                  className="preview-button"
                  type="button"
                  onClick={() => void testVoice(language)}
                  disabled={testingLanguage !== null && testingLanguage !== language}
                  aria-label={testingLanguage === language ? copy.stop : copy.preview}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={testingLanguage === language ? 'M7 7h10v10H7z' : 'M8 5v14l11-7z'} />
                  </svg>
                  {testingLanguage === language ? copy.stop : copy.preview}
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
