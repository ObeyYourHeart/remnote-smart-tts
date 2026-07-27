import type { SupportedLanguage } from './types';

export interface LanguageScores {
  zh: number;
  en: number;
  ja: number;
}

const HAN_PATTERN = /\p{Script=Han}/gu;
const KANA_PATTERN = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/gu;
const ENGLISH_WORD_PATTERN = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * Scores Chinese by Han characters, English by words, and Japanese by kana plus nearby Han.
 * Counting English words rather than letters prevents long English words from overpowering Chinese.
 */
export function scoreLanguages(text: string): LanguageScores {
  const kanaCount = countMatches(text, KANA_PATTERN);
  const hanCount = countMatches(text, HAN_PATTERN);
  const englishWordCount = countMatches(text, ENGLISH_WORD_PATTERN);

  // When kana is present, the Han characters in the same text are probably Japanese kanji.
  const japaneseHanWeight = kanaCount > 0 ? hanCount * 0.8 : 0;
  const chineseHanWeight = kanaCount > 0 ? hanCount * 0.15 : hanCount;

  return {
    zh: chineseHanWeight,
    en: englishWordCount,
    ja: kanaCount * 1.7 + japaneseHanWeight,
  };
}

function highestLanguage(scores: LanguageScores, fallback: SupportedLanguage): SupportedLanguage {
  const entries = Object.entries(scores) as Array<[SupportedLanguage, number]>;
  const sorted = entries.sort((left, right) => right[1] - left[1]);
  const [winner, winningScore] = sorted[0];
  const secondScore = sorted[1][1];

  if (winningScore <= 0) return fallback;

  // Very close mixed-language scores use the configured fallback for predictable behavior.
  if (winningScore - secondScore < 0.35 && scores[fallback] > 0) return fallback;
  return winner;
}

export function detectLanguage(text: string, fallback: SupportedLanguage = 'zh'): SupportedLanguage {
  return highestLanguage(scoreLanguages(text), fallback);
}

/**
 * Cloze wording favors the language immediately around the blank, then the whole question.
 */
export function detectClozeLanguage(
  visibleQuestion: string,
  placeholderIndex: number,
  fallback: SupportedLanguage,
): SupportedLanguage {
  const radius = 24;
  const localText = visibleQuestion.slice(
    Math.max(0, placeholderIndex - radius),
    Math.min(visibleQuestion.length, placeholderIndex + radius),
  );
  const localScores = scoreLanguages(localText);
  const globalScores = scoreLanguages(visibleQuestion);

  const combined: LanguageScores = {
    zh: localScores.zh * 0.7 + globalScores.zh * 0.3,
    en: localScores.en * 0.7 + globalScores.en * 0.3,
    ja: localScores.ja * 0.7 + globalScores.ja * 0.3,
  };

  return highestLanguage(combined, fallback);
}
