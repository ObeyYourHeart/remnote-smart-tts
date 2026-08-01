import type { SpeechSettings } from './types';

/**
 * Identifies card-plan inputs that can change the spoken question or answer.
 * Reveal state is intentionally absent because one plan already contains both sides.
 */
export function createCardPlanCacheKey(
  queueCardKey: string,
  structuredItemIndex: number,
  settings: SpeechSettings,
): string {
  return JSON.stringify([
    queueCardKey,
    structuredItemIndex,
    settings.defaultLanguage,
    settings.clozeWords.zh,
    settings.clozeWords.en,
    settings.clozeWords.ja,
  ]);
}
