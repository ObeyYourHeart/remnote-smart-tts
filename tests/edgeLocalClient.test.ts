import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEdgeTtsPayload,
  DEFAULT_EDGE_LOCAL_URL,
  edgeLocalRatePercent,
  normalizeEdgeLocalUrl,
} from '../src/core/edgeLocalClient';
import { CURATED_EDGE_VOICES } from '../src/core/edgeVoiceCatalog';
import { DEFAULT_SETTINGS } from '../src/core/settings';

test('formats the plugin rate as edge-tts percent syntax', () => {
  assert.equal(edgeLocalRatePercent(0.9), '-10%');
  assert.equal(edgeLocalRatePercent(1), '+0%');
  assert.equal(edgeLocalRatePercent(1.25), '+25%');
  assert.equal(edgeLocalRatePercent(0.5), '-50%');
  assert.equal(edgeLocalRatePercent(NaN), '+0%');
});

test('builds the JSON payload sent to the local server', () => {
  assert.deepEqual(buildEdgeTtsPayload('hello', 'en-US-AriaNeural', 0.9), {
    text: 'hello',
    voice: 'en-US-AriaNeural',
    rate: '-10%',
  });
});

test('normalizes the local server URL', () => {
  assert.equal(normalizeEdgeLocalUrl('http://127.0.0.1:8765/'), 'http://127.0.0.1:8765');
  assert.equal(normalizeEdgeLocalUrl(''), DEFAULT_EDGE_LOCAL_URL);
  assert.equal(normalizeEdgeLocalUrl('127.0.0.1:8765'), 'http://127.0.0.1:8765');
  assert.equal(normalizeEdgeLocalUrl('http://localhost:8765/path'), 'http://localhost:8765');
  assert.equal(normalizeEdgeLocalUrl('http://[::1]:8765/path'), 'http://[::1]:8765');
  assert.equal(normalizeEdgeLocalUrl('https://example.com/path'), DEFAULT_EDGE_LOCAL_URL);
});

test('curated catalog contains every default Edge voice', () => {
  for (const language of ['zh', 'en', 'ja'] as const) {
    assert.ok(
      CURATED_EDGE_VOICES[language].some(
        (voice) => voice.name === DEFAULT_SETTINGS.edgeVoices[language],
      ),
      `${language} default voice should be curated`,
    );
  }
});
