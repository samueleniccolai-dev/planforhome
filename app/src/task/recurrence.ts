import type { Task } from '@/api/client';

export const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type Day = (typeof DAYS)[number];

/** The rule as the server saves it (`time` is added by the server for a DATETIME). */
export type Rule = { time?: string } & (
  | { type: 'DAILY' }
  | { type: 'EVERY_N_DAYS'; interval: number }
  | { type: 'WEEKLY'; days: Day[] }
  | { type: 'MONTHLY'; dayOfMonth: number }
);

export type RuleKind = 'never' | 'daily' | 'everyN' | 'weekly' | 'monthly';
export type RuleForm = { kind: RuleKind; interval: string; days: Day[]; dayOfMonth: string };

export const emptyRuleForm: RuleForm = { kind: 'never', interval: '', days: [], dayOfMonth: '' };

const DAY_MS = 86_400_000;

/** A calendar date as `yyyy-mm-dd`; arithmetic goes through UTC midnights. */
const ms = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (at: number) => new Date(at).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => iso(ms(date) + n * DAY_MS);
const weekday = (date: string): Day => DAYS[(new Date(ms(date)).getUTCDay() + 6) % 7];
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, '0');

/** One field of an instant in a zone. One `format` per field: no `formatToParts` (Hermes). */
function field(at: number, timeZone: string, options: Intl.DateTimeFormatOptions): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', ...options }).format(
      new Date(at),
    ),
  );
}

/** The wall clock of an instant in a zone, as if it were UTC (milliseconds, whole minutes). */
function wallMs(at: number, zone: string): number {
  return Date.UTC(
    field(at, zone, { year: 'numeric' }),
    field(at, zone, { month: 'numeric' }) - 1,
    field(at, zone, { day: 'numeric' }),
    field(at, zone, { hour: '2-digit' }),
    field(at, zone, { minute: '2-digit' }),
  );
}

const offsetAt = (at: number, zone: string) => wallMs(at, zone) - Math.floor(at / 60000) * 60000;

/** The local date (`yyyy-mm-dd`) and time (`hh:mm`) of an instant in a zone. */
function localOf(at: number, zone: string): { date: string; time: string } {
  const text = new Date(wallMs(at, zone)).toISOString();
  return { date: text.slice(0, 10), time: text.slice(11, 16) };
}

/**
 * Local date and time in a zone to a UTC instant, like `ZonedDateTime.of`: a time in the spring
 * gap moves forward by the length of the gap (02:30 becomes 03:30); a time that happens twice in
 * autumn is the first one.
 */
export function toInstant(date: string, time: string, zone: string): Date {
  const wall = Date.parse(`${date}T${time}:00Z`);
  const offsets = new Set([offsetAt(wall - DAY_MS, zone), offsetAt(wall + DAY_MS, zone)]);
  const valid = [...offsets].map((o) => wall - o).filter((at) => offsetAt(at, zone) === wall - at);
  if (valid.length > 0) return new Date(Math.min(...valid));
  return new Date(wall - offsetAt(wall - DAY_MS, zone));
}

/** The first date of the rule after `day` (same rules as the server). */
function after(rule: Rule, day: string): string {
  switch (rule.type) {
    case 'DAILY':
      return addDays(day, 1);
    case 'EVERY_N_DAYS':
      return addDays(day, rule.interval);
    case 'WEEKLY': {
      let next = addDays(day, 1);
      while (!rule.days.includes(weekday(next))) next = addDays(next, 1);
      return next;
    }
    case 'MONTHLY': {
      let year = Number(day.slice(0, 4));
      let month = Number(day.slice(5, 7));
      let candidate = `${year}-${pad(month)}-${pad(Math.min(rule.dayOfMonth, lastDay(year, month)))}`;
      if (candidate <= day) {
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        candidate = `${year}-${pad(month)}-${pad(Math.min(rule.dayOfMonth, lastDay(year, month)))}`;
      }
      return candidate;
    }
  }
}

/**
 * The due the server would give to the next occurrence if the task were closed at `now`: the first
 * date of the rule after the day of the due that is not already past. Undefined for a task that
 * does not repeat.
 */
export function nextDue(
  task: Pick<Task, 'dueKind' | 'due' | 'familyTimeZone' | 'recurrence'>,
  now: Date,
): { dueKind: 'DATE' | 'DATETIME'; due: string } | undefined {
  const rule = task.recurrence;
  if (!rule || !task.due || !task.dueKind) return undefined;
  const zone = task.familyTimeZone;
  const today = localOf(now.getTime(), zone).date;
  if (task.dueKind === 'DATE') {
    let day = task.due;
    do day = after(rule, day);
    while (day < today);
    return { dueKind: 'DATE', due: day };
  }
  const previous = localOf(Date.parse(task.due), zone);
  const time = rule.time ?? previous.time;
  let day = previous.date;
  for (;;) {
    day = after(rule, day);
    const at = toInstant(day, time, zone);
    if (at.getTime() > now.getTime()) return { dueKind: 'DATETIME', due: at.toISOString() };
  }
}

/** The line "Repeats: ..." as a translation key, its numbers and its days (Monday to Sunday). */
export function describe(rule: Rule): { key: string; params: Record<string, string>; days: Day[] } {
  switch (rule.type) {
    case 'DAILY':
      return { key: 'recurrence.rule.daily', params: {}, days: [] };
    case 'EVERY_N_DAYS':
      return { key: 'recurrence.rule.everyN', params: { n: String(rule.interval) }, days: [] };
    case 'WEEKLY':
      return {
        key: 'recurrence.rule.weekly',
        params: {},
        days: DAYS.filter((d) => rule.days.includes(d)),
      };
    case 'MONTHLY':
      return {
        key: 'recurrence.rule.monthly',
        params: { day: String(rule.dayOfMonth) },
        days: [],
      };
  }
}

function whole(text: string, min: number, max: number): number | undefined {
  if (!/^\d{1,4}$/.test(text.trim())) return undefined;
  const n = Number(text.trim());
  return n >= min && n <= max ? n : undefined;
}

/** The rule to send (undefined for "never"), or `error` when the form is not valid. */
export function buildRule(form: RuleForm): { rule: Rule | undefined } | { error: true } {
  switch (form.kind) {
    case 'never':
      return { rule: undefined };
    case 'daily':
      return { rule: { type: 'DAILY' } };
    case 'everyN': {
      const interval = whole(form.interval, 2, 365);
      return interval === undefined
        ? { error: true }
        : { rule: { type: 'EVERY_N_DAYS', interval } };
    }
    case 'weekly': {
      const days = DAYS.filter((d) => form.days.includes(d));
      return days.length === 0 ? { error: true } : { rule: { type: 'WEEKLY', days } };
    }
    case 'monthly': {
      const dayOfMonth = whole(form.dayOfMonth, 1, 31);
      return dayOfMonth === undefined ? { error: true } : { rule: { type: 'MONTHLY', dayOfMonth } };
    }
  }
}

/** `gg/mm/aaaa` to `yyyy-mm-dd`, only for a real calendar date. */
export function parseDue(text: string): string | undefined {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return undefined;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > lastDay(year, month)) return undefined;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** `hh:mm` to a normalised `hh:mm`, only for a real time of day. */
export function parseTime(text: string): string | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return undefined;
  return `${pad(Number(m[1]))}:${m[2]}`;
}
