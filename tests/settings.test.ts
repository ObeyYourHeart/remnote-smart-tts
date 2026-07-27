import assert from 'node:assert/strict';
import test from 'node:test';
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
