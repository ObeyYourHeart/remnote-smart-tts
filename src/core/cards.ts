import { RemType, type Card, type CardType, type Rem, type RNPlugin, type WidgetLocationContextDataMap, WidgetLocation } from '@remnote/plugin-sdk';
import { buildConceptSpeech } from './concept';
import { buildDescriptorSpeech, buildDescriptorSubject } from './descriptor';
import { detectLanguage } from './language';
import { piecesToPlainText, renderActiveCloze, richTextToPieces } from './richText';
import { readStructuredCard, resolveStructuredCardRoot } from './structuredCardReader';
import { buildStructuredAnswer } from './structuredCards';
import type { CardSpeechPlan, SpeechSettings } from './types';

type FlashcardContext = WidgetLocationContextDataMap[WidgetLocation.FlashcardUnder];

async function readPlainText(plugin: RNPlugin, richText: Parameters<typeof richTextToPieces>[1]): Promise<string> {
  return piecesToPlainText(await richTextToPieces(plugin, richText));
}

async function readCardRem(plugin: RNPlugin, card: Card | undefined): Promise<Rem | undefined> {
  if (!card) return undefined;
  try {
    // `Card.remId` is the stable SDK identity for the Rem that generated the
    // queue card. Resolve it directly before relying on the extra Card RPC.
    if (card.remId) {
      const rem = await plugin.rem.findOne(card.remId);
      if (rem) return rem;
    }
    return await card.getRem();
  } catch (error) {
    console.warn('Could not resolve the Rem attached to the current card.', error);
    return undefined;
  }
}

/**
 * Converts RemNote card metadata into the exact question/answer pair the speech layer needs.
 */
