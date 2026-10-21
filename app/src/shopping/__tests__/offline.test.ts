import type { LocalRow, QueuedMutation } from '@/sync/types';

import { isBlocked, noticeKey, viewFromRows } from '../offline';

const row = (
  entity: LocalRow['entity'],
  id: string,
  taskId: string | null,
  data = {},
): LocalRow => ({
  entity,
  id,
  familyId: 'f1',
  taskId,
  data: { id, ...data },
});

const queued = (taskId: string | null): QueuedMutation =>
  ({ mutationId: 'm', taskId }) as unknown as QueuedMutation;

describe('viewFromRows', () => {
  const rows = [
    row('task', 't1', null, { title: 'Spesa sabato', createdBy: 'p1' }),
    row('task', 't2', null, { title: 'Altro' }),
    row('shopping_item', 'i1', 't1', { taskId: 't1', text: 'latte', checked: false, position: 0 }),
    row('shopping_item', 'i2', 't2', { taskId: 't2', text: 'altro', checked: false, position: 0 }),
    // a queued «add»: only taskId, text and checked
    row('shopping_item', 'i3', 't1', { taskId: 't1', text: 'caffè', checked: false }),
  ];

  it('takes title, items and the saved person from the local rows only', () => {
    const view = viewFromRows(rows, 't1', 'p1');
    expect(view?.task.title).toBe('Spesa sabato');
    expect(view?.me).toBe('p1');
    expect(view?.items.map((i) => i.text)).toEqual(['latte', 'caffè']);
  });

  it('puts an item added offline after the others', () => {
    const items = viewFromRows(rows, 't1', 'p1')?.items ?? [];
    expect(items[1].position).toBeGreaterThan(items[0].position);
    expect(items[1].removedBy).toBeNull();
    expect(items[1].deletedAt).toBeNull();
  });

  it('is undefined when the task is not in the local rows', () => {
    expect(viewFromRows(rows, 'nope', 'p1')).toBeUndefined();
  });
});

describe('isBlocked', () => {
  it('blocks the direct actions when the last cycle was offline', () => {
    expect(isBlocked('offline', [], 't1')).toBe(true);
  });

  it('blocks them while a change of the same task waits in the queue', () => {
    expect(isBlocked('ok', [queued('t1')], 't1')).toBe(true);
  });

  it('leaves them on otherwise', () => {
    expect(isBlocked('ok', [queued('t2')], 't1')).toBe(false);
    expect(isBlocked(undefined, [], 't1')).toBe(false);
    expect(isBlocked('retry', [], 't1')).toBe(false);
  });
});

describe('noticeKey', () => {
  it('maps the sync notices to the messages of the list', () => {
    expect(noticeKey('conflict')).toBe('list.stale');
    expect(noticeKey('notFound')).toBe('list.stale');
    expect(noticeKey('invalid')).toBe('list.stale');
    expect(noticeKey('forbidden')).toBe('list.forbidden');
  });
});
