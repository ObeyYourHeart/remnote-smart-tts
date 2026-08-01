import assert from 'node:assert/strict';
import test from 'node:test';
import type { CardType, Rem, RNPlugin } from '@remnote/plugin-sdk';
import { DEFAULT_SETTINGS } from '../src/core/settings';

// The RemNote SDK ships a browser bundle that expects `self`. Defining the
// browser worker global before the dynamic import keeps this integration test
// representative without adding a DOM emulator to the project.
(globalThis as typeof globalThis & { self?: typeof globalThis }).self = globalThis;

async function loadCardPlanner() {
  return (await import('../src/core/cards')).buildCardSpeechPlan;
}

function makeChild(text: string, isListItem: boolean, remId = ''): Rem {
  return {
    _id: remId,
    text: [text],
    isCardItem: async () => true,
    isListItem: async () => isListItem,
  } as unknown as Rem;
}

function makePlugin(
  rem: Rem,
  cardType: CardType = 'forward',
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

test('reads a Cloze in a Descriptor answer with its Concept and Descriptor', async () => {
  const conceptRem = {
    _id: 'chloroplast-cloze-concept',
    type: 1,
    text: ['叶绿体'],
  } as unknown as Rem;
  const descriptorRem = {
    _id: 'chloroplast-cloze-descriptor',
    type: 2,
    text: ['结构'],
    backText: [
      '基质中含有',
      { i: 'm', text: 'DNA', cId: 'descriptor-cloze' },
      '。',
    ],
    hasPowerup: async () => false,
    getParentRem: async () => conceptRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(descriptorRem, { clozeId: 'descriptor-cloze' }),
    { remId: descriptorRem._id, cardId: 'descriptor-cloze-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'cloze');
  assert.equal(plan?.question.text, '叶绿体的结构。基质中含有 什么。');
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), ['叶绿体的结构', '基质中含有 什么。']);
  assert.equal(plan?.answer.text, '叶绿体的结构。基质中含有DNA。');
  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), ['叶绿体的结构', '基质中含有DNA。']);
});

test('joins a Descriptor value Cloze to its Concept with a natural copula', async () => {
  const conceptRem = {
    _id: 'protein-concept',
    type: 1,
    text: ['蛋白质'],
  } as unknown as Rem;
  const descriptorRem = {
    _id: 'denaturation-conditions-descriptor',
    type: 2,
    text: ['变性条件'],
    backText: [
      { i: 'm', text: '高温', cId: 'heat-cloze' },
      '、',
      { i: 'm', text: '过酸', cId: 'acid-cloze' },
      '、',
      { i: 'm', text: '过碱', cId: 'alkali-cloze' },
      '和',
      { i: 'm', text: '重金属盐', cId: 'heavy-metal-cloze' },
    ],
    hasPowerup: async () => false,
    getParentRem: async () => conceptRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(descriptorRem, { clozeId: 'heavy-metal-cloze' }),
    { remId: descriptorRem._id, cardId: 'conditions-cloze-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'cloze');
  assert.equal(plan?.question.text, '蛋白质的变性条件是高温、过酸、过碱和什么');
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), [
    '蛋白质的变性条件是高温、过酸、过碱和什么',
  ]);
  assert.equal(plan?.answer.text, '蛋白质的变性条件是高温、过酸、过碱和重金属盐');
});

