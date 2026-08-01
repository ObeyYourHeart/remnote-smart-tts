import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAzureSsml, splitSpeechText } from '../src/core/speech';
import { DEFAULT_SETTINGS } from '../src/core/settings';

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

test('builds one Azure SSML document with a voice for every language segment', () => {
  const ssml = buildAzureSsml(
    {
      text: '核糖体。It makes proteins. リボソーム。',
      language: 'zh',
      segments: [
        { text: '核糖体', language: 'zh' },
        { text: 'It makes proteins.', language: 'en' },
        { text: 'リボソーム。', language: 'ja' },
      ],
    },
    DEFAULT_SETTINGS,
  );

  assert.equal((ssml.match(/<speak\b/g) ?? []).length, 1);
  assert.equal((ssml.match(/<break time="220ms"\/>/g) ?? []).length, 2);
  assert.match(ssml, new RegExp(`<voice name="${DEFAULT_SETTINGS.azureVoices.zh}">`));
  assert.match(ssml, new RegExp(`<voice name="${DEFAULT_SETTINGS.azureVoices.en}">`));
  assert.match(ssml, new RegExp(`<voice name="${DEFAULT_SETTINGS.azureVoices.ja}">`));
  assert.ok(ssml.indexOf('核糖体') < ssml.indexOf('It makes proteins.'));
  assert.ok(ssml.indexOf('It makes proteins.') < ssml.indexOf('リボソーム。'));
});
