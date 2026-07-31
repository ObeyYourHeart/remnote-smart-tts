import { BuiltInPowerupCodes, type Rem, type RNPlugin } from '@remnote/plugin-sdk';
import { piecesToPlainText, richTextToPieces } from './richText';
import type { StructuredCardKind } from './structuredCards';

export interface StructuredCardData {
  kind: StructuredCardKind;
  items: string[];
}

/**
 * Reads the direct card-item children used by native Multi-Line and
 * List-Answer cards. Nested descendants are intentionally excluded because
 * RemNote reveals only direct children on the parent card by default.
 */
export async function readStructuredCard(
  plugin: RNPlugin,
  rem: Rem,
): Promise<StructuredCardData | null> {
  try {
    if (!(await rem.hasPowerup(BuiltInPowerupCodes.MultiLineCard))) return null;

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
