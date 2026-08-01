/**
 * Keeps a short voice preview from leaving the settings UI in a permanent
 * playing state when a provider never reports completion.
 */
export async function runPreviewWithTimeout<T>(
  operation: Promise<T>,
  cancel: () => void,
  timeoutMs = 20_000,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      cancel();
      reject(new Error('Voice preview timed out.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
