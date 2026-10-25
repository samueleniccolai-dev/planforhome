import { quickBlocked } from '../quickBlocked';

describe('quickBlocked', () => {
  const queue = [{ taskId: 'a' }, { taskId: null }, { taskId: 'b' }];
  it('is true for a task with a queued mutation', () => {
    expect(quickBlocked('a', queue)).toBe(true);
    expect(quickBlocked('b', queue)).toBe(true);
  });
  it('is false for any other task and for an empty queue', () => {
    expect(quickBlocked('c', queue)).toBe(false);
    expect(quickBlocked('a', [])).toBe(false);
  });
});
