import assert from 'node:assert/strict';
import test from 'node:test';
import { runPreviewWithTimeout } from '../src/core/preview';

test('returns a preview result that completes before the timeout', async () => {
  let cancelled = false;
  const result = await runPreviewWithTimeout(Promise.resolve('played'), () => {
    cancelled = true;
  }, 20);

  assert.equal(result, 'played');
  assert.equal(cancelled, false);
});

test('cancels a preview that never reports completion', async () => {
  let cancelled = false;
  const neverFinishes = new Promise<void>(() => undefined);

  await assert.rejects(
    runPreviewWithTimeout(neverFinishes, () => {
      cancelled = true;
    }, 5),
    /Voice preview timed out/,
  );
  assert.equal(cancelled, true);
});
