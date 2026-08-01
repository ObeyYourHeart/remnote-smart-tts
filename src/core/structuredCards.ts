import type { SupportedLanguage } from './types';

export type StructuredCardKind = 'multi-line' | 'list-answer';

const ENGLISH_ORDINALS = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
];

const CHINESE_ORDINALS = ['第一', '第二', '第三', '第四', '第五', '第六', '第七', '第八', '第九', '第十'];

function trimEndingSeparator(text: string): string {
  return text.trim().replace(/[。.!！?？,，;；:：]+$/u, '');
}

function formatOrdinal(index: number, language: SupportedLanguage): string {
  if (language === 'en') return ENGLISH_ORDINALS[index] ?? `Item ${index + 1}`;
  if (language === 'ja') return `${index + 1}番目`;
  return CHINESE_ORDINALS[index] ?? `第${index + 1}项`;
}

function finishSentence(text: string, language: SupportedLanguage): string {
  const cleanText = trimEndingSeparator(text);
  return `${cleanText}${language === 'en' ? '.' : '。'}`;
}

function formatEnglishStepOrdinal(index: number): string {
  const namedOrdinal = ENGLISH_ORDINALS[index];
  if (namedOrdinal) return namedOrdinal.toLowerCase();

  const number = index + 1;
  const lastTwoDigits = number % 100;
  const suffix = lastTwoDigits >= 11 && lastTwoDigits <= 13
    ? 'th'
    : number % 10 === 1
      ? 'st'
      : number % 10 === 2
        ? 'nd'
        : number % 10 === 3
          ? 'rd'
          : 'th';
  return `${number}${suffix}`;
}

/**
 * Turns a parent List-Answer prompt into the question for one tested step.
 * Common structure words are removed so Chinese does not say the awkward
 * “顺序的第一步”, while English and Japanese receive native word order.
 */
export function buildOrderedItemQuestion(
  subject: string,
  itemIndex: number,
  language: SupportedLanguage,
): string {
  const cleanSubject = trimEndingSeparator(subject);

  if (language === 'en') {
    const leadingInfinitive = cleanSubject.match(/^steps?\s+to\s+(.+)$/iu);
    const ordinal = formatEnglishStepOrdinal(itemIndex);
    if (leadingInfinitive?.[1]) return `What is the ${ordinal} step to ${leadingInfinitive[1]}?`;

    const baseSubject = cleanSubject.replace(/\s+(?:steps?|order|procedure)$/iu, '').trim();
    return `What is the ${ordinal} step of ${baseSubject || cleanSubject}?`;
  }

  if (language === 'ja') {
    const baseSubject = cleanSubject.replace(/(?:の)?(?:手順|順序|ステップ)$/u, '').trim();
    const normalizedSubject = baseSubject || cleanSubject;
    const connector = /[うくぐすつぬぶむる]$/u.test(normalizedSubject) ? 'ための' : 'の';
    return `${normalizedSubject}${connector}第${itemIndex + 1}ステップは何ですか？`;
  }

  const baseSubject = cleanSubject.replace(/(?:的)?(?:步骤|顺序|流程)$/u, '').trim();
  const ordinal = CHINESE_ORDINALS[itemIndex] ?? `第${itemIndex + 1}`;
  return `${baseSubject || cleanSubject}的${ordinal}步是什么？`;
}

/**
 * Creates one introduction plus one independently spoken segment per answer
 * item. Azure keeps these in one SSML request, so the pauses are clear without
 * adding a network delay between items.
 */
export function buildStructuredAnswerSegments(
  subject: string | undefined,
  items: string[],
  kind: StructuredCardKind,
  language: SupportedLanguage,
  ordinalOffset = 0,
  includeIntroduction = true,
): string[] {
  const cleanItems = items.map(trimEndingSeparator).filter(Boolean);
  if (cleanItems.length === 0) return [];

  const introduction = language === 'en'
    ? `${subject || 'The answer'} includes the following.`
    : language === 'ja'
      ? `${subject || '答え'}には次の内容が含まれます。`
      : `${subject || '答案'}包括以下内容。`;

  const itemSegments = cleanItems.map((item, index) => {
    if (kind !== 'list-answer') return finishSentence(item, language);
    const separator = language === 'en' ? ', ' : '，';
    return finishSentence(`${formatOrdinal(index + ordinalOffset, language)}${separator}${item}`, language);
  });

  return includeIntroduction ? [introduction, ...itemSegments] : itemSegments;
}

/**
 * Builds one natural utterance for all direct child answers. Sending the full
 * answer in one synthesis request avoids a network delay between list items.
 */
export function buildStructuredAnswer(
  subject: string | undefined,
  items: string[],
  kind: StructuredCardKind,
  language: SupportedLanguage,
): string {
  const cleanItems = items.map(trimEndingSeparator).filter(Boolean);
  if (cleanItems.length === 0) return '';

  if (kind === 'list-answer') {
    const body = cleanItems
      .map((item, index) => `${formatOrdinal(index, language)}${language === 'en' ? ', ' : '，'}${item}`)
      .join(language === 'en' ? '; ' : '；');

    if (language === 'en') {
      return `${subject || 'The answer'} includes, in order: ${body}.`;
    }
    if (language === 'ja') {
      return `${subject || '答え'}は順番に、${body}です。`;
    }
    return `${subject || '答案'}依次包括：${body}。`;
  }

  const body = cleanItems.join(language === 'en' ? '; ' : '；');
  if (language === 'en') return `${subject || 'The answer'} includes: ${body}.`;
  if (language === 'ja') return `${subject || '答え'}には、${body}が含まれます。`;
  return `${subject || '答案'}包括：${body}。`;
}
