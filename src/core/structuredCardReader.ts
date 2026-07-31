import { BuiltInPowerupCodes, RemType, type Rem, type RNPlugin } from '@remnote/plugin-sdk';
import { piecesToPlainText, richTextToPieces } from './richText';
import type { StructuredCardKind } from './structuredCards';

export interface StructuredCardData {
  kind: StructuredCardKind;
  items: string[];
}

async function hasMultiLinePowerup(rem: Rem): Promise<boolean> {
  return rem.hasPowerup(BuiltInPowerupCodes.MultiLineCard);
}

async function hasDirectCardItems(rem: Rem): Promise<boolean> {
  const children = await rem.getChildrenRem();
  const childMarkers = await Promise.all(children.map((child) => child.isCardItem()));
  return childMarkers.some(Boolean);
}

/**
 * Queue contexts for structured cards may identify either the parent card Rem
 * or one of its direct card-item children. Normalize both forms to the parent.
 */
export async function resolveStructuredCardRoot(rem: Rem): Promise<Rem | null> {
  try {
    if (await hasMultiLinePowerup(rem)) return rem;

    // Concept and Descriptor Rems are meaningful cards in their own right.
    // Never replace one with its parent merely because it is also displayed as
    // a nested item in a Multi-Line layout.
    if (rem.type === RemType.CONCEPT || rem.type === RemType.DESCRIPTOR) return null;

    // A normal Concept/Descriptor card can live below a parent that also owns
    // Multi-Line cards. If this Rem already has its own answer, keep it as the
    // active card instead of incorrectly replacing it with the parent.
    if (Array.isArray(rem.backText) && rem.backText.length > 0) return null;
    if (!(await rem.isCardItem())) return null;

    const parentRem = await rem.getParentRem();
    if (!parentRem) return null;
    if (await hasMultiLinePowerup(parentRem)) return parentRem;

    // Native ordered cards can omit the MultiLineCard powerup in queue RPCs.
    // A card-item child whose parent contains direct card-item children is a
    // stronger structural signal than DOM numbering, so safely keep the parent.
    if (await hasDirectCardItems(parentRem)) return parentRem;
    return null;
  } catch (error) {
    console.warn('Could not resolve the structured flashcard parent.', error);
    return null;
  }
}

/**
 * Reads the direct card-item children used by native Multi-Line and
 * List-Answer cards. Nested descendants are intentionally excluded because
 * RemNote reveals only direct children on the parent card by default.
 */
export async function readStructuredCard(
  plugin: RNPlugin,
  rem: Rem,
  allowUnmarked = false,
): Promise<StructuredCardData | null> {
  try {
    if (!allowUnmarked && !(await hasMultiLinePowerup(rem))) return null;

    const children = await rem.getChildrenRem();
    const childData = await Promise.all(
      children.map(async (child) => {
        if (!(await child.isCardItem())) return null;
        const pieces = await richTextToPieces(plugin, child.text);
        const text = piecesToPlainText(pieces).trim();
        if (!text) return null;
        return { text, isListItem: await child.isListItem() };
      }),
    );

    const cardItems = childData.filter(
      (item): item is { text: string; isListItem: boolean } => item !== null,
    );
    // `isCardItem()` is the actual child-level SDK marker. Some native
    // Descriptor Multi-Line cards expose these children without reporting the
    // parent MultiLineCard powerup, so do not require both signals.
    if (cardItems.length === 0) return null;

    return {
      // A List-Answer card marks every answer child as an ordered list item.
      // Mixed structures stay Multi-Line instead of inventing a false order.
      kind: cardItems.every((item) => item.isListItem) ? 'list-answer' : 'multi-line',
      items: cardItems.map((item) => item.text),
    };
  } catch (error) {
    console.warn('Could not read structured flashcard children.', error);
    return null;
  }
}
