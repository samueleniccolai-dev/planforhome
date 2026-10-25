import type { Task } from '@/api/client';

import { sectionOf, sortInSection } from '../sections';

function make(fields: Partial<Task>): Task {
  return {
    id: 'x',
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
    updatedAt: '',
    ...fields,
  };
}

const at = (iso: string) => new Date(iso);

describe('sectionOf', () => {
  it('closed whatever the due date', () => {
    const due = { dueKind: 'DATE' as const, due: '2020-01-01' };
    expect(sectionOf(make({ status: 'DONE', ...due }), at('2026-11-03T03:00:00Z'))).toBe('closed');
    expect(sectionOf(make({ status: 'CANCELLED' }), at('2026-11-03T03:00:00Z'))).toBe('closed');
  });

  it('open without a due date', () => {
    expect(sectionOf(make({}), at('2026-11-03T03:00:00Z'))).toBe('none');
  });

  it('uses the zone of the family, not the one of the device', () => {
    const now = at('2026-11-03T03:00:00Z'); // 04:00 Tuesday in Rome, 22:00 Monday in New York
    const date = { dueKind: 'DATE' as const, due: '2026-11-02' };
    expect(sectionOf(make({ familyTimeZone: 'Europe/Rome', ...date }), now)).toBe('overdue');
    expect(sectionOf(make({ familyTimeZone: 'America/New_York', ...date }), now)).toBe('today');
    const tomorrow = { dueKind: 'DATE' as const, due: '2026-11-03' };
    expect(sectionOf(make({ familyTimeZone: 'America/New_York', ...tomorrow }), now)).toBe(
      'upcoming',
    );
  });

  it('a DATETIME is overdue once its instant has passed, today before', () => {
    const task = make({ dueKind: 'DATETIME', due: '2026-10-25T22:30:00Z' });
    expect(sectionOf(task, at('2026-10-25T22:00:00Z'))).toBe('today');
    expect(sectionOf(task, at('2026-10-25T22:31:00Z'))).toBe('overdue');
  });

  it('a DATE is today until the end of the day in Rome on the day of the clock change', () => {
    const task = make({ dueKind: 'DATE', due: '2026-10-25' }); // 25 hours long day
    expect(sectionOf(task, at('2026-10-25T22:59:00Z'))).toBe('today');
    expect(sectionOf(task, at('2026-10-25T23:00:00Z'))).toBe('overdue');
  });

  it('handles a zone where midnight does not exist (America/Santiago)', () => {
    const zone = 'America/Santiago';
    const eve = make({ familyTimeZone: zone, dueKind: 'DATE', due: '2026-09-05' });
    const day = make({ familyTimeZone: zone, dueKind: 'DATE', due: '2026-09-06' });
    expect(sectionOf(day, at('2026-09-06T03:59:00Z'))).toBe('upcoming');
    expect(sectionOf(day, at('2026-09-06T04:00:00Z'))).toBe('today');
    expect(sectionOf(eve, at('2026-09-06T04:00:00Z'))).toBe('overdue');
  });
});

describe('sortInSection', () => {
  it('orders by end of the due, then criticality, then title; no due last', () => {
    const date = (due: string) => ({ dueKind: 'DATE' as const, due });
    const list = [
      make({ id: 'e', title: 'E' }),
      make({ id: 'd', title: 'B', ...date('2026-11-03') }),
      make({ id: 'c', title: 'A', criticality: 'LOW', ...date('2026-11-02') }),
      make({ id: 'b', title: 'Z', criticality: 'HIGH', ...date('2026-11-02') }),
      make({ id: 'a', title: 'A', dueKind: 'DATETIME', due: '2026-11-02T10:00:00Z' }),
      make({ id: 'f', title: 'A', criticality: 'HIGH' }),
    ];
    expect(sortInSection(list).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd', 'f', 'e']);
  });

  it('does not change the input', () => {
    const list = [make({ id: 'b', title: 'B' }), make({ id: 'a', title: 'A' })];
    sortInSection(list);
    expect(list.map((t) => t.id)).toEqual(['b', 'a']);
  });
});
