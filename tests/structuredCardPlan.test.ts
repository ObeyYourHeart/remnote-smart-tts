import assert from 'node:assert/strict';
import test from 'node:test';
import type { Rem, RNPlugin } from '@remnote/plugin-sdk';
import { DEFAULT_SETTINGS } from '../src/core/settings';

// The RemNote SDK ships a browser bundle that expects `self`. Defining the
// browser worker global before the dynamic import keeps this integration test
// representative without adding a DOM emulator to the project.
(globalThis as typeof globalThis & { self?: typeof globalThis }).self = globalThis;

async function loadCardPlanner() {
  return (await import('../src/core/cards')).buildCardSpeechPlan;
}

function makeChild(text: string, isListItem: boolean): Rem {
  return {
    text: [text],
    isCardItem: async () => true,
    isListItem: async () => isListItem,
  } as unknown as Rem;
}

function makePlugin(rem: Rem, cardType: 'forward' | 'backward' = 'forward'): RNPlugin {
  return {
    card: { findOne: async () => ({ getType: async () => cardType }) },
    rem: { findOne: async () => rem },
  } as unknown as RNPlugin;
}

test('builds a Concept Multi-Line plan even when the parent has no back text', async () => {
  const rem = {
    type: 1,
    text: ['估值指标'],
    backText: [],
    hasPowerup: async () => true,
    getChildrenRem: async () => [makeChild('市盈率', false), makeChild('市净率', false)],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rem),
    { remId: 'rem-1', cardId: 'card-1', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'multi-line-forward');
  assert.equal(plan?.question.text, '估值指标是什么？');
  assert.equal(plan?.answer.text, '估值指标包括：市盈率；市净率。');
});

test('builds an ordered List-Answer plan from direct list card items', async () => {
  const rem = {
    type: 0,
    text: ['研究步骤'],
    backText: [],
    hasPowerup: async () => true,
    getChildrenRem: async () => [makeChild('收集数据', true), makeChild('复核结果', true)],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rem),
    { remId: 'rem-2', cardId: 'card-2', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'list-answer-forward');
  assert.equal(plan?.question.text, '研究步骤');
  assert.equal(plan?.answer.text, '答案依次包括：第一，收集数据；第二，复核结果。');
});

test('keeps the parent Concept in a structured Descriptor prompt', async () => {
  const parentRem = { type: 1, text: ['市盈率'] } as unknown as Rem;
  const rem = {
    type: 2,
    text: ['用途'],
    backText: [],
    hasPowerup: async () => true,
    getParentRem: async () => parentRem,
    getChildrenRem: async () => [makeChild('公司估值', false), makeChild('同业比较', false)],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rem),
    { remId: 'rem-4', cardId: 'card-4', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'multi-line-forward');
  assert.equal(plan?.question.text, '市盈率的用途是什么？');
  assert.equal(plan?.answer.text, '市盈率的用途包括：公司估值；同业比较。');
});

test('does not invent a structure when the Multi-Line marker is absent', async () => {
  const rem = {
    type: 0,
    text: ['Question'],
    backText: ['Answer'],
    hasPowerup: async () => false,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rem),
    { remId: 'rem-3', cardId: 'card-3', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'forward');
  assert.equal(plan?.answer.text, 'Answer');
});
