import assert from 'node:assert/strict';
import test from 'node:test';
import { splitSpeechText } from '../src/core/speech';

test('keeps short English questions in one synthesis request', () => {
  assert.deepEqual(
    splitSpeechText('What is the capital? It is Paris.', 450),
    ['What is the capital? It is Paris.'],
  );
});

test('still separates text that exceeds the synthesis limit', () => {
  assert.deepEqual(splitSpeechText('First question? Second answer.', 18), [
    'First question?',
    'Second answer.',
  ]);
});