export async function buildCardSpeechPlan(
  plugin: RNPlugin,
  context: FlashcardContext,
  settings: SpeechSettings,
): Promise<CardSpeechPlan | null> {
  const [card, contextRem] = await Promise.all([
    context.cardId ? plugin.card.findOne(context.cardId) : Promise.resolve(undefined),
    plugin.rem.findOne(context.remId),
  ]);
  if (!contextRem) return null;

  const cardRem = await readCardRem(plugin, card);
  const initialRem = cardRem ?? contextRem;
  // When the Card resolves to a concrete Rem, that Rem is authoritative. The
  // broader widget context can point at a parent Concept and must not replace a
  // valid Descriptor child with that parent.
  const structuredRoot = await resolveStructuredCardRoot(initialRem);
  const rem = structuredRoot ?? initialRem;
  // `cardId` is optional in FlashcardUnder. Structured cards without it are
  // still safe to read as forward cards because their question is the parent
  // Rem and their answers are direct card-item children.
  const cardType: CardType = card ? await card.getType() : 'forward';
  const activeCardId = context.cardId ?? card?._id ?? `rem:${rem._id || context.remId}`;

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
      cardId: activeCardId,
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

  const structuredCard = await readStructuredCard(plugin, rem);
  if (structuredCard && frontText) {
    let questionText = frontText;
    let subject: string | undefined;
    let backwardAnswer = frontText;
    const questionLanguage = detectLanguage(frontText, settings.defaultLanguage);

    if (rem.type === RemType.CONCEPT) {
      const conceptSpeech = buildConceptSpeech(frontText, '', questionLanguage);
      questionText = conceptSpeech.question;
      subject = frontText;
      backwardAnswer = conceptSpeech.backwardAnswer;
    } else if (rem.type === RemType.DESCRIPTOR) {
      const parentRem = await rem.getParentRem();
      const parentText = await readPlainText(plugin, parentRem?.text);
      if (parentRem?.type === RemType.CONCEPT && parentText) {
        questionText = buildDescriptorSpeech(parentText, frontText, '', questionLanguage).question;
        subject = buildDescriptorSubject(parentText, frontText, questionLanguage);
        // Preserve the existing reverse Descriptor behavior: identify the
        // parent Concept represented by the Descriptor and its child values.
        backwardAnswer = parentText;
      }
    }

    const answerLanguage = detectLanguage(
      structuredCard.items.join(' '),
      questionLanguage,
    );
    const spokenItems = buildStructuredAnswer(
      cardType === 'backward' ? undefined : subject,
      structuredCard.items,
      structuredCard.kind,
      answerLanguage,
    );
    const kindPrefix = structuredCard.kind === 'list-answer' ? 'list-answer' : 'multi-line';

    if (cardType === 'backward') {
      return {
        cardId: activeCardId,
        remId: context.remId,
        kind: `${kindPrefix}-backward`,
        question: { text: spokenItems, language: answerLanguage },
        answer: {
          text: backwardAnswer,
          language: detectLanguage(backwardAnswer, questionLanguage),
        },
      };
    }

    return {
      cardId: activeCardId,
      remId: context.remId,
      kind: `${kindPrefix}-forward`,
      question: { text: questionText, language: questionLanguage },
      answer: { text: spokenItems, language: answerLanguage },
    };
  }

  if (rem.type === RemType.CONCEPT) {
    if (!frontText || !backText) return null;
    const conceptLanguage = detectLanguage(frontText, settings.defaultLanguage);
    const conceptSpeech = buildConceptSpeech(frontText, backText, conceptLanguage);

    if (cardType === 'backward') {
      const questionLanguage = detectLanguage(backText, conceptLanguage);
      return {
        cardId: activeCardId,
        remId: context.remId,
        kind: 'concept-backward',
        question: { text: backText, language: questionLanguage },
        answer: { text: conceptSpeech.backwardAnswer, language: conceptLanguage },
      };
    }

    return {
      cardId: activeCardId,
      remId: context.remId,
      kind: 'concept-forward',
      question: { text: conceptSpeech.question, language: conceptLanguage },
      answer: { text: conceptSpeech.answer, language: conceptLanguage },
    };
  }

  if (rem.type === RemType.DESCRIPTOR) {
    const parentRem = await rem.getParentRem();
    const parentText = await readPlainText(plugin, parentRem?.text);
    // A normal Concept + Descriptor pair gets the semantic speech template.
    // Orphaned or unusual Descriptors safely fall through to ordinary A/B logic.
    if (parentRem?.type === RemType.CONCEPT && parentText && frontText && backText) {
      if (cardType === 'backward') {
        // Reverse Descriptor cards ask for the parent Concept represented by the
        // Descriptor and its value.
        const descriptorQuestion = [frontText, backText].filter(Boolean).join('：');
        const questionLanguage = detectLanguage(descriptorQuestion, settings.defaultLanguage);
        return {
          cardId: activeCardId,
          remId: context.remId,
          kind: 'descriptor-backward',
          question: { text: descriptorQuestion, language: questionLanguage },
          answer: { text: parentText, language: detectLanguage(parentText, questionLanguage) },
        };
      }

      const descriptorLanguage = detectLanguage(
        `${parentText} ${frontText}`,
        settings.defaultLanguage,
      );
      const descriptorSpeech = buildDescriptorSpeech(
        parentText,
        frontText,
        backText,
        descriptorLanguage,
      );
      return {
        cardId: activeCardId,
        remId: context.remId,
        kind: 'descriptor-forward',
        question: { text: descriptorSpeech.question, language: descriptorLanguage },
        answer: { text: descriptorSpeech.answer, language: descriptorLanguage },
      };
    }
  }

  if (cardType === 'backward') {
    if (!backText || !frontText) return null;
    const questionLanguage = detectLanguage(backText, settings.defaultLanguage);
    return {
      cardId: activeCardId,
      remId: context.remId,
      kind: 'backward',
      question: { text: backText, language: questionLanguage },
      answer: { text: frontText, language: detectLanguage(frontText, questionLanguage) },
    };
  }

  if (!frontText || !backText) return null;
  const questionLanguage = detectLanguage(frontText, settings.defaultLanguage);
  return {
    cardId: activeCardId,
    remId: context.remId,
    kind: 'forward',
    question: { text: frontText, language: questionLanguage },
    answer: { text: backText, language: detectLanguage(backText, questionLanguage) },
  };
}
