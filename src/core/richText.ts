import type { RNPlugin, RichTextInterface } from '@remnote/plugin-sdk';
import { detectClozeLanguage } from './language';
import type { LanguageVoiceMap, RenderedCloze, RichTextPiece, SupportedLanguage } from './types';

const CLOZE_SENTINEL = '\uFFF0CLOZE\uFFF1';

function normalizeSpeechText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?，。；：！？])/g, '$1')
    .trim();
}

/**
 * Resolves Rem references recursively while preventing reference loops.
 */
export async function richTextToPieces(
  plugin: RNPlugin,
  richText: RichTextInterface | undefined,
  visitedRemIds: Set<string> = new Set(),
): Promise<RichTextPiece[]> {
  if (!richText) return [];
  const pieces: RichTextPiece[] = [];

  for (const element of richText) {
    if (typeof element === 'string') {
      pieces.push({ text: element });
      continue;
    }

    if (!element || typeof element !== 'object') continue;
    const item = element as Record<string, unknown>;

    if (item.i === 'm' && typeof item.text === 'string') {
      pieces.push({ text: item.text, clozeId: typeof item.cId === 'string' ? item.cId : undefined });
      continue;
    }

    if (item.i === 'q' && typeof item._id === 'string') {
      const referenceId = item._id;
      if (visitedRemIds.has(referenceId)) continue;

      try {
        const nextVisited = new Set(visitedRemIds).add(referenceId);
        const referencedRem = await plugin.rem.findOne(referenceId);
        if (referencedRem?.text) {
          pieces.push(...(await richTextToPieces(plugin, referencedRem.text, nextVisited)));
        } else if (Array.isArray(item.textOfDeletedRem)) {
          pieces.push(...(await richTextToPieces(plugin, item.textOfDeletedRem as RichTextInterface, nextVisited)));
        }
      } catch (error) {
        console.warn('Smart Flashcard TTS skipped an unreadable Rem reference.', error);
      }
      continue;
    }

    // LaTeX and annotations have useful source text, even if pronunciation is not always ideal.
    if ((item.i === 'x' || item.i === 'n') && typeof item.text === 'string') {
      pieces.push({ text: item.text, clozeId: typeof item.cId === 'string' ? item.cId : undefined });
      continue;
    }

    // A card delimiter becomes a short spoken pause instead of being read literally.
    if (item.i === 's') pieces.push({ text: '. ' });
  }

  return pieces;
}

export function piecesToPlainText(pieces: RichTextPiece[]): string {
  return normalizeSpeechText(pieces.map((piece) => piece.text).join(''));
}

/**
 * Replaces each contiguous section of the active Cloze with one language-aware word.
 * Other Clozes stay visible because they belong to different cards.
 */
export function renderActiveCloze(
  pieces: RichTextPiece[],
  activeClozeId: string,
  clozeWords: LanguageVoiceMap,
  fallbackLanguage: SupportedLanguage,
): RenderedCloze {
  let questionWithSentinels = '';
  const answerGroups: string[] = [];
  let activeAnswer = '';
  let wasInsideActiveCloze = false;

  const finishAnswerGroup = () => {
    const normalized = normalizeSpeechText(activeAnswer);
    if (normalized) answerGroups.push(normalized);
    activeAnswer = '';
  };

  for (const piece of pieces) {
    const isActive = piece.clozeId === activeClozeId;
    if (isActive) {
      if (!wasInsideActiveCloze) {
        questionWithSentinels += CLOZE_SENTINEL;
        finishAnswerGroup();
      }
      activeAnswer += piece.text;
    } else {
      if (wasInsideActiveCloze) finishAnswerGroup();
      questionWithSentinels += piece.text;
    }
    wasInsideActiveCloze = isActive;
  }
  if (wasInsideActiveCloze) finishAnswerGroup();

  const firstSentinelIndex = questionWithSentinels.indexOf(CLOZE_SENTINEL);
  const visibleQuestion = questionWithSentinels.replaceAll(CLOZE_SENTINEL, ' ');
  const placeholderLanguage = detectClozeLanguage(
    visibleQuestion,
    Math.max(0, firstSentinelIndex),
    fallbackLanguage,
  );
  const questionText = normalizeSpeechText(
    questionWithSentinels.replaceAll(CLOZE_SENTINEL, ` ${clozeWords[placeholderLanguage]} `),
  );

  return {
    questionText,
    answerText: answerGroups.join(' / '),
    placeholderLanguage,
  };
}
