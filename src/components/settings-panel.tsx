import type { RNPlugin } from '@remnote/plugin-sdk';
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  readAzureKey,
  readSettings,
  writeAzureKey,
  writeSettings,
} from '../core/settings';
import { getAvailableBrowserVoices, SpeechController } from '../core/speech';
import type { LanguageVoiceMap, SpeechSettings, SupportedLanguage } from '../core/types';
import '../style.css';

const LANGUAGE_META: Record<SupportedLanguage, { label: string; locale: string; sample: string }> = {
  zh: { label: '中文', locale: 'zh-CN', sample: '你好，我是晓晓。今天也要认真复习。' },
  en: { label: 'English', locale: 'en-US', sample: 'A clear voice makes every review easier.' },
  ja: { label: '日本語', locale: 'ja-JP', sample: 'こんにちは。今日も日本語を勉強しましょう。' },
};

const AZURE_VOICE_OPTIONS: Record<SupportedLanguage, Array<{ value: string; label: string }>> = {
  zh: [
    { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 Neural · 稳定推荐' },
    { value: 'zh-CN-XiaoxiaoMultilingualNeural', label: '晓晓 Multilingual · 多语' },
    { value: 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural', label: '晓晓 Dragon HD · 区域可用性不同' },
    { value: 'zh-CN-YunxiNeural', label: '云希 Neural · 男声' },
  ],
  en: [
    { value: 'en-US-JennyNeural', label: 'Jenny Neural · 推荐' },
    { value: 'en-US-AriaNeural', label: 'Aria Neural' },
    { value: 'en-US-GuyNeural', label: 'Guy Neural · 男声' },
    { value: 'en-US-RyanMultilingualNeural', label: 'Ryan Multilingual · 多语男声' },
  ],
  ja: [
    { value: 'ja-JP-NanamiNeural', label: '七海 Nanami · 推荐女声' },
    { value: 'ja-JP-Nanami:DragonHDLatestNeural', label: '七海 Dragon HD · 区域可用性不同' },
    { value: 'ja-JP-AoiNeural', label: '葵 Aoi · 女声' },
    { value: 'ja-JP-ShioriNeural', label: '诗织 Shiori · 女声' },
    { value: 'ja-JP-KeitaNeural', label: '圭太 Keita · 男声' },
    { value: 'ja-JP-MasaruMultilingualNeural', label: '胜 Masaru · 多语男声' },
  ],
};

const testController = new SpeechController();

export function SettingsPanel({ plugin }: { plugin: RNPlugin }) {
  const [settings, setSettings] = useState<SpeechSettings>(DEFAULT_SETTINGS);
  const [azureKey, setAzureKey] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [testingLanguage, setTestingLanguage] = useState<SupportedLanguage | null>(null);

  useEffect(() => {
    void Promise.all([readSettings(plugin), readAzureKey(plugin)]).then(([savedSettings, savedKey]) => {
      setSettings(savedSettings);
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

  const updateVoiceMap = (
    field: 'browserVoices' | 'azureVoices' | 'clozeWords',
    language: SupportedLanguage,
    value: string,
  ) => {
    setSettings((current) => ({
      ...current,
      [field]: { ...current[field], [language]: value } as LanguageVoiceMap,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([writeSettings(plugin, settings), writeAzureKey(plugin, azureKey)]);
      await plugin.app.toast('Card Speech Studio 设置已保存。');
    } catch (error) {
      console.error('Card Speech Studio could not save settings.', error);
      await plugin.app.toast('设置保存失败，请稍后重试。');
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
      if (result.fallbackReason) await plugin.app.toast('Azure 不可用，本次试听使用了浏览器声音。');
    } catch (error) {
      console.error('Card Speech Studio voice test failed.', error);
      await plugin.app.toast('试听失败，请检查声音、Azure Key 和 Region。');
    } finally {
      setTestingLanguage(null);
    }
  };

  return (
    <main className="studio-settings">
      <header className="studio-hero">
        <div className="studio-hero__mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div>
          <p className="studio-kicker">CARD SPEECH STUDIO · 0.1</p>
          <h1>让每张卡片，开口说对语言。</h1>
          <p>中文、English、日本語独立选声；Chrome 也能通过 Azure 使用高质量晓晓。</p>
        </div>
        <button className="studio-close" type="button" onClick={() => plugin.widget.closePopup()} aria-label="关闭">
          ×
        </button>
      </header>

      <section className="studio-section studio-section--provider">
        <div className="studio-section__heading">
          <div>
            <span>01</span>
            <h2>声音来源</h2>
          </div>
          <label className="studio-switch">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
            />
            <span />
            启用插件
          </label>
        </div>

        <div className="provider-grid">
          <button
            type="button"
            className={settings.provider === 'browser' ? 'provider-card is-active' : 'provider-card'}
            onClick={() => setSettings({ ...settings, provider: 'browser' })}
          >
            <b>本机声音</b>
            <small>免费 · Chrome/Windows 已暴露的 voice</small>
            <em>LOCAL</em>
          </button>
          <button
            type="button"
            className={settings.provider === 'azure' ? 'provider-card is-active' : 'provider-card'}
            onClick={() => setSettings({ ...settings, provider: 'azure' })}
          >
            <b>Azure Neural</b>
            <small>晓晓、Nanami 等高质量在线语音</small>
            <em>PREMIUM</em>
          </button>
        </div>

        <div className="studio-note">
          <strong>为什么 Chrome 里找不到 Edge 的晓晓？</strong>
          Edge Online Natural voices 通常不会通过 Chrome 的 Web Speech API 暴露。Azure 模式使用微软官方 Speech 服务，效果稳定，但需要你自己的 Key，并可能产生 Azure 费用。
        </div>

        {settings.provider === 'azure' && (
          <div className="azure-credentials">
            <label>
              <span>Azure Speech Key</span>
              <input
                type="password"
                autoComplete="off"
                value={azureKey}
                onChange={(event) => setAzureKey(event.target.value)}
                placeholder="只保存在本机，不会同步"
              />
            </label>
            <label>
              <span>Region</span>
              <input
                type="text"
                value={settings.azureRegion}
                onChange={(event) => setSettings({ ...settings, azureRegion: event.target.value.trim() })}
                placeholder="例如 eastasia"
              />
            </label>
            <label className="studio-check">
              <input
                type="checkbox"
                checked={settings.fallbackToBrowser}
                onChange={(event) => setSettings({ ...settings, fallbackToBrowser: event.target.checked })}
              />
              Azure 失败时自动回退本机声音
            </label>
          </div>
        )}
      </section>

      <section className="studio-section">
        <div className="studio-section__heading">
          <div>
            <span>02</span>
            <h2>三语声线</h2>
          </div>
          <label className="default-language">
            无法判断时
            <select
              value={settings.defaultLanguage}
              onChange={(event) => setSettings({ ...settings, defaultLanguage: event.target.value as SupportedLanguage })}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </label>
        </div>

        <div className="language-grid">
          {(Object.keys(LANGUAGE_META) as SupportedLanguage[]).map((language) => {
            const meta = LANGUAGE_META[language];
            return (
              <article className="language-card" key={language} data-language={language}>
                <div className="language-card__top">
                  <div>
                    <small>{meta.locale}</small>
                    <h3>{meta.label}</h3>
                  </div>
                  <button type="button" onClick={() => void testVoice(language)} disabled={testingLanguage !== null}>
                    {testingLanguage === language ? '试听中…' : '试听'}
                  </button>
                </div>

                {settings.provider === 'azure' ? (
                  <label>
                    <span>Azure voice</span>
                    <select
                      value={settings.azureVoices[language]}
                      onChange={(event) => updateVoiceMap('azureVoices', language, event.target.value)}
                    >
                      {AZURE_VOICE_OPTIONS[language].map((voice) => (
                        <option key={voice.value} value={voice.value}>{voice.label}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    <span>Browser voice</span>
                    <select
                      value={settings.browserVoices[language]}
                      onChange={(event) => updateVoiceMap('browserVoices', language, event.target.value)}
                    >
                      <option value="">自动选择最佳可用声音</option>
                      {browserVoices[language].map((voice) => (
                        <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                          {voice.name} · {voice.lang}{voice.localService ? ' · Local' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label>
                  <span>Cloze 读法</span>
                  <input
                    type="text"
                    value={settings.clozeWords[language]}
                    onChange={(event) => updateVoiceMap('clozeWords', language, event.target.value)}
                  />
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <section className="studio-section studio-section--behavior">
        <div className="studio-section__heading">
          <div>
            <span>03</span>
            <h2>复习节奏</h2>
          </div>
        </div>

        <div className="behavior-grid">
          <label className="studio-check studio-check--large">
            <input
              type="checkbox"
              checked={settings.autoReadQuestion}
              onChange={(event) => setSettings({ ...settings, autoReadQuestion: event.target.checked })}
            />
            <span><b>问题面自动朗读</b><small>新卡片出现时开始</small></span>
          </label>
          <label className="studio-check studio-check--large">
            <input
              type="checkbox"
              checked={settings.autoReadAnswer}
              onChange={(event) => setSettings({ ...settings, autoReadAnswer: event.target.checked })}
            />
            <span><b>答案面自动朗读</b><small>翻面后开始</small></span>
          </label>
          <label className="studio-range">
            <span><b>语速</b><output>{settings.rate.toFixed(1)}×</output></span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.rate}
              onChange={(event) => setSettings({ ...settings, rate: Number(event.target.value) })}
            />
          </label>
          <label className="studio-range">
            <span><b>音量</b><output>{Math.round(settings.volume * 100)}%</output></span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(event) => setSettings({ ...settings, volume: Number(event.target.value) })}
            />
          </label>
        </div>
      </section>

      <footer className="studio-footer">
        <div>
          <strong>隐私提示</strong>
          <span>Azure 模式只发送正在朗读的文本；Key 仅保存在本机 RemNote storage。</span>
        </div>
        <button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? '保存中…' : '保存设置'}
        </button>
      </footer>
    </main>
  );
}
