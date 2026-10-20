import type { Task } from '@/api/client';

import { applyFilter, dayIn, isDueSoon } from '../filters';

const ME = 'me';

const task = (fields: Partial<Task>): Task => ({
  id: 't',
  familyId: 'f',
  familyTimeZone: 'Europe/Rome',
  title: 't',
  notes: null,
  dueKind: null,
  due: null,
  criticality: 'NORMAL',
  status: 'OPEN',
  assigneePersonId: null,
  createdBy: 'x',
  completedBy: null,
  version: 1,
  updatedAt: '2026-10-20T08:00:00Z',
  ...fields,
});

const date = (due: string, familyTimeZone = 'Europe/Rome') =>
  task({ dueKind: 'DATE', due, familyTimeZone });

describe('dayIn', () => {
  it('gives the calendar day of an instant in the zone, not in the zone of the device', () => {
    const at = new Date('2026-11-02T23:30:00Z');
    expect(dayIn(at, 'Europe/Rome')).toBe('2026-11-03');
    expect(dayIn(at, 'America/New_York')).toBe('2026-11-02');
  });
});

describe('isDueSoon', () => {
  const now = new Date('2026-11-02T23:30:00Z');

  it('counts days in the zone of the family of the task', () => {
    // Rome is already on the 3rd: limit 10 November. New York is on the 2nd: limit 9 November.
    expect(isDueSoon(date('2026-11-10', 'Europe/Rome'), now)).toBe(true);
    expect(isDueSoon(date('2026-11-10', 'America/New_York'), now)).toBe(false);
    expect(isDueSoon(date('2026-11-09', 'America/New_York'), now)).toBe(true);
  });

  it('includes overdue tasks and excludes tasks without due date or not open', () => {
    expect(isDueSoon(date('2026-10-01'), now)).toBe(true);
    expect(isDueSoon(task({}), now)).toBe(false);
    expect(isDueSoon({ ...date('2026-11-04'), status: 'DONE' }, now)).toBe(false);
    expect(isDueSoon({ ...date('2026-11-04'), status: 'CANCELLED' }, now)).toBe(false);
  });

  it('brings a DATETIME to the day of the zone of the family', () => {
    const regali = (zone: string) =>
      task({ dueKind: 'DATETIME', due: '2026-11-10T03:00:00Z', familyTimeZone: zone });
    const noon = new Date('2026-11-02T10:00:00Z');
    expect(isDueSoon(regali('America/New_York'), noon)).toBe(true); // the 9th at 22:00
    expect(isDueSoon(regali('Europe/Rome'), noon)).toBe(false); // already the 10th
  });

  it('crosses the end of daylight saving time in Europe/Rome (2026-10-25)', () => {
    const now = new Date('2026-10-24T22:30:00Z'); // 00:30 on the 25th, CEST
    expect(isDueSoon(date('2026-11-01'), now)).toBe(true);
    expect(isDueSoon(date('2026-11-02'), now)).toBe(false);
    const late = task({ dueKind: 'DATETIME', due: '2026-11-01T23:30:00Z' }); // the 2nd in Rome, CET
    expect(isDueSoon(late, now)).toBe(false);
    const edge = task({ dueKind: 'DATETIME', due: '2026-11-01T22:30:00Z' }); // 23:30 on the 1st
    expect(isDueSoon(edge, now)).toBe(true);
  });
});

describe('applyFilter', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  const list = [
    task({ id: 'mine', assigneePersonId: ME }),
    task({ id: 'other', assigneePersonId: 'o' }),
    task({ id: 'queue' }),
    task({ id: 'done', status: 'DONE', assigneePersonId: ME }),
    task({ id: 'cancelled', status: 'CANCELLED' }),
  ];
  const ids = (f: Parameters<typeof applyFilter>[0]) =>
    applyFilter(f, list, ME, now).map((t) => t.id);

  it('all keeps every task with its status', () => {
    expect(ids('all')).toEqual(['mine', 'other', 'queue', 'done', 'cancelled']);
  });

  it('mine keeps open tasks assigned to the person', () => {
    expect(ids('mine')).toEqual(['mine']);
  });

  it('queue keeps open tasks without assignee', () => {
    expect(ids('queue')).toEqual(['queue']);
  });

  it('dueSoon keeps open tasks due within seven days', () => {
    const withDue = [date('2026-11-09'), { ...date('2026-11-10'), id: 'far' }];
    expect(applyFilter('dueSoon', withDue, ME, now)).toHaveLength(1);
  });
});