test('inherits a complete Concept and Descriptor path for a child Cloze Rem', async () => {
  const conceptRem = {
    _id: 'cell-concept',
    type: 1,
    text: ['细胞'],
  } as unknown as Rem;
  const structureRem = {
    _id: 'cell-structure',
    type: 2,
    text: ['结构'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const nucleusRem = {
    _id: 'cell-nucleus',
    type: 2,
    text: ['细胞核'],
    getParentRem: async () => structureRem,
  } as unknown as Rem;
  const clozeRem = {
    _id: 'cell-cloze-child',
    type: 0,
    text: [
      '主要储存',
      { i: 'm', text: '遗传物质', cId: 'child-cloze' },
      '。',
    ],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => nucleusRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(clozeRem, { clozeId: 'child-cloze' }),
    { remId: clozeRem._id, cardId: 'child-cloze-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.question.text, '细胞的结构的细胞核。主要储存 什么。');
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), ['细胞的结构的细胞核', '主要储存 什么。']);
  assert.equal(plan?.answer.text, '细胞的结构的细胞核。主要储存遗传物质。');
});

test('keeps the front of an ordinary A/B Rem whose Cloze is in the answer', async () => {
  const conceptRem = {
    _id: 'ribosome-concept',
    type: 1,
    text: ['核糖体'],
  } as unknown as Rem;
  const locationRem = {
    _id: 'ribosome-location',
    type: 2,
    text: ['位置不同'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const clozeRem = {
    _id: 'rough-er-cloze',
    type: 0,
    text: ['附着在粗面内质网'],
    backText: [
      '主要和',
      { i: 'm', text: '蛋白质', cId: 'protein-cloze' },
      '的合成有关',
    ],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => locationRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(clozeRem, { clozeId: 'protein-cloze' }),
    { remId: clozeRem._id, cardId: 'protein-cloze-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(
    plan?.question.text,
    '核糖体的位置不同。附着在粗面内质网。主要和 什么 的合成有关',
  );
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), [
    '核糖体的位置不同',
    '附着在粗面内质网',
    '主要和 什么 的合成有关',
  ]);
  assert.equal(
    plan?.answer.text,
    '核糖体的位置不同。附着在粗面内质网。主要和蛋白质的合成有关',
  );
});

test('reads a direct Concept child Cloze as one contextual speech plan', async () => {
  const conceptRem = {
    _id: 'direct-ribosome-concept',
    type: 1,
    text: ['核糖体'],
  } as unknown as Rem;
  const clozeRem = {
    _id: 'direct-ribosome-cloze',
    type: 0,
    text: [
      '主要参与',
      { i: 'm', text: '蛋白质', cId: 'direct-concept-cloze' },
      '的合成',
    ],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => conceptRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(clozeRem, { clozeId: 'direct-concept-cloze' }),
    { remId: clozeRem._id, cardId: 'direct-concept-cloze-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.question.text, '核糖体。主要参与 什么 的合成');
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), ['核糖体', '主要参与 什么 的合成']);
  assert.equal(plan?.answer.text, '核糖体。主要参与蛋白质的合成');
  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), ['核糖体', '主要参与蛋白质的合成']);
});

test('keeps direct Concept child Clozes contextual in English and Japanese', async () => {
  const cases = [
    {
      concept: 'ribosome',
      sentenceStart: 'It makes ',
      answer: 'proteins',
      sentenceEnd: '.',
      question: 'ribosome. It makes what.',
      completed: 'ribosome. It makes proteins.',
    },
    {
      concept: 'リボソーム',
      sentenceStart: '主に',
      answer: 'タンパク質',
      sentenceEnd: 'を合成します。',
      question: 'リボソーム。主に なに を合成します。',
      completed: 'リボソーム。主にタンパク質を合成します。',
    },
  ];

  const buildCardSpeechPlan = await loadCardPlanner();
  for (const [index, currentCase] of cases.entries()) {
    const conceptRem = {
      _id: `direct-concept-${index}`,
      type: 1,
      text: [currentCase.concept],
    } as unknown as Rem;
    const clozeId = `direct-cloze-${index}`;
    const clozeRem = {
      _id: `direct-child-${index}`,
      type: 0,
      text: [
        currentCase.sentenceStart,
        { i: 'm', text: currentCase.answer, cId: clozeId },
        currentCase.sentenceEnd,
      ],
      backText: [],
      hasPowerup: async () => false,
      isCardItem: async () => false,
      getParentRem: async () => conceptRem,
    } as unknown as Rem;

    const plan = await buildCardSpeechPlan(
      makePlugin(clozeRem, { clozeId }),
      { remId: clozeRem._id, cardId: `${clozeId}-card`, revealed: false },
      DEFAULT_SETTINGS,
    );

    assert.equal(plan?.question.text, currentCase.question);
    assert.equal(plan?.answer.text, currentCase.completed);
  }
});

test('marks a Chinese Concept and English Cloze sentence with different voices', async () => {
  const conceptRem = {
    _id: 'mixed-language-concept',
    type: 1,
    text: ['核糖体'],
  } as unknown as Rem;
  const clozeRem = {
    _id: 'mixed-language-cloze',
    type: 0,
    text: [
      'It makes ',
      { i: 'm', text: 'proteins', cId: 'mixed-language-cloze-id' },
      '.',
    ],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => conceptRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(clozeRem, { clozeId: 'mixed-language-cloze-id' }),
    { remId: clozeRem._id, cardId: 'mixed-language-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.deepEqual(plan?.question.segments, [
    { text: '核糖体', language: 'zh' },
    { text: 'It makes what.', language: 'en' },
  ]);
  assert.deepEqual(plan?.answer.segments, [
    { text: '核糖体', language: 'zh' },
    { text: 'It makes proteins.', language: 'en' },
  ]);
});

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
  assert.equal(plan?.question.text, '估值指标包括什么？');
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

test('reads an unmarked ordinary List-Answer card from direct ordered items', async () => {
  const rem = {
    _id: 'elephant-order',
    type: 0,
    text: ['把大象放入冰箱的顺序'],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getChildrenRem: async () => [
      makeChild('打开冰箱门', true),
      makeChild('把大象放进去', true),
      makeChild('关上冰箱门', true),
    ],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rem),
    { remId: 'elephant-order', cardId: 'elephant-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'list-answer-forward');
  assert.equal(plan?.question.text, '把大象放入冰箱的顺序');
  assert.equal(plan?.answer.segments?.length, 4);
});

test('uses the queue-tracked index when RemNote keeps the parent card identity', async () => {
  const rem = {
    _id: 'tracked-elephant-order',
    type: 0,
    text: ['把大象放入冰箱的顺序'],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getChildrenRem: async () => [
      makeChild('打开冰箱门', true, 'tracked-child-1'),
      makeChild('把大象放进去', true, 'tracked-child-2'),
      makeChild('关上冰箱门', true, 'tracked-child-3'),
    ],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rem),
    { remId: 'tracked-elephant-order', cardId: 'tracked-parent-card', revealed: true },
    DEFAULT_SETTINGS,
    { structuredItemIndex: 1 },
  );

  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), ['第二，把大象放进去。']);
  assert.equal(plan?.answer.text, '第二，把大象放进去。');
  assert.equal(plan?.question.text, '把大象放入冰箱的第二步是什么？');
});

