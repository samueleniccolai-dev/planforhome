import type { Task } from '@/api/client';

export type Filter = 'all' | 'mine' | 'queue' | 'dueSoon';

export const FILTERS: Filter[] = ['all', 'mine', 'queue', 'dueSoon'];

const SOON_DAYS = 7;

/** One field of an instant in a zone. One `format` per field: no `formatToParts` (Hermes). */
function field(at: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', ...options })
    .format(at)
    .padStart(2, '0');
}

/** The calendar day (`yyyy-MM-dd`) of an instant in a zone, never in the zone of the device. */
export function dayIn(at: Date, timeZone: string): string {
  const year = field(at, timeZone, { year: 'numeric' });
  const month = field(at, timeZone, { month: '2-digit' });
  const day = field(at, timeZone, { day: '2-digit' });
  return `${year}-${month}-${day}`;
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Open, with a due day up to seven days from today in the zone of its family (overdue included). */
export function isDueSoon(task: Task, now: Date): boolean {
  if (task.status !== 'OPEN' || !task.due || !task.dueKind) return false;
  const zone = task.familyTimeZone;
  const dueDay = task.dueKind === 'DATE' ? task.due : dayIn(new Date(task.due), zone);
  return dueDay <= addDays(dayIn(now, zone), SOON_DAYS);
}

export function applyFilter(filter: Filter, tasks: Task[], personId: string, now: Date): Task[] {
  switch (filter) {
    case 'mine':
      return tasks.filter((t) => t.status === 'OPEN' && t.assigneePersonId === personId);
    case 'queue':
      return tasks.filter((t) => t.status === 'OPEN' && t.assigneePersonId === null);
    case 'dueSoon':
      return tasks.filter((t) => isDueSoon(t, now));
    default:
      return tasks;
  }
}
