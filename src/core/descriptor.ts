import type { SupportedLanguage } from './types';

function trimEndingPunctuation(text: string): string {
  return text.trim().replace(/[。！？!?：:；;]+$/u, '');
}

/**
 * Adds the parent Concept to a Descriptor so both sides remain meaningful when
 * heard without looking at the card.
 */
export function buildDescriptorSpeech(
  conceptText: string,
  descriptorText: string,
  answerText: string,
  language: SupportedLanguage,
): { question: string; answer: string } {
  const concept = trimEndingPunctuation(conceptText);
  const descriptor = trimEndingPunctuation(descriptorText);
  const value = answerText.trim();

  const subject = buildDescriptorSubject(concept, descriptor, language);

  if (language === 'en') {
    const answer = /^(?:is|are)\b/i.test(value)
      ? `${subject} ${value}`
      : `${subject} is ${value}`;
    return {
      question: `What is ${subject}?`,
      answer: `${answer.charAt(0).toUpperCase()}${answer.slice(1)}`,
    };
  }

  if (language === 'ja') {
    return {
      question: `${subject}は何ですか？`,
      answer: /^(?:は|とは)/u.test(value) ? `${subject}${value}` : `${subject}は${value}`,
    };
  }

  return {
    question: `${subject}是什么？`,
    answer: /^是/u.test(value) ? `${subject}${value}` : `${subject}是${value}`,
  };
}

/** Returns the self-contained subject used by structured Descriptor answers. */
export function buildDescriptorSubject(
  conceptText: string,
  descriptorText: string,
  language: SupportedLanguage,
): string {
  const concept = trimEndingPunctuation(conceptText);
  const descriptor = trimEndingPunctuation(descriptorText);
  if (language === 'en') return `the ${descriptor} of ${concept}`;
  if (language === 'ja') return `${concept}の${descriptor}`;
  return `${concept}的${descriptor}`;
}