test('climbs from an ordered child when the parent powerup is omitted', async () => {
  const parentRem = {
    _id: 'unmarked-list-parent',
    type: 0,
    text: ['把大象放入冰箱的顺序'],
    backText: [],
    hasPowerup: async () => false,
    getChildrenRem: async () => [
      makeChild('打开冰箱门', true, 'ordered-child-1'),
      makeChild('把大象放进去', true, 'ordered-child-2'),
      makeChild('关上冰箱门', true, 'ordered-child-3'),
    ],
  } as unknown as Rem;
  const queueChildRem = {
    _id: 'ordered-child-2',
    type: 0,
    text: ['把大象放进去'],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => true,
    getParentRem: async () => parentRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(queueChildRem, 'forward', queueChildRem),
    { remId: 'ordered-child-2', cardId: 'ordered-child-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'list-answer-forward');
  assert.equal(plan?.question.text, '把大象放入冰箱的第二步是什么？');
  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), ['第二，把大象放进去。']);
  assert.equal(plan?.answer.text, '第二，把大象放进去。');
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
  assert.equal(plan?.question.text, '市盈率的用途包括什么？');
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
  assert.equal(plan?.question.text, '市销率的缺陷包括什么？');
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
  assert.equal(plan?.question.text, '市销率的缺陷包括什么？');
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

test('reads a normal Descriptor through every ancestor back to its Concept', async () => {
  const conceptRem = { _id: 'chloroplast', type: 1, text: ['叶绿体'] } as unknown as Rem;
  const structureRem = {
    _id: 'structure',
    type: 2,
    text: ['结构'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const granumRem = {
    _id: 'granum',
    type: 2,
    text: ['基粒'],
    backText: ['由类囊体堆叠形成'],
    hasPowerup: async () => false,
    getParentRem: async () => structureRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(granumRem),
    { remId: 'granum', cardId: 'granum-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'descriptor-forward');
  assert.equal(plan?.question.text, '叶绿体的结构的基粒是什么？');
  assert.equal(plan?.answer.text, '叶绿体的结构的基粒是由类囊体堆叠形成');
});

test('keeps a complete deep Descriptor path in a Multi-Line prompt', async () => {
  const conceptRem = { _id: 'chloroplast-deep', type: 1, text: ['叶绿体'] } as unknown as Rem;
  const structureRem = {
    _id: 'structure-deep',
    type: 2,
    text: ['结构'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const granumRem = {
    _id: 'granum-deep',
    type: 2,
    text: ['基粒'],
    getParentRem: async () => structureRem,
  } as unknown as Rem;
  const compositionRem = {
    _id: 'composition-deep',
    type: 2,
    text: ['组成'],
    backText: [],
    hasPowerup: async () => true,
    getParentRem: async () => granumRem,
    getChildrenRem: async () => [
      makeChild('类囊体', false, 'thylakoid'),
      makeChild('叶绿素', false, 'chlorophyll'),
    ],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(compositionRem),
    { remId: 'composition-deep', cardId: 'composition-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'multi-line-forward');
  assert.equal(plan?.question.text, '叶绿体的结构的基粒的组成包括什么？');
  assert.equal(plan?.answer.text, '叶绿体的结构的基粒的组成包括：类囊体；叶绿素。');
});

test('keeps a complete deep Descriptor path in an ordered question', async () => {
  const conceptRem = { _id: 'chloroplast-order', type: 1, text: ['叶绿体'] } as unknown as Rem;
  const structureRem = {
    _id: 'structure-order',
    type: 2,
    text: ['结构'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const photosynthesisRem = {
    _id: 'photosynthesis-order',
    type: 2,
    text: ['光反应'],
    getParentRem: async () => structureRem,
  } as unknown as Rem;
  const stepsRem = {
    _id: 'steps-order',
    type: 2,
    text: ['步骤'],
    backText: [],
    hasPowerup: async () => true,
    getParentRem: async () => photosynthesisRem,
    getChildrenRem: async () => [
      makeChild('吸收光能', true, 'light-step-1'),
      makeChild('产生能量载体', true, 'light-step-2'),
    ],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(stepsRem),
    { remId: 'steps-order', cardId: 'steps-card', revealed: true },
    DEFAULT_SETTINGS,
    { structuredItemIndex: 1 },
  );

  assert.equal(plan?.kind, 'list-answer-forward');
  assert.equal(plan?.question.text, '叶绿体的结构的光反应的第二步是什么？');
  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), ['第二，产生能量载体。']);
});

test('keeps CDF context for an ordinary A/B leaf below nested Descriptors', async () => {
  const conceptRem = { _id: 'ribosome-ab-concept', type: 1, text: ['核糖体'] } as unknown as Rem;
  const locationRem = {
    _id: 'ribosome-ab-location',
    type: 2,
    text: ['位置不同'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const ordinaryRem = {
    _id: 'ribosome-ab-leaf',
    type: 0,
    text: ['附着在粗面内质网'],
    backText: ['主要参与蛋白质的合成'],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => locationRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(ordinaryRem),
    { remId: ordinaryRem._id, cardId: 'ribosome-ab-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'forward');
  assert.equal(plan?.question.text, '核糖体的位置不同。附着在粗面内质网');
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), [
    '核糖体的位置不同',
    '附着在粗面内质网',
  ]);
  assert.equal(
    plan?.answer.text,
    '核糖体的位置不同。附着在粗面内质网。主要参与蛋白质的合成',
  );
});

test('keeps ordinary grouping Rems between a CDF path and a Cloze', async () => {
  const conceptRem = { _id: 'ribosome-group-concept', type: 1, text: ['核糖体'] } as unknown as Rem;
  const locationRem = {
    _id: 'ribosome-group-location',
    type: 2,
    text: ['位置不同'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const groupRem = {
    _id: 'ribosome-grouping-rem',
    type: 0,
    text: ['附着方式'],
    getParentRem: async () => locationRem,
  } as unknown as Rem;
  const clozeRem = {
    _id: 'ribosome-group-cloze',
    type: 0,
    text: [
      '主要和',
      { i: 'm', text: '蛋白质', cId: 'grouped-protein-cloze' },
      '的合成有关',
    ],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => groupRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(clozeRem, { clozeId: 'grouped-protein-cloze' }),
    { remId: clozeRem._id, cardId: 'grouped-protein-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(
    plan?.question.text,
    '核糖体的位置不同。附着方式。主要和 什么 的合成有关',
  );
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), [
    '核糖体的位置不同',
    '附着方式',
    '主要和 什么 的合成有关',
  ]);
  assert.equal(
    plan?.answer.text,
    '核糖体的位置不同。附着方式。主要和蛋白质的合成有关',
  );
});

test('keeps CDF context for a normal Multi-Line group below a Descriptor', async () => {
  const conceptRem = { _id: 'ps-context-concept', type: 1, text: ['市销率'] } as unknown as Rem;
  const defectsRem = {
    _id: 'ps-context-defects',
    type: 2,
    text: ['缺陷'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const examplesRem = {
    _id: 'ps-context-examples',
    type: 0,
    text: ['常见表现'],
    backText: [],
    hasPowerup: async () => true,
    isCardItem: async () => false,
    getParentRem: async () => defectsRem,
    getChildrenRem: async () => [
      makeChild('忽视利润水平', false, 'ps-example-1'),
      makeChild('不考虑负债水平', false, 'ps-example-2'),
    ],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(examplesRem),
    { remId: examplesRem._id, cardId: 'ps-context-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'multi-line-forward');
  assert.equal(plan?.question.text, '市销率的缺陷。常见表现包括什么？');
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), [
    '市销率的缺陷',
    '常见表现包括什么？',
  ]);
  assert.equal(
    plan?.answer.text,
    '市销率的缺陷。常见表现包括：忽视利润水平；不考虑负债水平。',
  );
  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), [
    '市销率的缺陷',
    '常见表现包括以下内容。',
    '忽视利润水平。',
    '不考虑负债水平。',
  ]);
});

test('keeps CDF context for a normal ordered group below a Descriptor', async () => {
  const conceptRem = { _id: 'cycle-context-concept', type: 1, text: ['光合作用'] } as unknown as Rem;
  const lightReactionRem = {
    _id: 'cycle-context-descriptor',
    type: 2,
    text: ['光反应'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const processRem = {
    _id: 'cycle-context-process',
    type: 0,
    text: ['能量转换过程'],
    backText: [],
    hasPowerup: async () => true,
    isCardItem: async () => false,
    getParentRem: async () => lightReactionRem,
    getChildrenRem: async () => [
      makeChild('吸收光能', true, 'cycle-step-1'),
      makeChild('产生能量载体', true, 'cycle-step-2'),
    ],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(processRem),
    { remId: processRem._id, cardId: 'cycle-context-card', revealed: false },
    DEFAULT_SETTINGS,
    { structuredItemIndex: 1 },
  );

  assert.equal(plan?.kind, 'list-answer-forward');
  assert.equal(plan?.question.text, '光合作用的光反应。能量转换过程的第二步是什么？');
  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), [
    '光合作用的光反应',
    '能量转换过程的第二步是什么？',
  ]);
  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), [
    '光合作用的光反应',
    '第二，产生能量载体。',
  ]);
});

test('keeps CDF context for ordinary A/B cards in English and Japanese', async () => {
  const cases = [
    {
      concept: 'chloroplast',
      descriptor: 'structure',
      front: 'granum',
      back: 'a stack of thylakoids',
      question: 'the structure of chloroplast. granum',
      answer: 'the structure of chloroplast. granum. a stack of thylakoids',
    },
    {
      concept: '葉緑体',
      descriptor: '構造',
      front: 'グラナ',
      back: 'チラコイドが積み重なったもの',
      question: '葉緑体の構造。グラナ',
      answer: '葉緑体の構造。グラナ。チラコイドが積み重なったもの',
    },
  ] as const;

  const buildCardSpeechPlan = await loadCardPlanner();
  for (const [index, cardCase] of cases.entries()) {
    const conceptRem = {
      _id: `localized-concept-${index}`,
      type: 1,
      text: [cardCase.concept],
    } as unknown as Rem;
    const descriptorRem = {
      _id: `localized-descriptor-${index}`,
      type: 2,
      text: [cardCase.descriptor],
      getParentRem: async () => conceptRem,
    } as unknown as Rem;
    const ordinaryRem = {
      _id: `localized-leaf-${index}`,
      type: 0,
      text: [cardCase.front],
      backText: [cardCase.back],
      hasPowerup: async () => false,
      isCardItem: async () => false,
      getParentRem: async () => descriptorRem,
    } as unknown as Rem;

    const plan = await buildCardSpeechPlan(
      makePlugin(ordinaryRem),
      { remId: ordinaryRem._id, cardId: `localized-card-${index}`, revealed: false },
      DEFAULT_SETTINGS,
    );

    assert.equal(plan?.question.text, cardCase.question);
    assert.equal(plan?.answer.text, cardCase.answer);
  }
});

test('keeps CDF context when an ordinary A/B card is tested backward', async () => {
  const conceptRem = { _id: 'reverse-concept', type: 1, text: ['市盈率'] } as unknown as Rem;
  const descriptorRem = {
    _id: 'reverse-descriptor',
    type: 2,
    text: ['影响因素'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const ordinaryRem = {
    _id: 'reverse-leaf',
    type: 0,
    text: ['无风险利率'],
    backText: ['通常呈反向影响'],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => descriptorRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(ordinaryRem, 'backward'),
    { remId: ordinaryRem._id, cardId: 'reverse-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.question.text, '市盈率的影响因素。通常呈反向影响');
  assert.equal(plan?.answer.text, '市盈率的影响因素。无风险利率');
});

test('keeps later Descriptor-looking levels separate after an ordinary CDF group', async () => {
  const conceptRem = { _id: 'irregular-concept', type: 1, text: ['核糖体'] } as unknown as Rem;
  const locationRem = {
    _id: 'irregular-location',
    type: 2,
    text: ['位置'],
    getParentRem: async () => conceptRem,
  } as unknown as Rem;
  const groupRem = {
    _id: 'irregular-group',
    type: 0,
    text: ['附着类型'],
    getParentRem: async () => locationRem,
  } as unknown as Rem;
  const laterDescriptorRem = {
    _id: 'irregular-later-descriptor',
    type: 2,
    text: ['主要作用'],
    getParentRem: async () => groupRem,
  } as unknown as Rem;
  const clozeRem = {
    _id: 'irregular-cloze',
    type: 0,
    text: ['参与', { i: 'm', text: '蛋白质', cId: 'irregular-cloze-id' }, '合成'],
    backText: [],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => laterDescriptorRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(clozeRem, { clozeId: 'irregular-cloze-id' }),
    { remId: clozeRem._id, cardId: 'irregular-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), [
    '核糖体的位置',
    '附着类型',
    '主要作用',
    '参与 什么 合成',
  ]);
});

test('reads card-item descendants through ordinary grouping Rems', async () => {
  const marketGroup = {
    _id: 'risk-market-group',
    type: 0,
    text: ['市场风险'],
    isCardItem: async () => false,
    getChildrenRem: async () => [
      makeChild('利率风险', false, 'interest-risk'),
      makeChild('汇率风险', false, 'currency-risk'),
    ],
  } as unknown as Rem;
  const rootRem = {
    _id: 'risk-root',
    type: 0,
    text: ['风险分类'],
    backText: [],
    hasPowerup: async () => true,
    isCardItem: async () => false,
    getChildrenRem: async () => [marketGroup],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rootRem),
    { remId: rootRem._id, cardId: 'risk-card', revealed: true },
    DEFAULT_SETTINGS,
  );

  assert.equal(plan?.kind, 'multi-line-forward');
  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), [
    '答案包括以下内容。',
    '市场风险：利率风险。',
    '市场风险：汇率风险。',
  ]);
});

test('clamps an out-of-range ordered index instead of reading every item', async () => {
  const rootRem = {
    _id: 'bounded-order-root',
    type: 0,
    text: ['实验步骤'],
    backText: [],
    hasPowerup: async () => true,
    isCardItem: async () => false,
    getChildrenRem: async () => [
      makeChild('准备样品', true, 'bounded-step-1'),
      makeChild('加入试剂', true, 'bounded-step-2'),
      makeChild('记录结果', true, 'bounded-step-3'),
    ],
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(rootRem),
    { remId: rootRem._id, cardId: 'bounded-order-card', revealed: true },
    DEFAULT_SETTINGS,
    { structuredItemIndex: 99 },
  );

  assert.equal(plan?.question.text, '实验的第三步是什么？');
  assert.deepEqual(plan?.answer.segments?.map((segment) => segment.text), [
    '第三，记录结果。',
  ]);
});

test('does not drop a short CDF context that is only a word prefix', async () => {
  const conceptRem = {
    _id: 'structure-prefix-concept',
    type: 1,
    text: ['结构'],
  } as unknown as Rem;
  const ordinaryRem = {
    _id: 'structure-prefix-leaf',
    type: 0,
    text: ['结构性风险需要单独评估'],
    backText: ['需要检查期限错配'],
    hasPowerup: async () => false,
    isCardItem: async () => false,
    getParentRem: async () => conceptRem,
  } as unknown as Rem;

  const buildCardSpeechPlan = await loadCardPlanner();
  const plan = await buildCardSpeechPlan(
    makePlugin(ordinaryRem),
    { remId: ordinaryRem._id, cardId: 'structure-prefix-card', revealed: false },
    DEFAULT_SETTINGS,
  );

  assert.deepEqual(plan?.question.segments?.map((segment) => segment.text), [
    '结构',
    '结构性风险需要单独评估',
  ]);
});
