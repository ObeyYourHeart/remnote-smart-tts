import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOrderedItemQuestion,
  buildStructuredAnswer,
  buildStructuredAnswerSegments,
} from '../src/core/structuredCards';

test('builds localized questions for each tested ordered item', () => {
  assert.equal(
    buildOrderedItemQuestion('把大象放入冰箱的顺序', 0, 'zh'),
    '把大象放入冰箱的第一步是什么？',
  );
  assert.equal(
    buildOrderedItemQuestion('Steps to put an elephant in a refrigerator', 1, 'en'),
    'What is the second step to put an elephant in a refrigerator?',
  );
  assert.equal(
    buildOrderedItemQuestion('象を冷蔵庫に入れる手順', 2, 'ja'),
    '象を冷蔵庫に入れるための第3ステップは何ですか？',
  );
});

test('reads Chinese Multi-Line children as an unordered set', () => {
  assert.equal(
    buildStructuredAnswer('市盈率的用途', ['估值。', '同业比较'], 'multi-line', 'zh'),
    '市盈率的用途包括：估值；同业比较。',
  );
});

test('reads Chinese List-Answer children in their stored order', () => {
  assert.equal(
    buildStructuredAnswer(undefined, ['收集数据', '计算指标', '复核结果'], 'list-answer', 'zh'),
    '答案依次包括：第一，收集数据；第二，计算指标；第三，复核结果。',
  );
});

test('uses English list ordinals in one utterance', () => {
  assert.equal(
    buildStructuredAnswer('The process', ['Collect data.', 'Check results.'], 'list-answer', 'en'),
    'The process includes, in order: First, Collect data; Second, Check results.',
  );
});

test('uses a Japanese set template', () => {
  assert.equal(
    buildStructuredAnswer('構成要素', ['売上', '費用'], 'multi-line', 'ja'),
    '構成要素には、売上；費用が含まれます。',
  );
});

test('drops blank children instead of speaking empty items', () => {
  assert.equal(
    buildStructuredAnswer(undefined, ['first', ' ', 'third'], 'multi-line', 'en'),
    'The answer includes: first; third.',
  );
});

test('creates one independently spoken segment per Multi-Line answer item', () => {
  assert.deepEqual(
    buildStructuredAnswerSegments(
      '市销率的缺陷',
      ['忽视利润水平，只看收入', '易受季节性波动影响', '不考虑资本结构'],
      'multi-line',
      'zh',
    ),
    [
      '市销率的缺陷包括以下内容。',
      '忽视利润水平，只看收入。',
      '易受季节性波动影响。',
      '不考虑资本结构。',
    ],
  );
});
