import assert from 'node:assert/strict';
import test from 'node:test';
import { createCardPlanCacheKey } from '../src/core/cardPlanCache';
import { DEFAULT_SETTINGS } from '../src/core/settings';

test('reuses one plan across question and answer reveal states', () => {
  const questionKey = createCardPlanCacheKey('card-1:rem-1', 0, DEFAULT_SETTINGS);
  const answerKey = createCardPlanCacheKey('card-1:rem-1', 0, DEFAULT_SETTINGS);
  assert.equal(questionKey, answerKey);
});

test('invalidates a plan for another ordered item or Cloze language setting', () => {
  const original = createCardPlanCacheKey('card-1:rem-1', 0, DEFAULT_SETTINGS);
  const nextItem = createCardPlanCacheKey('card-1:rem-1', 1, DEFAULT_SETTINGS);
  const changedClozeWord = createCardPlanCacheKey('card-1:rem-1', 0, {
    ...DEFAULT_SETTINGS,
    clozeWords: { ...DEFAULT_SETTINGS.clozeWords, en: 'which thing' },
  });

  assert.notEqual(original, nextItem);
  assert.notEqual(original, changedClozeWord);
});
