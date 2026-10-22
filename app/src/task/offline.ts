import type { Task } from '@/api/client';
import type { Directory, LocalRow, Member, SyncNotice } from '@/sync/types';

import { dayIn } from './filters';

function dueOf(data: Record<string, unknown>, zone: string): string | null {
  if (typeof data.due === 'string') return data.due;
  if (typeof data.dueAt !== 'string') return null;
  return data.dueKind === 'DATE' ? dayIn(new Date(data.dueAt), zone) : data.dueAt;
}

/** The tasks of one family as the local rows tell them, with no call to the API. */
export function tasksFromRows(rows: LocalRow[], directory: Directory): Task[] {
  const zone = directory.family?.timeZone ?? 'UTC';
  return rows
    .filter((r) => r.entity === 'task' && typeof r.data.title === 'string' && !r.data.forwardedTo)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => {
      const d = r.data;
      return {
        notes: null,
        dueKind: null,
        criticality: 'NORMAL',
        status: 'OPEN',
        assigneePersonId: null,
        completedBy: null,
        version: 0,
        updatedAt: '',
        ...d,
        id: r.id,
        familyId: r.familyId,
        familyTimeZone: zone,
        due: dueOf(d, zone),
      } as unknown as Task;
    });
}

/** The discreet notice for a refused change of a task (`undefined`: not about a task). */
export function taskNotice(
  notice: SyncNotice,
  members: Member[],
): { key: string; params?: Record<string, string> } | undefined {
  if (notice.entity !== 'task') return undefined;
  switch (notice.kind) {
    case 'conflict': {
      if (notice.detail?.error !== 'already_taken') return { key: 'task.changed' };
      const id = notice.detail.assigneePersonId;
      const known = members.find((m) => m.personId === id)?.displayName;
      const name = known ?? (notice.detail.assigneeName as string | undefined) ?? '?';
      return { key: 'task.taken', params: { name } };
    }
    case 'forbidden':
      return {
        key: notice.path.endsWith('/forward') ? 'task.forward.forbidden' : 'task.forbidden',
      };
    default:
      return { key: 'task.stale' };
  }
}
