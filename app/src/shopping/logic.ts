import type { FamilyMember, Item, Task } from '@/api/client';

type Role = 'MANAGER' | 'MEMBER';

export type Groups = { toGet: Item[]; checked: Item[]; removed: Item[] };

const byPosition = (a: Item, b: Item) => a.position - b.position;

/** The three lists of the screen. A cancelled item is in none; a struck one is only «removed». */
export function groupItems(items: Item[]): Groups {
  const shown = items.filter((i) => !i.deletedAt).sort(byPosition);
  return {
    toGet: shown.filter((i) => !i.removedBy && !i.checked),
    checked: shown.filter((i) => !i.removedBy && i.checked),
    removed: shown.filter((i) => i.removedBy),
  };
}

type Owner = Pick<Task, 'createdBy' | 'assigneePersonId'>;

/** A help for the eyes only: the server decides who clears the checked items. */
export function canClearChecked(task: Owner, me: string, role: Role): boolean {
  return role === 'MANAGER' || task.createdBy === me || task.assigneePersonId === me;
}

/** Same for removing a struck item for good: creator and managers. */
export function canRemoveStruck(task: Owner, me: string, role: Role): boolean {
  return role === 'MANAGER' || task.createdBy === me;
}

/** Undefined: added by the creator of the list. Null: added by somebody no longer in the family. */
export function whoAdded(
  item: Item,
  task: Pick<Task, 'createdBy'>,
  people: Pick<FamilyMember, 'personId' | 'displayName'>[],
): string | null | undefined {
  if (item.createdBy === task.createdBy) return undefined;
  return people.find((p) => p.personId === item.createdBy)?.displayName ?? null;
}

/**
 * A reload merged into the screen: the higher version wins, as for the tasks. An item missing from
 * the answer stays until a write on it answers 404 (the screen then drops it).
 */
export function mergeItems(current: Item[], incoming: Item[]): Item[] {
  const merged = current.map((c) => {
    const fresh = incoming.find((i) => i.id === c.id);
    return fresh && fresh.version >= c.version ? fresh : c;
  });
  return [...merged, ...incoming.filter((i) => !current.some((c) => c.id === i.id))];
}

const idsInOrder = (items: Item[]) =>
  items
    .filter((i) => !i.deletedAt)
    .sort(byPosition)
    .map((i) => i.id);

/**
 * Swaps an item to get with its neighbour to get. Gives all the items not cancelled, positions
 * reassigned 0..n, or undefined when the item cannot move.
 */
export function moveItem(items: Item[], id: string, direction: 'up' | 'down'): Item[] | undefined {
  const all = items.filter((i) => !i.deletedAt).sort(byPosition);
  const toGet = all.filter((i) => !i.removedBy && !i.checked);
  const at = toGet.findIndex((i) => i.id === id);
  const other = toGet[at + (direction === 'up' ? -1 : 1)];
  if (at < 0 || !other) return undefined;
  const from = all.indexOf(toGet[at]);
  const to = all.indexOf(other);
  [all[from], all[to]] = [all[to], all[from]];
  return all.map((i, position) => ({ ...i, position }));
}

/**
 * The answer of a reorder: with another reorder pending (the local order is not the one sent) it
 * is not merged, so it cannot bring back an older order; otherwise the order of the server wins.
 */
export function applyOrderAnswer(local: Item[], answer: Item[], sent: string[]): Item[] {
  const pending = idsInOrder(local).join() !== sent.join();
  return pending ? local : mergeItems(local, answer);
}

export const orderOf = idsInOrder;
