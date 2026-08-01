import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDescriptorPathSpeech,
  buildDescriptorPathSubject,
  buildDescriptorSpeech,
} from '../src/core/descriptor';

test('adds the parent Concept to a Chinese Descriptor question and answer', () => {
  const speech = buildDescriptorSpeech(
    '市盈率',
    '算法',
    '市盈率 = 股价 ÷ 每股收益',
    'zh',
  );

  assert.equal(speech.question, '市盈率的算法是什么？');
  assert.equal(speech.answer, '市盈率的算法是市盈率 = 股价 ÷ 每股收益');
});

test('does not repeat the Chinese linking word', () => {
  const speech = buildDescriptorSpeech('市盈率', '算法', '是股价除以每股收益。', 'zh');
  assert.equal(speech.answer, '市盈率的算法是股价除以每股收益。');
});

test('builds natural English and Japanese Descriptor templates', () => {
  const english = buildDescriptorSpeech(
    'price-to-earnings ratio',
    'formula',
    'price divided by earnings per share.',
    'en',
  );
  const japanese = buildDescriptorSpeech('株価収益率', '計算式', '株価を一株当たり利益で割ったものです。', 'ja');

  assert.equal(english.question, 'What is the formula of price-to-earnings ratio?');
  assert.equal(english.answer, 'The formula of price-to-earnings ratio is price divided by earnings per share.');
  assert.equal(japanese.question, '株価収益率の計算式は何ですか？');
  assert.equal(japanese.answer, '株価収益率の計算式は株価を一株当たり利益で割ったものです。');
});

test('keeps every nested Descriptor level in Chinese, English, and Japanese', () => {
  assert.equal(
    buildDescriptorPathSubject('叶绿体', ['结构', '基粒', '组成'], 'zh'),
    '叶绿体的结构的基粒的组成',
  );
  assert.equal(
    buildDescriptorPathSubject('chloroplast', ['structure', 'granum', 'composition'], 'en'),
    'the composition of the granum of the structure of chloroplast',
  );
  assert.equal(
    buildDescriptorPathSubject('葉緑体', ['構造', 'グラナ', '構成'], 'ja'),
    '葉緑体の構造のグラナの構成',
  );

  const speech = buildDescriptorPathSpeech(
    '叶绿体',
    ['结构', '基粒'],
    '由类囊体堆叠形成',
    'zh',
  );
  assert.equal(speech.question, '叶绿体的结构的基粒是什么？');
  assert.equal(speech.answer, '叶绿体的结构的基粒是由类囊体堆叠形成');
});
