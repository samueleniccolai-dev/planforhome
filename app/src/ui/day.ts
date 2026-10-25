// Calendar days as `yyyy-mm-dd` and months as `yyyy-mm`: plain dates, no time zone in play.
// Arithmetic goes through UTC midnights so a change of summer time cannot move a day.

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const pad = (n: number) => String(n).padStart(2, '0');

function words(day: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(utc(day));
}

/** «venerdì 30 ottobre 2026» */
export function longDay(day: string, locale: string): string {
  return words(day, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** «ottobre 2026» */
export function monthTitle(month: string, locale: string): string {
  return words(`${month}-01`, locale, { month: 'long', year: 'numeric' });
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}`;
}

/** The days of a month, Monday first: `null` pads the first week. */
export function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number);
  const lead = (utc(`${month}-01`).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
}

/** «L», «M», … for the header of the grid. */
export function weekdayInitials(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    words(`2026-10-${pad(5 + i)}`, locale, { weekday: 'narrow' }),
  );
}
