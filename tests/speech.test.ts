import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAzureSsml,
  getAzureSynthesisTimeoutMs,
  getBrowserSpeechTimeoutMs,
  splitSpeechContentForAzure,
  splitSpeechText,
} from '../src/core/speech';
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

test('keeps ordinary semantic cards in one Azure payload', () => {
  const content = {
    text: '核糖体。It makes proteins.',
    language: 'zh' as const,
    segments: [
      { text: '核糖体', language: 'zh' as const },
      { text: 'It makes proteins.', language: 'en' as const },
    ],
  };

  assert.deepEqual(splitSpeechContentForAzure(content, 100, 4), [content]);
});

test('batches oversized semantic cards without losing order or languages', () => {
  const segments = Array.from({ length: 7 }, (_, index) => ({
    text: `item-${index + 1}`,
    language: index % 2 === 0 ? 'en' as const : 'ja' as const,
  }));
  const payloads = splitSpeechContentForAzure(
    { text: segments.map((segment) => segment.text).join('. '), language: 'en', segments },
    24,
    3,
  );

  assert.equal(payloads.length, 3);
  assert.deepEqual(payloads.flatMap((payload) => payload.segments), segments);
  assert.ok(payloads.every((payload) => (payload.segments?.length ?? 0) <= 3));
});

test('gives Browser Speech a bounded watchdog window', () => {
  assert.equal(getBrowserSpeechTimeoutMs('short text', 1), 12_000);
  assert.equal(getBrowserSpeechTimeoutMs('x'.repeat(1_000), 1), 90_000);
  assert.ok(getBrowserSpeechTimeoutMs('x'.repeat(120), 0.8) > 12_000);
});

test('allows Dragon HD and MAI voices to finish a cold Azure start', () => {
  const dragonSettings = {
    ...DEFAULT_SETTINGS,
    azureVoices: {
      ...DEFAULT_SETTINGS.azureVoices,
      zh: 'zh-CN-Xiaoyi:DragonHDFlashLatestNeural',
    },
  };
  const maiSettings = {
    ...DEFAULT_SETTINGS,
    azureVoices: {
      ...DEFAULT_SETTINGS.azureVoices,
      ja: 'ja-JP-Sakura:MAI-Voice-2-Flash',
    },
  };
  const neuralSettings = {
    ...DEFAULT_SETTINGS,
    azureVoices: {
      ...DEFAULT_SETTINGS.azureVoices,
      en: 'en-US-JennyNeural',
    },
  };

  assert.ok(getAzureSynthesisTimeoutMs({ text: '测试', language: 'zh' }, dragonSettings) >= 45_000);
  assert.ok(getAzureSynthesisTimeoutMs({ text: 'テスト', language: 'ja' }, maiSettings) >= 45_000);
  assert.ok(getAzureSynthesisTimeoutMs({ text: 'test', language: 'en' }, neuralSettings) < 45_000);
});
