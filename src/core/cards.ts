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
import type {
  CardSpeechPlan,
  RichTextPiece,
  SpeechContent,
  SpeechSettings,
  SupportedLanguage,
} from './types';

type FlashcardContext = WidgetLocationContextDataMap[WidgetLocation.FlashcardUnder];

interface CardSpeechPlanOptions {
  /** Zero-based ordered child index maintained by the queue widget. */
  structuredItemIndex?: number;
}

interface DescriptorPath {
  conceptText: string;
  descriptorTexts: string[];
}

interface CdfContextPath extends DescriptorPath {
  /** Ordinary grouping Rems that appear after the semantic Descriptor chain. */
  contextTexts: string[];
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
 * Reads the nearest Concept-Descriptor Framework path above an ordinary card.
 *
 * Descriptor ancestors that directly follow the Concept remain one semantic
 * subject. Ordinary grouping Rems are preserved as separate context segments
 * so the plugin does not silently reinterpret them as Descriptors.
 */
async function readAncestorCdfContext(
  plugin: RNPlugin,
  rem: Rem,
  includeCurrentRem = false,
): Promise<CdfContextPath | null> {
  const visitedRemIds = new Set<string>();
  const ancestorNodes: Array<{ text: string; type: RemType }> = [];
  let currentRem: Rem | undefined;

  try {
    currentRem = includeCurrentRem
      ? rem
      : typeof rem.getParentRem === 'function'
        ? await rem.getParentRem()
        : undefined;
  } catch (error) {
    console.warn('Could not read the parent of a CDF-aware card.', error);
    return null;
  }

  for (let depth = 0; currentRem && depth < 64; depth += 1) {
    if (currentRem._id) {
      if (visitedRemIds.has(currentRem._id)) return null;
      visitedRemIds.add(currentRem._id);
    }

    const currentText = await readPlainText(plugin, currentRem.text);
    if (currentText) ancestorNodes.unshift({ text: currentText, type: currentRem.type });

    if (currentRem.type === RemType.CONCEPT) {
      if (!currentText) return null;

      const descriptorTexts: string[] = [];
      const contextTexts: string[] = [];
      let descriptorChainOpen = true;
      for (const node of ancestorNodes.slice(1)) {
        if (descriptorChainOpen && node.type === RemType.DESCRIPTOR) {
          descriptorTexts.push(node.text);
        } else {
          descriptorChainOpen = false;
          contextTexts.push(node.text);
        }
      }
      return { conceptText: currentText, descriptorTexts, contextTexts };
    }

    try {
      currentRem = typeof currentRem.getParentRem === 'function'
        ? await currentRem.getParentRem()
        : undefined;
    } catch (error) {
      console.warn('Could not continue reading a CDF ancestor path.', error);
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
): Promise<CdfContextPath | null> {
  const includesCurrentRem = includeCurrentSemanticRem &&
    (clozeRem.type === RemType.CONCEPT || clozeRem.type === RemType.DESCRIPTOR);
  return readAncestorCdfContext(plugin, clozeRem, includesCurrentRem);
}

function addSpeechContext(
  text: string,
  contextSegments: string[],
  language: SupportedLanguage,
  localSegments?: SpeechContent['segments'],
): SpeechContent {
  const spokenText = text.trim();
  if (!spokenText) return { text: '', language };

  const normalizedText = spokenText.toLocaleLowerCase();
  const alreadyStartsWithContext = (normalizedSegment: string): boolean => {
    if (normalizedText === normalizedSegment) return true;
    if (!normalizedText.startsWith(normalizedSegment)) return false;
    const remainder = normalizedText.slice(normalizedSegment.length);
    // Only accept a clear grammatical or punctuation boundary. Han scripts do
    // not expose general word boundaries, so uncertain prefixes stay audible.
    return /^(?:\s|[,.!?:;，。！？：；]|的|是|有|为|包括|は|が|の|を|に|で|と|も)/u.test(remainder);
  };
  const uniqueContextSegments = contextSegments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment, index, segments) => {
      const normalizedSegment = segment.toLocaleLowerCase();
      // Do not repeat context already written into the Cloze sentence or an
      // earlier context segment.
      return !alreadyStartsWithContext(normalizedSegment) &&
        segments.findIndex(
          (candidate) => candidate.toLocaleLowerCase() === normalizedSegment,
        ) === index;
    });
  if (uniqueContextSegments.length === 0) {
    return { text: spokenText, language, segments: localSegments };
  }

  const separator = language === 'en' ? '. ' : '。';
  return {
    text: [...uniqueContextSegments, spokenText].join(separator),
    language,
    segments: [
      ...uniqueContextSegments.map((segment) => ({
        text: segment,
        language: detectLanguage(segment, language),
      })),
      ...(localSegments ?? [{
        text: spokenText,
        language: detectLanguage(spokenText, language),
      }]),
    ],
  };
}

/**
 * A Descriptor answer that begins with a Cloze item is the value of the
 * Concept/Descriptor subject, not a separate sentence. Join it with the
 * language's neutral copula so "蛋白质 + 变性条件 + Cloze list" becomes
 * "蛋白质的变性条件是什么……" instead of two disconnected fragments.
 */
function addSemanticValueContext(
  subject: string,
  value: string,
  language: SupportedLanguage,
): SpeechContent {
  const spokenSubject = subject.trim().replace(/[。！？!?：:；;]+$/u, '');
  const spokenValue = value.trim();
  if (!spokenSubject) return { text: spokenValue, language };

  // Cloze placeholders are surrounded with spaces while rich text is parsed.
  // Keep English spacing, but remove artificial gaps between CJK characters
  // and punctuation before sending the completed sentence to TTS.
  const joinedValue = language === 'en'
    ? spokenValue
    : spokenValue.replace(
      /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}、，。；：！？])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}、，。；：！？])/gu,
      '$1',
    );

  const text = language === 'en'
    ? `${spokenSubject} is ${joinedValue}`
    : language === 'ja'
      ? `${spokenSubject}は${joinedValue}`
      : `${spokenSubject}是${joinedValue}`;

  return {
    text,
    language,
    segments: [{ text, language: detectLanguage(text, language) }],
  };
}

