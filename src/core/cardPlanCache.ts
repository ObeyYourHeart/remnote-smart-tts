import type { SpeechSettings } from './types';

// Increment this whenever card-structure wording changes. Local DEV hot reload
// can preserve React refs, so including a schema version prevents an old plan
// from continuing to speak after the parser itself has been updated.
const CARD_PLAN_SCHEMA_VERSION = 2;

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
    CARD_PLAN_SCHEMA_VERSION,
    queueCardKey,
    structuredItemIndex,
    settings.defaultLanguage,
    settings.clozeWords.zh,
    settings.clozeWords.en,
    settings.clozeWords.ja,
  ]);
}
