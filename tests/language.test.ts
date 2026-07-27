import assert from 'node:assert/strict';
import test from 'node:test';
import { detectClozeLanguage, detectLanguage } from '../src/core/language';

test('detects Chinese, English, and Japanese', () => {
  assert.equal(detectLanguage('法国的首都是巴黎'), 'zh');
  assert.equal(detectLanguage('Paris is the capital of France'), 'en');
  assert.equal(detectLanguage('東京は日本の首都です'), 'ja');
});

test('counts English words rather than individual letters', () => {
  assert.equal(detectLanguage('这是 photosynthesis 的定义'), 'zh');
});

test('uses fallback for text with no language signal', () => {
  assert.equal(detectLanguage('123 + 456', 'ja'), 'ja');
});

test('Cloze language favors nearby question context', () => {
  const englishQuestion = 'The Chinese word for computer is  .';
  assert.equal(detectClozeLanguage(englishQuestion, englishQuestion.indexOf('  '), 'zh'), 'en');

  const chineseQuestion = 'CPU 是  的缩写。';
  assert.equal(detectClozeLanguage(chineseQuestion, chineseQuestion.indexOf('  '), 'en'), 'zh');
});
