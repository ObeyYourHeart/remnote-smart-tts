import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSpeechRequest,
  createSpeechState,
  createSpeechStop,
  isPersistentSpeechMessage,
} from '../src/core/speechMessages';

test('creates scoped persistent speech requests', () => {
  const request = createSpeechRequest('request-1', { text: 'What is P/E ratio?', language: 'en' });
  assert.equal(request.scope, 'remnote-smart-tts');
  assert.equal(request.type, 'speech-request');
  assert.equal(request.requestId, 'request-1');
  assert.equal(isPersistentSpeechMessage(request), true);
});

test('distinguishes stop and playback state messages', () => {
  assert.deepEqual(createSpeechStop('request-1'), {
    scope: 'remnote-smart-tts',
    type: 'speech-stop',
    requestId: 'request-1',
  });
  assert.equal(createSpeechState('request-1', 'speaking').status, 'speaking');
  assert.equal(isPersistentSpeechMessage({ type: 'speech-request' }), false);
});
