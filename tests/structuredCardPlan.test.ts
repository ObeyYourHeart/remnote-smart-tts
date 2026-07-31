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

function makePlugin(
  rem: Rem,
  cardType: 'forward' | 'backward' = 'forward',
  cardRem: Rem = rem,
): RNPlugin {
  const cardRemId = cardRem._id || 'card-rem';
  return {
    card: {
      findOne: async () => ({
        _id: 'resolved-card',
        remId: cardRemId,
        getType: async () => cardType,
        getRem: async () => cardRem,
      }),
    },
    rem: { findOne: async (id: string) => id === cardRemId ? cardRem : rem },
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

test('reads an unmarked Descriptor with direct Multi-Line answer items', async () => {
  const parentRem = { type: 1, text: ['市销率'] } as unknown as Rem;
  const rem = {
    _id: 'descriptor-defects',
    type: 2,
    text: ['缺陷'],
    backText: [],
    hasPowerup: async () => false,
    getParentRem: async () => parentRem,
    getChildrenRem: async () => [
      makeChild('忽视利润水平，只看收入', false),
      makeChild('易受会计政策和季节性波动影响', false),
      makeChild('不考虑资本结构和负债水平', false),
    ],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rem),
    { remId: 'descriptor-defects', cardId: 'defects-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'multi-line-forward');
  assert.equal(plan?.question.text, '市销率的缺陷是什么？');
  assert.equal(
    plan?.answer.text,
    '市销率的缺陷包括：忽视利润水平，只看收入；易受会计政策和季节性波动影响；不考虑资本结构和负债水平。',
  );
});

test('does not invent a structure when the Multi-Line marker is absent', async () => {
  const rem = {
    type: 0,
    text: ['Question'],
    backText: ['Answer'],
    hasPowerup: async () => false,
    getParentRem: async () => undefined,
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

test('builds a Multi-Line plan when FlashcardUnder omits cardId', async () => {
  const parentRem = {
    _id: 'parent-no-card-id',
    type: 0,
    text: ['风险因素'],
    backText: [],
    hasPowerup: async () => true,
    getChildrenRem: async () => [makeChild('市场风险', false), makeChild('信用风险', false)],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(parentRem),
    { remId: 'parent-no-card-id', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.cardId, 'rem:parent-no-card-id');
  assert.equal(plan?.kind, 'multi-line-forward');
  assert.equal(plan?.answer.text, '答案包括：市场风险；信用风险。');
});

test('climbs from a queue child Rem to its Multi-Line parent', async () => {
  const parentRem = {
    _id: 'multi-line-parent',
    type: 0,
    text: ['市销率的缺陷'],
    backText: [],
    hasPowerup: async () => true,
    getChildrenRem: async () => [
      makeChild('忽视利润水平', false),
      makeChild('易受季节波动影响', false),
    ],
  } as unknown as Rem;
  const queueChildRem = {
    _id: 'queue-child',
    type: 0,
    text: ['忽视利润水平'],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => true,
    getParentRem: async () => parentRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(queueChildRem, 'forward', queueChildRem),
    { remId: 'queue-child', cardId: 'child-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'multi-line-forward');
  assert.equal(plan?.question.text, '市销率的缺陷');
  assert.equal(plan?.answer.text, '答案包括：忽视利润水平；易受季节波动影响。');
});

test('keeps a Descriptor card when its Concept parent owns Multi-Line cards', async () => {
  const conceptRem = {
    _id: 'concept-parent',
    type: 1,
    text: ['市销率'],
    backText: [],
    hasPowerup: async () => true,
  } as unknown as Rem;
  const descriptorRem = {
    _id: 'descriptor-card',
    type: 2,
    text: ['算法'],
    backText: ['市销率 = 市值 ÷ 营业收入'],
    hasPowerup: async () => false,
    isCardItem: async () => true,
    getParentRem: async () => conceptRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(conceptRem, 'forward', descriptorRem),
    { remId: 'concept-parent', cardId: 'descriptor-flashcard', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'descriptor-forward');
  assert.equal(plan?.question.text, '市销率的算法是什么？');
  assert.equal(plan?.answer.text, '市销率的算法是市销率 = 市值 ÷ 营业收入');
});
