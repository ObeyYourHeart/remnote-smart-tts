import type { SupportedLanguage } from './types';

function trimTermPunctuation(text: string): string {
  return text.trim().replace(/[。！？!?：:；;]+$/u, '');
}

/**
 * Turns a native Concept into a natural spoken question and a self-contained
 * answer. Keeping the Concept name in the answer makes the revealed side clear
 * even when it is heard without looking at the card.
 */
export function buildConceptSpeech(
  frontText: string,
  backText: string,
  language: SupportedLanguage,
): { question: string; answer: string; backwardAnswer: string } {
  const term = trimTermPunctuation(frontText);
  const definition = backText.trim();

  if (language === 'en') {
    const answer = /^(?:is|are|means|refers\s+to)\b/i.test(definition)
      ? `${term} ${definition}`
      : `${term} is ${definition}`;
    return {
      question: `What is ${term}?`,
      answer,
      backwardAnswer: `The concept is ${term}.`,
    };
  }

  if (language === 'ja') {
    const answer = /^(?:は|とは)/u.test(definition)
      ? `${term}${definition}`
      : `${term}は${definition}`;
    return {
      question: `${term}とは何ですか？`,
      answer,
      backwardAnswer: `この概念は${term}です。`,
    };
  }

  const answer = /^是/u.test(definition) ? `${term}${definition}` : `${term}是${definition}`;
  return {
    question: `${term}是什么？`,
    answer,
    backwardAnswer: `这个概念是${term}。`,
  };
}
