import type { Task } from '@/api/client';

/** One field of an instant in a zone. One `format` per field: no `formatToParts` (Hermes). */
function field(at: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', ...options })
    .format(at)
    .padStart(2, '0');
}

/**
 * The due date of a task as `dd/MM/yyyy` or `dd/MM/yyyy HH:mm`, in the zone of the family of the
 * task, never in the zone of the device. Undefined when there is no due date.
 */
export function formatDue(
  task: Pick<Task, 'dueKind' | 'due' | 'familyTimeZone'>,
): string | undefined {
  if (!task.due || !task.dueKind) return undefined;
  if (task.dueKind === 'DATE') {
    const [year, month, day] = task.due.split('-');
    return `${day}/${month}/${year}`;
  }
  const at = new Date(task.due);
  const zone = task.familyTimeZone;
  const day = field(at, zone, { day: '2-digit' });
  const month = field(at, zone, { month: '2-digit' });
  const year = field(at, zone, { year: 'numeric' });
  const hour = field(at, zone, { hour: '2-digit' });
  const minute = field(at, zone, { minute: '2-digit' });
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/** The time of day `HH:mm` (24 hours) of an instant in a zone, never in the zone of the device. */
export function formatClock(iso: string, timeZone: string): string {
  const at = new Date(iso);
  return `${field(at, timeZone, { hour: '2-digit' })}:${field(at, timeZone, { minute: '2-digit' })}`;
}
