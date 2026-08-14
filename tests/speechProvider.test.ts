import assert from 'node:assert/strict';
import test from 'node:test';
import { formatProviderFallbackNotice, speechProviderLabel } from '../src/core/speechProvider';

test('labels every supported provider in both interface languages', () => {
  assert.equal(speechProviderLabel('azure', 'en'), 'Azure Speech');
  assert.equal(speechProviderLabel('edge-local', 'en'), 'Edge Local Voice');
  assert.equal(speechProviderLabel('browser', 'zh'), '浏览器声音');
  assert.equal(speechProviderLabel('edge-local', 'zh'), 'Edge 本地语音');
});

test('reports the provider that actually failed before browser fallback', () => {
  assert.equal(
    formatProviderFallbackNotice('edge-local', 'en', 'Local service is offline.'),
    'Edge Local Voice was unavailable, so Browser Speech is being used: Local service is offline.',
  );
  assert.equal(
    formatProviderFallbackNotice('azure', 'zh', 'Region is missing.'),
    'Azure Speech 暂不可用，已改用浏览器声音：Region is missing.',
  );
});
