import assert from 'node:assert/strict';
import test from 'node:test';
import { renderActiveCloze } from '../src/core/richText';

const CLOZE_WORDS = { zh: '什么', en: 'what', ja: 'なに' };

test('replaces only the active Cloze', () => {
  const rendered = renderActiveCloze(
    [
      { text: 'France has the capital ' },
      { text: 'Paris', clozeId: 'c1' },
      { text: ' and currency ' },
      { text: 'Euro', clozeId: 'c2' },
      { text: '.' },
    ],
    'c1',
    CLOZE_WORDS,
    'zh',
  );

  assert.equal(rendered.questionText, 'France has the capital what and currency Euro.');
  assert.equal(rendered.answerText, 'Paris');
  assert.equal(rendered.placeholderLanguage, 'en');
});

test('merges adjacent formatted pieces of one Cloze into one placeholder', () => {
  const rendered = renderActiveCloze(
    [
      { text: '首都是' },
      { text: '巴', clozeId: 'c1' },
      { text: '黎', clozeId: 'c1' },
      { text: '。' },
    ],
    'c1',
    CLOZE_WORDS,
    'zh',
  );

  assert.equal(rendered.questionText, '首都是 什么。');
  assert.equal(rendered.answerText, '巴黎');
});

test('uses Japanese wording when kana surrounds the Cloze', () => {
  const rendered = renderActiveCloze(
    [
      { text: '日本の首都は' },
      { text: '東京', clozeId: 'c1' },
      { text: 'です。' },
    ],
    'c1',
    CLOZE_WORDS,
    'zh',
  );

  assert.equal(rendered.placeholderLanguage, 'ja');
  assert.match(rendered.questionText, /なに/);
});

test('supports grouped non-contiguous Clozes with the same id', () => {
  const rendered = renderActiveCloze(
    [
      { text: 'A ' },
      { text: 'red', clozeId: 'group' },
      { text: ' apple and a ' },
      { text: 'green', clozeId: 'group' },
      { text: ' pear.' },
    ],
    'group',
    CLOZE_WORDS,
    'en',
  );

  assert.equal(rendered.questionText, 'A what apple and a what pear.');
  assert.equal(rendered.answerText, 'red / green');
});
