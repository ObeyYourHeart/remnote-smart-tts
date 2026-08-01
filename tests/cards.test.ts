import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConceptSpeech } from '../src/core/concept';

test('turns a Chinese Concept into a natural question and complete answer', () => {
  const speech = buildConceptSpeech(
    '市盈率',
    '衡量公司股价相对于每股收益的倍数的财务指标。',
    'zh',
  );

  assert.equal(speech.question, '市盈率是什么？');
  assert.equal(speech.answer, '市盈率是衡量公司股价相对于每股收益的倍数的财务指标。');
  assert.equal(speech.backwardAnswer, '这个概念是市盈率。');
});

test('does not repeat the linking word in a Chinese Concept answer', () => {
  const speech = buildConceptSpeech('市盈率', '是衡量估值的指标。', 'zh');
  assert.equal(speech.answer, '市盈率是衡量估值的指标。');
});

test('builds equivalent English and Japanese Concept prompts', () => {
  const english = buildConceptSpeech('Price-to-earnings ratio', 'a valuation ratio.', 'en');
  const japanese = buildConceptSpeech('株価収益率', '株価を一株当たり利益と比較する指標です。', 'ja');

  assert.equal(english.question, 'What is Price-to-earnings ratio?');
  assert.equal(english.answer, 'Price-to-earnings ratio is a valuation ratio.');
  assert.equal(japanese.question, '株価収益率とは何ですか？');
  assert.equal(japanese.answer, '株価収益率は株価を一株当たり利益と比較する指標です。');
});
