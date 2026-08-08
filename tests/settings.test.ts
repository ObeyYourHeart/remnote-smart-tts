import assert from 'node:assert/strict';
import test from 'node:test';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { NATIVE_SETTING_IDS, readNativeSettings } from '../src/core/nativeSettings';
import { normalizeSettings } from '../src/core/settings';

test('allows autoplay without an unavailable RemNote TTS interlock', () => {
  const settings = normalizeSettings({
    autoReadQuestion: false,
    autoReadAnswer: true,
  });

  assert.equal(settings.autoReadQuestion, false);
  assert.equal(settings.autoReadAnswer, true);
});

test('enables question and answer autoplay by default', () => {
  const settings = normalizeSettings({});

  assert.equal(settings.autoReadQuestion, true);
  assert.equal(settings.autoReadAnswer, true);
});

test('normalizes the bilingual interface language', () => {
  assert.equal(normalizeSettings({ uiLanguage: 'zh' }).uiLanguage, 'zh');
  assert.equal(normalizeSettings({ uiLanguage: 'en' }).uiLanguage, 'en');
});

test('preserves saved Azure voices from every model family', () => {
  const settings = normalizeSettings({
    azureVoices: {
      zh: 'zh-CN-XiaoxiaoNeural',
      en: 'en-US-JennyNeural',
      ja: 'ja-JP-Sakura:MAI-Voice-2-Flash',
    },
  });

  assert.equal(settings.azureVoices.zh, 'zh-CN-XiaoxiaoNeural');
  assert.equal(settings.azureVoices.en, 'en-US-JennyNeural');
  assert.equal(settings.azureVoices.ja, 'ja-JP-Sakura:MAI-Voice-2-Flash');
});

test('accepts the Edge Local provider with usable defaults', () => {
  const settings = normalizeSettings({ provider: 'edge-local' });

  assert.equal(settings.provider, 'edge-local');
  assert.equal(settings.edgeServerUrl, 'http://127.0.0.1:8765');
  assert.equal(settings.edgeVoices.zh, 'zh-CN-XiaoxiaoNeural');
  assert.equal(settings.edgeVoices.en, 'en-US-AriaNeural');
  assert.equal(settings.edgeVoices.ja, 'ja-JP-NanamiNeural');
});

test('preserves saved Edge Local server URL and voices', () => {
  const settings = normalizeSettings({
    provider: 'edge-local',
    edgeServerUrl: 'http://127.0.0.1:9000',
    edgeVoices: {
      zh: 'zh-CN-YunxiNeural',
      en: 'en-US-GuyNeural',
      ja: 'ja-JP-KeitaNeural',
    },
  });

  assert.equal(settings.edgeServerUrl, 'http://127.0.0.1:9000');
  assert.equal(settings.edgeVoices.zh, 'zh-CN-YunxiNeural');
  assert.equal(settings.edgeVoices.en, 'en-US-GuyNeural');
  assert.equal(settings.edgeVoices.ja, 'ja-JP-KeitaNeural');
});

test('rejects a remote Edge Local server URL', () => {
  const settings = normalizeSettings({
    provider: 'edge-local',
    edgeServerUrl: 'https://example.com/speech',
  });

  assert.equal(settings.edgeServerUrl, 'http://127.0.0.1:8765');
});

test('reads everyday controls from RemNote native plugin settings', async () => {
  const values = new Map<string, unknown>([
    [NATIVE_SETTING_IDS.uiLanguage, 'zh'],
    [NATIVE_SETTING_IDS.provider, 'azure'],
    [NATIVE_SETTING_IDS.autoplayMode, 'both'],
    [NATIVE_SETTING_IDS.volumePercent, 65],
    [NATIVE_SETTING_IDS.clozeZh, '哪个'],
  ]);
  const plugin = {
    settings: { getSetting: async (id: string) => values.get(id) },
  } as unknown as RNPlugin;

  const settings = await readNativeSettings(plugin);
  assert.equal(settings.uiLanguage, 'zh');
  assert.equal(settings.provider, 'azure');
  assert.equal(settings.autoReadQuestion, true);
  assert.equal(settings.autoReadAnswer, true);
  assert.equal(settings.volume, 0.65);
  assert.equal(settings.clozeWords?.zh, '哪个');
});
