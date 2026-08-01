import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchAzureVoiceCatalog,
  normalizeAzureRegion,
  parseAzureVoiceCatalog,
} from '../src/core/azureVoiceCatalog';

test('normalizes a valid Azure region and rejects arbitrary hosts', () => {
  assert.equal(normalizeAzureRegion(' SoutheastAsia '), 'southeastasia');
  assert.throws(() => normalizeAzureRegion('https://example.com'), /invalid/);
  assert.throws(() => normalizeAzureRegion(''), /required/);
});

test('filters the Azure catalog to supported locales and removes duplicates', () => {
  const catalog = parseAzureVoiceCatalog([
    { ShortName: 'zh-CN-YunxiNeural', DisplayName: 'Yunxi', LocalName: '云希', Gender: 'Male', Locale: 'zh-CN' },
    { ShortName: 'zh-CN-XiaoxiaoNeural', DisplayName: 'Xiaoxiao', LocalName: '晓晓', Gender: 'Female', Locale: 'zh-CN' },
    { ShortName: 'zh-CN-XiaoxiaoNeural', DisplayName: 'Duplicate', Locale: 'zh-CN' },
    { ShortName: 'en-US-JennyNeural', DisplayName: 'Jenny', Locale: 'en-US' },
    { ShortName: 'fr-FR-DeniseNeural', DisplayName: 'Denise', Locale: 'fr-FR' },
    { DisplayName: 'Missing short name', Locale: 'ja-JP' },
  ]);

  assert.deepEqual(catalog.zh.map((voice) => voice.shortName), [
    'zh-CN-XiaoxiaoNeural',
    'zh-CN-YunxiNeural',
  ]);
  assert.equal(catalog.en[0]?.shortName, 'en-US-JennyNeural');
  assert.deepEqual(catalog.ja, []);
});

test('requests the regional Azure endpoint with the key only in a header', async () => {
  let requestedUrl = '';
  let requestedHeaders: HeadersInit | undefined;
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedHeaders = init?.headers;
    return new Response(JSON.stringify([
      { ShortName: 'ja-JP-NanamiNeural', DisplayName: 'Nanami', Locale: 'ja-JP' },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const catalog = await fetchAzureVoiceCatalog(
    { key: 'secret-test-key', region: 'eastasia' },
    fakeFetch,
  );

  assert.equal(requestedUrl, 'https://eastasia.tts.speech.microsoft.com/cognitiveservices/voices/list');
  assert.deepEqual(requestedHeaders, { 'Ocp-Apim-Subscription-Key': 'secret-test-key' });
  assert.equal(requestedUrl.includes('secret-test-key'), false);
  assert.equal(catalog.ja[0]?.shortName, 'ja-JP-NanamiNeural');
});

test('reports HTTP failures without exposing the Speech Key', async () => {
  const fakeFetch = (async () => new Response('', { status: 401 })) as typeof fetch;
  const key = 'never-print-this-key';

  await assert.rejects(
    fetchAzureVoiceCatalog({ key, region: 'eastasia' }, fakeFetch),
    (error: Error) => error.message.includes('(401)') && !error.message.includes(key),
  );
});
