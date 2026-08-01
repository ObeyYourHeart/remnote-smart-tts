import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchAzureVoiceCatalog,
  isAzureHdVoiceName,
  normalizeAzureRegion,
  parseAzureVoiceCatalog,
} from '../src/core/azureVoiceCatalog';

test('normalizes a valid Azure region and rejects arbitrary hosts', () => {
  assert.equal(normalizeAzureRegion(' SoutheastAsia '), 'southeastasia');
  assert.throws(() => normalizeAzureRegion('https://example.com'), /invalid/);
  assert.throws(() => normalizeAzureRegion(''), /required/);
});

test('keeps only genuine Dragon HD voices and removes duplicates', () => {
  const catalog = parseAzureVoiceCatalog([
    { ShortName: 'zh-CN-Yunfan:DragonHDLatestNeural', DisplayName: 'Yunfan', LocalName: '云帆', Gender: 'Male', Locale: 'zh-CN' },
    { ShortName: 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural', DisplayName: 'Xiaoxiao', LocalName: '晓晓', Gender: 'Female', Locale: 'zh-CN' },
    { ShortName: 'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural', DisplayName: 'Duplicate', Locale: 'zh-CN' },
    { ShortName: 'en-US-Jenny:DragonHDLatestNeural', DisplayName: 'Jenny', Locale: 'en-US' },
    { ShortName: 'ja-JP-Sakura:MAI-Voice-2-Flash', DisplayName: 'Sakura', VoiceType: 'NeuralHD', Locale: 'ja-JP' },
    { ShortName: 'ja-JP-NanamiNeural', DisplayName: 'Nanami', VoiceType: 'Neural', Locale: 'ja-JP' },
    { ShortName: 'fr-FR-DeniseNeural', DisplayName: 'Denise', Locale: 'fr-FR' },
    { DisplayName: 'Missing short name', Locale: 'ja-JP' },
  ]);

  assert.deepEqual(catalog.zh.map((voice) => voice.shortName), [
    'zh-CN-Xiaoxiao:DragonHDFlashLatestNeural',
    'zh-CN-Yunfan:DragonHDLatestNeural',
  ]);
  assert.equal(catalog.en[0]?.shortName, 'en-US-Jenny:DragonHDLatestNeural');
  assert.deepEqual(catalog.ja, []);
});

test('identifies HD voices by the DragonHD model name instead of VoiceType', () => {
  assert.equal(isAzureHdVoiceName('ja-JP-Nanami:DragonHDLatestNeural'), true);
  assert.equal(isAzureHdVoiceName('zh-CN-Xiaoxiao:DragonHDFlashLatestNeural'), true);
  assert.equal(isAzureHdVoiceName('ja-JP-Sakura:MAI-Voice-2-Flash'), false);
  assert.equal(isAzureHdVoiceName('ja-JP-NanamiNeural'), false);
});

test('requests the regional Azure endpoint with the key only in a header', async () => {
  let requestedUrl = '';
  let requestedHeaders: HeadersInit | undefined;
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedHeaders = init?.headers;
    return new Response(JSON.stringify([
      { ShortName: 'ja-JP-Nanami:DragonHDLatestNeural', DisplayName: 'Nanami', Locale: 'ja-JP' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const catalog = await fetchAzureVoiceCatalog(
    { key: 'secret-test-key', region: 'eastasia' },
    fakeFetch,
  );

  assert.equal(requestedUrl, 'https://eastasia.tts.speech.microsoft.com/cognitiveservices/voices/list');
  assert.deepEqual(requestedHeaders, { 'Ocp-Apim-Subscription-Key': 'secret-test-key' });
  assert.equal(requestedUrl.includes('secret-test-key'), false);
  assert.equal(catalog.ja[0]?.shortName, 'ja-JP-Nanami:DragonHDLatestNeural');
});

test('reports HTTP failures without exposing the Speech Key', async () => {
  const fakeFetch = (async () => new Response('', { status: 401 })) as typeof fetch;
  const key = 'never-print-this-key';

  await assert.rejects(
    fetchAzureVoiceCatalog({ key, region: 'eastasia' }, fakeFetch),
    (error: Error) => error.message.includes('(401)') && !error.message.includes(key),
  );
});
