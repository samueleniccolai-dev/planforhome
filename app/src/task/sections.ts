import type { Task } from '@/api/client';

import { dayIn } from './filters';
import { toInstant } from './recurrence';

export type Section = 'overdue' | 'today' | 'upcoming' | 'none' | 'closed';

export const SECTIONS: Section[] = ['overdue', 'today', 'upcoming', 'none', 'closed'];

const DAY_MS = 86_400_000;

/** The first instant after the due: the instant itself, or the end of the day in the family zone. */
function dueEnd(task: Task): number {
  if (!task.due || !task.dueKind) return Number.POSITIVE_INFINITY;
  if (task.dueKind === 'DATETIME') return Date.parse(task.due);
  const next = new Date(Date.parse(`${task.due}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  return toInstant(next, '00:00', task.familyTimeZone).getTime();
}

/** The section of the list a task belongs to, always in the zone of its family. */
export function sectionOf(task: Task, now: Date): Section {
  if (task.status !== 'OPEN') return 'closed';
  if (!task.due || !task.dueKind) return 'none';
  const zone = task.familyTimeZone;
  const today = dayIn(now, zone);
  if (task.dueKind === 'DATETIME') {
    const at = Date.parse(task.due);
    if (at < now.getTime()) return 'overdue';
    const day = dayIn(new Date(at), zone);
    return day === today ? 'today' : 'upcoming';
  }
  if (task.due < today) return 'overdue';
  return task.due === today ? 'today' : 'upcoming';
}

const RANK = { HIGH: 0, NORMAL: 1, LOW: 2 } as const;

/** End of the due, then criticality (high first), then title; no due date after the others. */
export function sortInSection(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ea = dueEnd(a);
    const eb = dueEnd(b);
    if (ea !== eb) return ea < eb ? -1 : 1;
    if (a.criticality !== b.criticality) return RANK[a.criticality] - RANK[b.criticality];
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
  });
}
