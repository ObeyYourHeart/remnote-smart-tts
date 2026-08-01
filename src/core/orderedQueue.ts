/** Runtime state for an ordered card whose parent Card ID stays unchanged. */
export interface OrderedQueueState {
  cardKey: string;
  itemIndex: number;
  revealed: boolean | null;
}

export const INITIAL_ORDERED_QUEUE_STATE: OrderedQueueState = {
  cardKey: '',
  itemIndex: 0,
  revealed: null,
};

/**
 * Advances exactly once when RemNote moves from a revealed answer back to the
 * next question while retaining the same parent card identity.
 */
export function updateOrderedQueueState(
  previous: OrderedQueueState,
  cardKey: string,
  revealed: boolean,
): OrderedQueueState {
  if (previous.cardKey !== cardKey) {
    return { cardKey, itemIndex: 0, revealed };
  }

  return {
    cardKey,
    itemIndex: previous.itemIndex + (previous.revealed === true && revealed === false ? 1 : 0),
    revealed,
  };
}