function startsWithClozeValue(pieces: RichTextPiece[]): boolean {
  const firstMeaningfulPiece = pieces.find((piece) => piece.text.trim().length > 0);
  // RemNote can test each Cloze in a list as a separate card. The first list
  // item may therefore be a different, currently revealed Cloze, but the whole
  // back text is still the Descriptor's value and needs the same connector.
  return Boolean(firstMeaningfulPiece?.clozeId);
}

/**
 * RemNote stores some Descriptor Cloze cards entirely in `text`, for example
 * `变性条件：{{高温}}、{{过酸}}……`. The label before the first Cloze is the
 * Descriptor name and must become part of the spoken subject.
 */
function readDescriptorValueLabel(pieces: RichTextPiece[]): string {
  const firstClozeIndex = pieces.findIndex((piece) => Boolean(piece.clozeId));
  if (firstClozeIndex <= 0) return '';
  const prefix = pieces.slice(0, firstClozeIndex).map((piece) => piece.text).join('').trim();
  if (!/[：:]\s*$/u.test(prefix)) return '';
  return prefix.replace(/[：:]\s*$/u, '').trim();
}

function removeDescriptorValueLabel(text: string, label: string): string {
  if (!label) return text.trim();
  const spokenText = text.trim();
  if (!spokenText.startsWith(label)) return spokenText;
  return spokenText.slice(label.length).replace(/^\s*[：:]\s*/u, '').trim();
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
    // RemNote can expose a Descriptor-looking parent as an ordinary context
    // Rem for a generated Cloze card. When the back side is a value list that
    // begins with Clozes, those context levels still form the audible subject.
    // Keeping every level also supports deeply nested user templates.
    const semanticValueSubject = contextPath
      ? buildDescriptorPathSubject(
        contextPath.conceptText,
        [...contextPath.descriptorTexts, ...contextPath.contextTexts],
        contextLanguage,
      )
      : '';
    const frontDescriptorValueLabel = !clozeIsInBackText && rem.type === RemType.DESCRIPTOR
      ? readDescriptorValueLabel(pieces)
      : '';
    const frontDescriptorValueSubject = contextPath && frontDescriptorValueLabel
      ? buildDescriptorPathSubject(
        contextPath.conceptText,
        [
          ...contextPath.descriptorTexts,
          ...contextPath.contextTexts,
          frontDescriptorValueLabel,
        ],
        contextLanguage,
      )
      : '';
    const contextSegments = contextPath
      ? [contextSubject, ...contextPath.contextTexts].filter(Boolean)
      : [];
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
    const isSemanticValueCloze = Boolean(
      contextPath &&
      semanticValueSubject &&
      clozeIsInBackText &&
      startsWithClozeValue(pieces),
    );
    const isFrontDescriptorValueCloze = Boolean(frontDescriptorValueSubject);
    const valueSubject = isFrontDescriptorValueCloze
      ? frontDescriptorValueSubject
      : semanticValueSubject;
    const questionValue = isFrontDescriptorValueCloze
      ? removeDescriptorValueLabel(rendered.questionText, frontDescriptorValueLabel)
      : rendered.questionText;
    const question = isSemanticValueCloze || isFrontDescriptorValueCloze
      ? addSemanticValueContext(valueSubject, questionValue, contextLanguage)
      : addSpeechContext(rendered.questionText, contextSegments, contextLanguage);
    // Read the completed sentence after reveal instead of speaking only the
    // missing word. This keeps an answer meaningful without looking at the
    // screen: "主要和蛋白质的合成有关", not merely "蛋白质".
    const rawAnswer = piecesToPlainText(pieces) || rendered.answerText;
    const answerValue = isFrontDescriptorValueCloze
      ? removeDescriptorValueLabel(rawAnswer, frontDescriptorValueLabel)
      : rawAnswer;
    const answerLanguage = detectLanguage(`${contextSegments.join(' ')} ${rawAnswer}`, contextLanguage);
    const answer = isSemanticValueCloze || isFrontDescriptorValueCloze
      ? addSemanticValueContext(valueSubject, answerValue, answerLanguage)
      : addSpeechContext(rawAnswer, contextSegments, answerLanguage);

    return {
      cardId: activeCardId,
      remId: context.remId,
      kind: 'cloze',
      question,
      answer,
      diagnostics: {
        remType: Number(rem.type),
        clozeIsInBackText,
        startsWithClozeValue: startsWithClozeValue(pieces),
        hasContextPath: Boolean(contextPath),
        contextConcept: contextPath?.conceptText ?? '',
        descriptorTexts: contextPath?.descriptorTexts.join(' > ') ?? '',
        contextTexts: contextPath?.contextTexts.join(' > ') ?? '',
        semanticValueSubject,
        isSemanticValueCloze,
        frontDescriptorValueLabel,
        frontDescriptorValueSubject,
        isFrontDescriptorValueCloze,
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
    const ancestorContext = rem.type !== RemType.CONCEPT && rem.type !== RemType.DESCRIPTOR
      ? await readAncestorCdfContext(plugin, rem)
      : null;
    if (ancestorContext) {
      questionLanguage = detectLanguage(
        [
          ancestorContext.conceptText,
          ...ancestorContext.descriptorTexts,
          ...ancestorContext.contextTexts,
          frontText,
        ].join(' '),
        questionLanguage,
      );
    }

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

    const ancestorSubject = ancestorContext
      ? buildDescriptorPathSubject(
        ancestorContext.conceptText,
        ancestorContext.descriptorTexts,
        questionLanguage,
      )
      : '';
    const ancestorSegments = ancestorContext
      ? [ancestorSubject, ...ancestorContext.contextTexts].filter(Boolean)
      : [];

    const answerLanguage = detectLanguage(
      `${ancestorSegments.join(' ')} ${structuredCard.items.join(' ')}`,
      questionLanguage,
    );
    const childRemIndex = structuredCard.kind === 'list-answer' && structuredRoot
      ? structuredCard.itemRemIds.indexOf(initialRem._id)
      : -1;
    const trackedItemIndex = options.structuredItemIndex;
    const boundedTrackedItemIndex = structuredCard.kind === 'list-answer' &&
      trackedItemIndex !== undefined &&
      trackedItemIndex >= 0 &&
      structuredCard.items.length > 0
      ? Math.min(Math.floor(trackedItemIndex), structuredCard.items.length - 1)
      : -1;
    const activeListItemIndex = childRemIndex >= 0
      ? childRemIndex
      : boundedTrackedItemIndex;
    const readsOneListItem = activeListItemIndex >= 0;
    if (readsOneListItem && cardType !== 'backward') {
      questionText = buildOrderedItemQuestion(subject || frontText, activeListItemIndex, questionLanguage);
    } else if (structuredCard.kind === 'multi-line' && cardType !== 'backward') {
      questionText = buildMultiLineQuestion(subject || frontText, questionLanguage);
    }
    const answerItems = readsOneListItem
      ? [structuredCard.items[activeListItemIndex]]
      : structuredCard.items;
    // A normal structured card keeps its own title as the local answer subject,
    // while the CDF ancestors remain separate context segments.
    const localAnswerSubject = cardType === 'backward'
      ? undefined
      : subject ?? (ancestorContext ? frontText : undefined);
    const spokenSegments = buildStructuredAnswerSegments(
      localAnswerSubject,
      answerItems,
      structuredCard.kind,
      answerLanguage,
      readsOneListItem ? activeListItemIndex : 0,
      !readsOneListItem,
    );
    const localizedSegments = spokenSegments.map((segment) => ({
      text: segment,
      language: detectLanguage(segment, answerLanguage),
    }));
    const spokenItems = readsOneListItem
      ? spokenSegments.join(' ')
      : buildStructuredAnswer(
        localAnswerSubject,
        structuredCard.items,
        structuredCard.kind,
        answerLanguage,
      );
    const kindPrefix = structuredCard.kind === 'list-answer' ? 'list-answer' : 'multi-line';
    const contextualQuestion = addSpeechContext(
      questionText,
      ancestorSegments,
      questionLanguage,
    );
    const contextualItems = addSpeechContext(
      spokenItems,
      ancestorSegments,
      answerLanguage,
      localizedSegments,
    );

    if (cardType === 'backward') {
      return {
        cardId: activeCardId,
        remId: context.remId,
        kind: `${kindPrefix}-backward`,
        question: contextualItems,
        answer: addSpeechContext(
          backwardAnswer,
          ancestorSegments,
          detectLanguage(backwardAnswer, questionLanguage),
        ),
      };
    }

    return {
      cardId: activeCardId,
      remId: context.remId,
      kind: `${kindPrefix}-forward`,
      question: contextualQuestion,
      answer: contextualItems,
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

  // Ordinary A/B cards can still belong to a Concept-Descriptor Framework.
  // Keep the semantic CDF subject and any ordinary grouping Rems audible
  // instead of treating only the leaf's front/back text as the whole card.
  const ancestorContext = await readAncestorCdfContext(plugin, rem);
  if (ancestorContext && frontText && backText) {
    const contextLanguage = detectLanguage(
      [
        ancestorContext.conceptText,
        ...ancestorContext.descriptorTexts,
        ...ancestorContext.contextTexts,
        frontText,
        backText,
      ].join(' '),
      settings.defaultLanguage,
    );
    const contextSubject = buildDescriptorPathSubject(
      ancestorContext.conceptText,
      ancestorContext.descriptorTexts,
      contextLanguage,
    );
    const contextSegments = [contextSubject, ...ancestorContext.contextTexts].filter(Boolean);

    if (cardType === 'backward') {
      const questionLanguage = detectLanguage(backText, contextLanguage);
      return {
        cardId: activeCardId,
        remId: context.remId,
        kind: 'backward',
        question: addSpeechContext(backText, contextSegments, questionLanguage),
        answer: addSpeechContext(
          frontText,
          contextSegments,
          detectLanguage(frontText, questionLanguage),
        ),
      };
    }

    const questionLanguage = detectLanguage(frontText, contextLanguage);
    return {
      cardId: activeCardId,
      remId: context.remId,
      kind: 'forward',
      question: addSpeechContext(frontText, contextSegments, questionLanguage),
      answer: addSpeechContext(
        backText,
        [...contextSegments, frontText],
        detectLanguage(backText, questionLanguage),
      ),
    };
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
