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
import type { CardSpeechPlan, SpeechContent, SpeechSettings, SupportedLanguage } from './types';

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
 * Finds the Concept/Descriptor outline that gives a Cloze its meaning.
 *
 * A Cloze in a Descriptor's back text belongs to that Descriptor, while a
 * Cloze in a normal child Rem inherits the Descriptor path above it. A Cloze
 * in a Descriptor's own title starts at the parent so the title is not spoken
 * twice.
 */
async function readClozeContextPath(
  plugin: RNPlugin,
  clozeRem: Rem,
  includeCurrentSemanticRem: boolean,
): Promise<DescriptorPath | null> {
  const descriptorTexts: string[] = [];
  const visitedRemIds = new Set<string>();
  let currentRem: Rem | undefined;

  if (
    includeCurrentSemanticRem &&
    (clozeRem.type === RemType.CONCEPT || clozeRem.type === RemType.DESCRIPTOR)
  ) {
    currentRem = clozeRem;
  } else {
    try {
      currentRem = await clozeRem.getParentRem();
    } catch (error) {
      console.warn('Could not read the parent of a contextual Cloze.', error);
      return null;
    }
  }

  for (let depth = 0; currentRem && depth < 64; depth += 1) {
    if (currentRem._id) {
      if (visitedRemIds.has(currentRem._id)) return null;
      visitedRemIds.add(currentRem._id);
    }

    const currentText = await readPlainText(plugin, currentRem.text);
    if (currentRem.type === RemType.CONCEPT) {
      return currentText ? { conceptText: currentText, descriptorTexts } : null;
    }
    if (currentRem.type !== RemType.DESCRIPTOR || !currentText) return null;

    descriptorTexts.unshift(currentText);
    try {
      currentRem = await currentRem.getParentRem();
    } catch (error) {
      console.warn('Could not read a parent in the Cloze context path.', error);
      return null;
    }
  }

  return null;
}

function addClozeContext(
  text: string,
  contextSegments: string[],
  language: SupportedLanguage,
): SpeechContent {
  const spokenText = text.trim();
  if (!spokenText) return { text: '', language };

  const normalizedText = spokenText.toLocaleLowerCase();
  const uniqueContextSegments = contextSegments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment, index, segments) => {
      const normalizedSegment = segment.toLocaleLowerCase();
      // Do not repeat context already written into the Cloze sentence or an
      // earlier context segment.
      return !normalizedText.includes(normalizedSegment) &&
        segments.findIndex(
          (candidate) => candidate.toLocaleLowerCase() === normalizedSegment,
        ) === index;
    });
  if (uniqueContextSegments.length === 0) {
    return { text: spokenText, language };
  }

  const separator = language === 'en' ? '. ' : '。';
  return {
    text: [...uniqueContextSegments, spokenText].join(separator),
    language,
    segments: [...uniqueContextSegments, spokenText],
  };
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
    const [frontPieces, backPieces] = await Promise.all([
      richTextToPieces(plugin, rem.text),
      richTextToPieces(plugin, rem.backText),
    ]);
    const frontHasActiveCloze = frontPieces.some((piece) => piece.clozeId === cardType.clozeId);
    const backHasActiveCloze = backPieces.some((piece) => piece.clozeId === cardType.clozeId);
    // Descriptor Clozes are commonly placed in backText. Search both sides
    // instead of assuming every Cloze lives in the Rem's visible title.
    const pieces = frontHasActiveCloze || !backHasActiveCloze ? frontPieces : backPieces;
    const clozeIsInBackText = !frontHasActiveCloze && backHasActiveCloze;
    const rendered = renderActiveCloze(
      pieces,
      cardType.clozeId,
      settings.clozeWords,
      settings.defaultLanguage,
    );
    if (!rendered.questionText) return null;

    const contextPath = await readClozeContextPath(plugin, rem, clozeIsInBackText);
    const contextLanguage = contextPath
      ? detectLanguage(
        `${contextPath.conceptText} ${contextPath.descriptorTexts.join(' ')}`,
        rendered.placeholderLanguage,
      )
      : rendered.placeholderLanguage;
    const contextSubject = contextPath
      ? buildDescriptorPathSubject(
        contextPath.conceptText,
        contextPath.descriptorTexts,
        contextLanguage,
      )
      : '';
    const contextSegments = contextSubject ? [contextSubject] : [];
    // In an ordinary A/B Rem whose Cloze lives in backText, the front text is
    // a necessary part of the question. For example:
    // "附着在粗面内质网 ← 主要和 {{蛋白质}} 的合成有关".
    // Concept/Descriptor Rems already include their front text in the path.
    if (
      clozeIsInBackText &&
      rem.type !== RemType.CONCEPT &&
      rem.type !== RemType.DESCRIPTOR
    ) {
      const localFrontText = piecesToPlainText(frontPieces);
      if (localFrontText) contextSegments.push(localFrontText);
    }
    const question = addClozeContext(rendered.questionText, contextSegments, contextLanguage);
    // Read the completed sentence after reveal instead of speaking only the
    // missing word. This keeps an answer meaningful without looking at the
    // screen: "主要和蛋白质的合成有关", not merely "蛋白质".
    const rawAnswer = piecesToPlainText(pieces) || rendered.answerText;
    const answerLanguage = detectLanguage(`${contextSegments.join(' ')} ${rawAnswer}`, contextLanguage);
    const answer = addClozeContext(rawAnswer, contextSegments, answerLanguage);

    return {
      cardId: activeCardId,
      remId: context.remId,
      kind: 'cloze',
      question,
      answer,
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
