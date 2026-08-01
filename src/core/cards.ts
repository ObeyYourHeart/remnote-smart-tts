import { RemType, type Card, type CardType, type Rem, type RNPlugin, type WidgetLocationContextDataMap, WidgetLocation } from '@remnote/plugin-sdk';
import { buildConceptSpeech } from './concept';
import {
  buildDescriptorPathSpeech,
  buildDescriptorPathSubject,
} from './descriptor';
import { detectLanguage } from './language';
import { piecesToPlainText, renderActiveCloze, richTextToPieces } from './richText';
import { readStructuredCard, resolveStructuredCardRoot } from './structuredCardReader';
import {
  buildMultiLineQuestion,
  buildOrderedItemQuestion,
  buildStructuredAnswer,
  buildStructuredAnswerSegments,
} from './structuredCards';
import type { CardSpeechPlan, SpeechSettings } from './types';

type FlashcardContext = WidgetLocationContextDataMap[WidgetLocation.FlashcardUnder];

interface CardSpeechPlanOptions {
  /** Zero-based ordered child index maintained by the queue widget. */
  structuredItemIndex?: number;
}

interface DescriptorPath {
  conceptText: string;
  descriptorTexts: string[];
}

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

/** Walks from a nested Descriptor to its nearest Concept without dropping levels. */
async function readDescriptorPath(plugin: RNPlugin, descriptorRem: Rem): Promise<DescriptorPath | null> {
  const descriptorTexts: string[] = [];
  const visitedRemIds = new Set<string>();
  let currentRem: Rem | undefined = descriptorRem;

  // The limit protects playback from malformed or cyclic imported outlines.
  for (let depth = 0; currentRem && depth < 64; depth += 1) {
    if (currentRem._id) {
      if (visitedRemIds.has(currentRem._id)) return null;
      visitedRemIds.add(currentRem._id);
    }

    const currentText = await readPlainText(plugin, currentRem.text);
    if (currentRem.type === RemType.CONCEPT) {
      return currentText && descriptorTexts.length > 0
        ? { conceptText: currentText, descriptorTexts }
        : null;
    }
    if (currentRem.type !== RemType.DESCRIPTOR || !currentText) return null;

    descriptorTexts.unshift(currentText);
    try {
      currentRem = await currentRem.getParentRem();
    } catch (error) {
      console.warn('Could not read a parent in the nested Descriptor path.', error);
      return null;
    }
  }

  return null;
}

/**
 * Converts RemNote card metadata into the exact question/answer pair the speech layer needs.
 */
export async function buildCardSpeechPlan(
  plugin: RNPlugin,
  context: FlashcardContext,
  settings: SpeechSettings,
  options: CardSpeechPlanOptions = {},
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

  // Direct card-item children are the SDK's authoritative signal for native
  // Set/Multi-Line/List-Answer cards. Some queue contexts omit the parent
  // powerup, including ordinary ordered cards, so an empty back side may use
  // those child markers without relying on locale-specific DOM numbering.
  const structuredCard = await readStructuredCard(plugin, rem, !backText);
  if (structuredCard && frontText) {
    let questionText = frontText;
    let subject: string | undefined;
    let backwardAnswer = frontText;
    let questionLanguage = detectLanguage(frontText, settings.defaultLanguage);

    if (rem.type === RemType.CONCEPT) {
      const conceptSpeech = buildConceptSpeech(frontText, '', questionLanguage);
      questionText = conceptSpeech.question;
      subject = frontText;
      backwardAnswer = conceptSpeech.backwardAnswer;
    } else if (rem.type === RemType.DESCRIPTOR) {
      const descriptorPath = await readDescriptorPath(plugin, rem);
      if (descriptorPath) {
        questionLanguage = detectLanguage(
          `${descriptorPath.conceptText} ${descriptorPath.descriptorTexts.join(' ')}`,
          questionLanguage,
        );
        subject = buildDescriptorPathSubject(
          descriptorPath.conceptText,
          descriptorPath.descriptorTexts,
          questionLanguage,
        );
        questionText = buildDescriptorPathSpeech(
          descriptorPath.conceptText,
          descriptorPath.descriptorTexts,
          '',
          questionLanguage,
        ).question;
        // A nested reverse card identifies the complete path instead of
        // collapsing every Sub-descriptor back to the same Concept.
        backwardAnswer = subject;
      }
    }

    const answerLanguage = detectLanguage(
      structuredCard.items.join(' '),
      questionLanguage,
    );
    const childRemIndex = structuredCard.kind === 'list-answer' && structuredRoot
      ? structuredCard.itemRemIds.indexOf(initialRem._id)
      : -1;
    const trackedItemIndex = options.structuredItemIndex;
    const activeListItemIndex = childRemIndex >= 0
      ? childRemIndex
      : structuredCard.kind === 'list-answer' &&
        trackedItemIndex !== undefined &&
        trackedItemIndex >= 0 &&
        trackedItemIndex < structuredCard.items.length
        ? trackedItemIndex
        : -1;
    const readsOneListItem = activeListItemIndex >= 0;
    if (readsOneListItem && cardType !== 'backward') {
      questionText = buildOrderedItemQuestion(subject || frontText, activeListItemIndex, questionLanguage);
    } else if (structuredCard.kind === 'multi-line' && cardType !== 'backward') {
      questionText = buildMultiLineQuestion(subject || frontText, questionLanguage);
    }
    const answerItems = readsOneListItem
      ? [structuredCard.items[activeListItemIndex]]
      : structuredCard.items;
    const spokenSegments = buildStructuredAnswerSegments(
      cardType === 'backward' ? undefined : subject,
      answerItems,
      structuredCard.kind,
      answerLanguage,
      readsOneListItem ? activeListItemIndex : 0,
      !readsOneListItem,
    );
    const spokenItems = readsOneListItem
      ? spokenSegments.join(' ')
      : buildStructuredAnswer(
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
        question: { text: spokenItems, language: answerLanguage, segments: spokenSegments },
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
      answer: { text: spokenItems, language: answerLanguage, segments: spokenSegments },
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
    const descriptorPath = await readDescriptorPath(plugin, rem);
    // A Descriptor path rooted in a Concept gets a self-contained prompt.
    // Orphaned or unusual Descriptors safely fall through to ordinary A/B logic.
    if (descriptorPath && frontText && backText) {
      const descriptorLanguage = detectLanguage(
        `${descriptorPath.conceptText} ${descriptorPath.descriptorTexts.join(' ')}`,
        settings.defaultLanguage,
      );
      const descriptorSubject = buildDescriptorPathSubject(
        descriptorPath.conceptText,
        descriptorPath.descriptorTexts,
        descriptorLanguage,
      );
      if (cardType === 'backward') {
        // A nested reverse card names the complete path represented by the
        // Descriptor and its value.
        const descriptorQuestion = [frontText, backText].filter(Boolean).join('：');
        const questionLanguage = detectLanguage(descriptorQuestion, settings.defaultLanguage);
        return {
          cardId: activeCardId,
          remId: context.remId,
          kind: 'descriptor-backward',
          question: { text: descriptorQuestion, language: questionLanguage },
          answer: {
            text: descriptorSubject,
            language: detectLanguage(descriptorSubject, questionLanguage),
          },
        };
      }

      const descriptorSpeech = buildDescriptorPathSpeech(
        descriptorPath.conceptText,
        descriptorPath.descriptorTexts,
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
