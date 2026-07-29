import assert from 'node:assert/strict';
import test from 'node:test';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { NATIVE_SETTING_IDS, readNativeSettings } from '../src/core/nativeSettings';
import { normalizeSettings } from '../src/core/settings';

test('locks autoplay until RemNote official TTS is confirmed off', () => {
  const settings = normalizeSettings({
    autoReadQuestion: true,
    autoReadAnswer: true,
  });

  assert.equal(settings.officialTtsDisabledConfirmed, false);
  assert.equal(settings.autoReadQuestion, false);
  assert.equal(settings.autoReadAnswer, false);
});

test('allows autoplay after explicit conflict confirmation', () => {
  const settings = normalizeSettings({
    officialTtsDisabledConfirmed: true,
    autoReadQuestion: true,
    autoReadAnswer: true,
  });

  assert.equal(settings.autoReadQuestion, true);
  assert.equal(settings.autoReadAnswer, true);
});

test('enables question autoplay by default after the safety confirmation', () => {
  const settings = normalizeSettings({
    officialTtsDisabledConfirmed: true,
  });

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
    [NATIVE_SETTING_IDS.volumePercent, 65],
    [NATIVE_SETTING_IDS.clozeZh, '哪个'],
  ]);
  const plugin = {
    settings: { getSetting: async (id: string) => values.get(id) },
  } as unknown as RNPlugin;

  const settings = await readNativeSettings(plugin);
  assert.equal(settings.uiLanguage, 'zh');
  assert.equal(settings.provider, 'azure');
  assert.equal(settings.volume, 0.65);
  assert.equal(settings.clozeWords?.zh, '哪个');
});
