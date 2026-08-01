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
  return buildDescriptorPathSubject(conceptText, [descriptorText], language);
}

/**
 * Keeps every Descriptor in a nested Concept path. Repeating the language's
 * neutral possessive connector is intentionally verbose but never hides a
 * level that the learner deliberately added while making the card.
 */
export function buildDescriptorPathSubject(
  conceptText: string,
  descriptorTexts: string[],
  language: SupportedLanguage,
): string {
  const concept = trimEndingPunctuation(conceptText);
  const descriptors = descriptorTexts.map(trimEndingPunctuation).filter(Boolean);
  if (descriptors.length === 0) return concept;

  if (language === 'en') {
    return descriptors.reduce(
      (subject, descriptor) => `the ${descriptor} of ${subject}`,
      concept,
    );
  }
  if (language === 'ja') return [concept, ...descriptors].join('の');
  return [concept, ...descriptors].join('的');
}

/** Builds a normal A/B prompt from a complete nested Descriptor path. */
export function buildDescriptorPathSpeech(
  conceptText: string,
  descriptorTexts: string[],
  answerText: string,
  language: SupportedLanguage,
): { question: string; answer: string } {
  const subject = buildDescriptorPathSubject(conceptText, descriptorTexts, language);
  const value = answerText.trim();

  if (language === 'en') {
    const answer = /^(?:is|are)\b/i.test(value) ? `${subject} ${value}` : `${subject} is ${value}`;
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
