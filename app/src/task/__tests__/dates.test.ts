import type { Task } from '@/api/client';

import { formatClock, formatDue } from '../dates';

const base: Task = {
  id: 't',
  familyId: 'f',
  familyTimeZone: 'Europe/Rome',
  title: 'T',
  notes: null,
  dueKind: null,
  due: null,
  criticality: 'NORMAL',
  status: 'OPEN',
  assigneePersonId: null,
  createdBy: 'p',
  completedBy: null,
  version: 1,
  updatedAt: '2026-10-20T08:00:00Z',
};
const at = (familyTimeZone: string, due: string): Task => ({
  ...base,
  familyTimeZone,
  dueKind: 'DATETIME',
  due,
});

describe('formatDue', () => {
  it('shows nothing without a due date', () => {
    expect(formatDue(base)).toBeUndefined();
  });

  it('shows a DATE as it is', () => {
    expect(formatDue({ ...base, dueKind: 'DATE', due: '2026-12-20' })).toBe('20/12/2026');
    expect(
      formatDue({
        ...base,
        familyTimeZone: 'America/New_York',
        dueKind: 'DATE',
        due: '2026-01-05',
      }),
    ).toBe('05/01/2026');
  });

  it('shows a DATETIME in the zone of the family, 24 hours', () => {
    expect(formatDue(at('Europe/Rome', '2026-11-03T17:30:00Z'))).toBe('03/11/2026 18:30');
    expect(formatDue(at('Europe/Rome', '2026-07-03T22:05:00Z'))).toBe('04/07/2026 00:05');
  });

  it('is right on both daylight saving changes of Rome', () => {
    expect(formatDue(at('Europe/Rome', '2026-03-29T00:30:00Z'))).toBe('29/03/2026 01:30');
    expect(formatDue(at('Europe/Rome', '2026-03-29T01:30:00Z'))).toBe('29/03/2026 03:30');
    expect(formatDue(at('Europe/Rome', '2026-10-25T00:30:00Z'))).toBe('25/10/2026 02:30');
    expect(formatDue(at('Europe/Rome', '2026-10-25T01:30:00Z'))).toBe('25/10/2026 02:30');
  });

  it('is right on both daylight saving changes of New York', () => {
    expect(formatDue(at('America/New_York', '2026-03-08T06:59:00Z'))).toBe('08/03/2026 01:59');
    expect(formatDue(at('America/New_York', '2026-03-08T07:00:00Z'))).toBe('08/03/2026 03:00');
    expect(formatDue(at('America/New_York', '2026-11-01T05:30:00Z'))).toBe('01/11/2026 01:30');
    expect(formatDue(at('America/New_York', '2026-11-01T16:00:00Z'))).toBe('01/11/2026 11:00');
  });

  it('never uses the zone of the device', () => {
    const original = process.env.TZ;
    process.env.TZ = 'Asia/Tokyo';
    try {
      expect(formatDue(at('Europe/Rome', '2026-11-03T17:30:00Z'))).toBe('03/11/2026 18:30');
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('formatClock', () => {
  it('shows the time in the zone of the family, 24 hours', () => {
    expect(formatClock('2026-10-20T07:15:00Z', 'Europe/Rome')).toBe('09:15');
    expect(formatClock('2026-10-20T07:15:00Z', 'America/New_York')).toBe('03:15');
    expect(formatClock('2026-10-20T22:05:00Z', 'Asia/Tokyo')).toBe('07:05');
  });

  it('follows the change of the clocks on 25/10/2026 in Rome', () => {
    expect(formatClock('2026-10-25T00:30:00Z', 'Europe/Rome')).toBe('02:30'); // still CEST
    expect(formatClock('2026-10-25T01:30:00Z', 'Europe/Rome')).toBe('02:30'); // CET, repeated hour
    expect(formatClock('2026-10-25T02:30:00Z', 'Europe/Rome')).toBe('03:30');
  });

  it('writes midnight as 00:xx', () => {
    expect(formatClock('2026-10-20T22:05:00Z', 'Europe/Rome')).toBe('00:05');
  });
});
