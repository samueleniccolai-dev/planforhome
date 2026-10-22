import type { Item, Task } from '@/api/client';
import type { LocalRow, QueuedMutation, SyncNotice, SyncResult } from '@/sync/types';

export type OfflineView = {
  task: Task;
  people: never[];
  role: 'MANAGER' | 'MEMBER';
  me: string;
  items: Item[];
};

/**
 * The list as the local rows tell it, with no call to the API. The role and the names of the
 * family are not kept locally: the screen shows a helpful guess and the server decides.
 */
export function viewFromRows(
  rows: LocalRow[],
  taskId: string,
  personId: string | undefined,
): OfflineView | undefined {
  const task = rows.find((r) => r.entity === 'task' && r.id === taskId);
  if (!task) return undefined;
  const mine = rows.filter((r) => r.entity === 'shopping_item' && r.taskId === taskId);
  const last = Math.max(-1, ...mine.map((r) => (r.data.position as number | undefined) ?? -1));
  let extra = 0;
  const items = mine.map((r): Item => {
    const d = r.data as Partial<Item>;
    return {
      id: r.id,
      taskId,
      text: d.text ?? '',
      checked: d.checked ?? false,
      position: d.position ?? last + 1 + extra++,
      version: d.version ?? 0,
      createdBy: d.createdBy ?? personId ?? '',
      removedBy: d.removedBy ?? null,
      deletedAt: d.deletedAt ?? null,
    };
  });
  return {
    task: task.data as unknown as Task,
    people: [],
    role: 'MEMBER',
    me: personId ?? '',
    items,
  };
}

/** The actions that go straight to the API wait for the network and for the queue of the task. */
export function isBlocked(
  last: SyncResult['status'] | undefined,
  queue: Pick<QueuedMutation, 'taskId'>[],
  taskId: string,
): boolean {
  return last === 'offline' || queue.some((m) => m.taskId === taskId);
}

export function noticeKey(kind: SyncNotice['kind']): string {
  return kind === 'forbidden' ? 'list.forbidden' : 'list.stale';
}
