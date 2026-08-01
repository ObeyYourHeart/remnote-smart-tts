import { BuiltInPowerupCodes, RemType, type Rem, type RNPlugin } from '@remnote/plugin-sdk';
import { piecesToPlainText, richTextToPieces } from './richText';
import type { StructuredCardKind } from './structuredCards';

export interface StructuredCardData {
  kind: StructuredCardKind;
  items: string[];
  itemRemIds: string[];
}

interface StructuredCardItemData {
  remId: string;
  text: string;
  isListItem: boolean;
  nested: boolean;
}

const MAX_GROUPING_DEPTH = 8;

/**
 * Reads tested children in outline order. Recursion is deliberately limited
 * to ordinary grouping Rems; descendants of a card item belong to that item's
 * own card and must not be expanded automatically.
 */
async function readGroupedCardItems(
  plugin: RNPlugin,
  children: Rem[],
  groupingTexts: string[] = [],
  depth = 0,
  visitedRemIds: Set<string> = new Set(),
): Promise<StructuredCardItemData[]> {
  const items: StructuredCardItemData[] = [];

  for (const child of children) {
    try {
      if (child._id && visitedRemIds.has(child._id)) continue;
      const nextVisited = new Set(visitedRemIds);
      if (child._id) nextVisited.add(child._id);

      const childText = piecesToPlainText(await richTextToPieces(plugin, child.text)).trim();
      if (await child.isCardItem()) {
        if (!childText) continue;
        items.push({
          remId: child._id,
          text: [...groupingTexts, childText].join('：'),
          isListItem: await child.isListItem(),
          nested: groupingTexts.length > 0,
        });
        continue;
      }

      if (depth >= MAX_GROUPING_DEPTH || typeof child.getChildrenRem !== 'function') continue;
      const descendants = await child.getChildrenRem();
      if (descendants.length === 0) continue;
      items.push(...await readGroupedCardItems(
        plugin,
        descendants,
        childText ? [...groupingTexts, childText] : groupingTexts,
        depth + 1,
        nextVisited,
      ));
    } catch (error) {
      console.warn('RemNote Smart TTS skipped an unreadable structured-card branch.', error);
    }
  }

  return items;
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
 * Reads direct card items and card items nested below ordinary grouping Rems.
 * Descendants of an existing card item stay excluded because RemNote can test
 * that item independently.
 */
export async function readStructuredCard(
  plugin: RNPlugin,
  rem: Rem,
  allowUnmarked = false,
): Promise<StructuredCardData | null> {
  try {
    if (!allowUnmarked && !(await hasMultiLinePowerup(rem))) return null;

    const children = await rem.getChildrenRem();
    const cardItems = await readGroupedCardItems(plugin, children);
    // `isCardItem()` is the actual child-level SDK marker. Some native
    // Descriptor Multi-Line cards expose these children without reporting the
    // parent MultiLineCard powerup, so do not require both signals.
    if (cardItems.length === 0) return null;

    return {
      // A List-Answer card marks every answer child as an ordered list item.
      // Mixed structures stay Multi-Line instead of inventing a false order.
      kind: cardItems.every((item) => item.isListItem && !item.nested)
        ? 'list-answer'
        : 'multi-line',
      items: cardItems.map((item) => item.text),
      itemRemIds: cardItems.map((item) => item.remId),
    };
  } catch (error) {
    console.warn('Could not read structured flashcard children.', error);
    return null;
  }
}
