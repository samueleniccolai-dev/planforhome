import type { Item } from '@/api/client';

import { canClearChecked, canRemoveStruck, groupItems, whoAdded } from '../logic';

const item = (id: string, position: number, extra: Partial<Item> = {}): Item => ({
  id,
  taskId: 't',
  text: id,
  checked: false,
  position,
  version: 1,
  createdBy: 'p1',
  removedBy: null,
  deletedAt: null,
  ...extra,
});

describe('groupItems', () => {
  it('splits alive, checked and struck items, each by position, and drops the cancelled', () => {
    const groups = groupItems([
      item('c', 2),
      item('a', 0),
      item('b', 1, { checked: true }),
      item('d', 3, { removedBy: 'p2' }),
      item('e', 4, { deletedAt: '2031-01-06T08:00:00Z', removedBy: 'p2' }),
    ]);
    expect(groups.toGet.map((i) => i.id)).toEqual(['a', 'c']);
    expect(groups.checked.map((i) => i.id)).toEqual(['b']);
    expect(groups.removed.map((i) => i.id)).toEqual(['d']);
  });

  it('puts a struck and checked item among the struck ones only', () => {
    const groups = groupItems([item('a', 0, { checked: true, removedBy: 'p2' })]);
    expect(groups.checked).toEqual([]);
    expect(groups.removed).toHaveLength(1);
  });
});

describe('buttons shown', () => {
  const task = { createdBy: 'creator', assigneePersonId: 'assignee' };
  it('clear checked: creator, manager or assignee', () => {
    expect(canClearChecked(task, 'creator', 'MEMBER')).toBe(true);
    expect(canClearChecked(task, 'x', 'MANAGER')).toBe(true);
    expect(canClearChecked(task, 'assignee', 'MEMBER')).toBe(true);
    expect(canClearChecked(task, 'x', 'MEMBER')).toBe(false);
  });
  it('remove a struck item: creator or manager, not the assignee', () => {
    expect(canRemoveStruck(task, 'creator', 'MEMBER')).toBe(true);
    expect(canRemoveStruck(task, 'x', 'MANAGER')).toBe(true);
    expect(canRemoveStruck(task, 'assignee', 'MEMBER')).toBe(false);
  });
});

describe('whoAdded', () => {
  const people = [{ personId: 'p1', displayName: 'Anna' }];
  it('is undefined for the creator of the list, a name for others, null for who left', () => {
    expect(whoAdded(item('a', 0), { createdBy: 'p1' }, people)).toBeUndefined();
    expect(whoAdded(item('a', 0), { createdBy: 'p9' }, people)).toBe('Anna');
    expect(whoAdded(item('a', 0, { createdBy: 'p7' }), { createdBy: 'p9' }, people)).toBeNull();
  });
});
