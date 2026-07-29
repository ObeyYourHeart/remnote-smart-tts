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

test('enables question autoplay by default', () => {
  const settings = normalizeSettings({});

  assert.equal(settings.autoReadQuestion, true);
  assert.equal(settings.autoReadAnswer, false);
});

test('normalizes the bilingual interface language', () => {
  assert.equal(normalizeSettings({ uiLanguage: 'zh' }).uiLanguage, 'zh');
  assert.equal(normalizeSettings({ uiLanguage: 'en' }).uiLanguage, 'en');
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
