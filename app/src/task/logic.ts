import type { FamilyMember, Task } from '@/api/client';

import { uuidv7 } from './ids';

export type Ids = { id: string; mutationId: string };
export type Attempt = { key: string; ids: Ids };

export const newIds = (): Ids => ({ id: uuidv7(), mutationId: uuidv7() });

/**
 * The identifiers of a write. The same ones are reused only to retry the same operation with the
 * same content (same `key`); other content gets new ones.
 */
export function attemptFor(previous: Attempt | undefined, key: string, make = newIds): Attempt {
  return previous && previous.key === key ? previous : { key, ids: make() };
}

/** Puts a task in the list: replaces by id if newer (or forced), appends if unknown. */
export function mergeTask(list: Task[], incoming: Task, force = false): Task[] {
  const at = list.findIndex((t) => t.id === incoming.id);
  if (at < 0) return [...list, incoming];
  if (!force && incoming.version <= list[at].version) return list;
  return list.map((t, i) => (i === at ? incoming : t));
}

/** A reload merged into the list: each task goes through `mergeTask`, the higher version wins. */
export function mergeAll(list: Task[], incoming: Task[]): Task[] {
  return incoming.reduce((acc, task) => mergeTask(acc, task), list);
}

export function nameOf(
  people: Pick<FamilyMember, 'personId' | 'displayName'>[],
  id: string | null,
) {
  return people.find((p) => p.personId === id)?.displayName ?? '?';
}
