import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INITIAL_ORDERED_QUEUE_STATE,
  updateOrderedQueueState,
} from '../src/core/orderedQueue';

test('tracks each ordered child from reveal back to the next question', () => {
  const questionOne = updateOrderedQueueState(INITIAL_ORDERED_QUEUE_STATE, 'parent-card', false);
  const answerOne = updateOrderedQueueState(questionOne, 'parent-card', true);
  const questionTwo = updateOrderedQueueState(answerOne, 'parent-card', false);
  const repeatedQuestionTwo = updateOrderedQueueState(questionTwo, 'parent-card', false);
  const answerTwo = updateOrderedQueueState(repeatedQuestionTwo, 'parent-card', true);
  const questionThree = updateOrderedQueueState(answerTwo, 'parent-card', false);

  assert.equal(questionOne.itemIndex, 0);
  assert.equal(answerOne.itemIndex, 0);
  assert.equal(questionTwo.itemIndex, 1);
  assert.equal(repeatedQuestionTwo.itemIndex, 1);
  assert.equal(questionThree.itemIndex, 2);
});

test('resets the ordered index when RemNote loads another parent card', () => {
  const previous = { cardKey: 'old-card', itemIndex: 2, revealed: true };
  assert.deepEqual(updateOrderedQueueState(previous, 'new-card', false), {
    cardKey: 'new-card',
    itemIndex: 0,
    revealed: false,
  });
});
