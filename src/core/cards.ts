import { RemType, type RNPlugin, type WidgetLocationContextDataMap, WidgetLocation } from '@remnote/plugin-sdk';
import { buildConceptSpeech } from './concept';
import { detectLanguage } from './language';
import { piecesToPlainText, renderActiveCloze, richTextToPieces } from './richText';
import type { CardSpeechPlan, SpeechSettings } from './types';

type FlashcardContext = WidgetLocationContextDataMap[WidgetLocation.FlashcardUnder];

async function readPlainText(plugin: RNPlugin, richText: Parameters<typeof richTextToPieces>[1]): Promise<string> {
  return piecesToPlainText(await richTextToPieces(plugin, richText));
}

/**
 * Converts RemNote card metadata into the exact question/answer pair the speech layer needs.
 */
export async function buildCardSpeechPlan(
  plugin: RNPlugin,
  context: FlashcardContext,
  settings: SpeechSettings,
): Promise<CardSpeechPlan | null> {
  if (!context.cardId) return null;

  const [card, rem] = await Promise.all([
    plugin.card.findOne(context.cardId),
    plugin.rem.findOne(context.remId),
  ]);
  if (!card || !rem) return null;

  const cardType = await card.getType();

  if (typeof cardType === 'object' && 'clozeId' in cardType) {
    const pieces = await richTextToPieces(plugin, rem.text);
    const rendered = renderActiveCloze(
      pieces,
      cardType.clozeId,
      settings.clozeWords,
      settings.defaultLanguage,
    );
    if (!rendered.questionText) return null;

    return {
      cardId: context.cardId,
      remId: context.remId,
      kind: 'cloze',
      question: {
        text: rendered.questionText,
        language: rendered.placeholderLanguage,
      },
      answer: {
        text: rendered.answerText || piecesToPlainText(pieces),
        language: detectLanguage(rendered.answerText, rendered.placeholderLanguage),
      },
    };
  }

  const frontText = await readPlainText(plugin, rem.text);
  const backText = await readPlainText(plugin, rem.backText);

  if (rem.type === RemType.CONCEPT) {
    if (!frontText || !backText) return null;
    const conceptLanguage = detectLanguage(frontText, settings.defaultLanguage);
    const conceptSpeech = buildConceptSpeech(frontText, backText, conceptLanguage);

    if (cardType === 'backward') {
      const questionLanguage = detectLanguage(backText, conceptLanguage);
      return {
        cardId: context.cardId,
        remId: context.remId,
        kind: 'concept-backward',
        question: { text: backText, language: questionLanguage },
        answer: { text: conceptSpeech.backwardAnswer, language: conceptLanguage },
      };
    }

    return {
      cardId: context.cardId,
      remId: context.remId,
      kind: 'concept-forward',
      question: { text: conceptSpeech.question, language: conceptLanguage },
      answer: { text: conceptSpeech.answer, language: conceptLanguage },
    };
  }

  if (cardType === 'backward') {
    // Descriptor reverse cards test the parent Concept, not the Descriptor label itself.
    if (rem.type === RemType.DESCRIPTOR) {
      const parentRem = await rem.getParentRem();
      const parentText = await readPlainText(plugin, parentRem?.text);
      const descriptorQuestion = [frontText, backText].filter(Boolean).join('：');
      if (!descriptorQuestion || !parentText) return null;

      const questionLanguage = detectLanguage(descriptorQuestion, settings.defaultLanguage);
      return {
        cardId: context.cardId,
        remId: context.remId,
        kind: 'descriptor-backward',
        question: { text: descriptorQuestion, language: questionLanguage },
        answer: { text: parentText, language: detectLanguage(parentText, questionLanguage) },
      };
    }

    if (!backText || !frontText) return null;
    const questionLanguage = detectLanguage(backText, settings.defaultLanguage);
    return {
      cardId: context.cardId,
      remId: context.remId,
      kind: 'backward',
      question: { text: backText, language: questionLanguage },
      answer: { text: frontText, language: detectLanguage(frontText, questionLanguage) },
    };
  }

  if (!frontText || !backText) return null;
  const questionLanguage = detectLanguage(frontText, settings.defaultLanguage);
  return {
    cardId: context.cardId,
    remId: context.remId,
    kind: 'forward',
    question: { text: frontText, language: questionLanguage },
    answer: { text: backText, language: detectLanguage(backText, questionLanguage) },
  };
}
