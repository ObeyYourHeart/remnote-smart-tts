import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAzureSpeechError, formatAzureSpeechError } from '../src/core/speechErrors';

test('classifies common Azure subscription and configuration failures', () => {
  assert.equal(classifyAzureSpeechError('HTTP 401 Unauthorized').kind, 'authentication');
  assert.equal(classifyAzureSpeechError('429 quota exceeded for free tier').kind, 'quota');
  assert.equal(classifyAzureSpeechError('The selected voice was not found in this region').kind, 'configuration');
  assert.equal(classifyAzureSpeechError('WebSocket connection failed').kind, 'network');
  assert.equal(classifyAzureSpeechError('Azure speech synthesis timed out.').kind, 'timeout');
});

test('classifies malformed Azure SSML instead of misreporting it as a network failure', () => {
  assert.equal(
    classifyAzureSpeechError(
      new Error('Node [speak] with type [RootSpeak] should not contain node [break]. websocket error code: 1007'),
    ).kind,
    'configuration',
  );
});

test('formats actionable Chinese Azure messages without echoing arbitrary details', () => {
  assert.match(formatAzureSpeechError('429 quota exceeded', 'zh'), /额度/);
  assert.match(formatAzureSpeechError('HTTP 401 Unauthorized', 'zh'), /Key/);
  assert.equal(
    formatAzureSpeechError('unexpected internal text', 'zh'),
    'Azure Speech 请求失败，请检查声音配置或稍后重试。',
  );
});
