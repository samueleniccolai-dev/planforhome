import type { Task } from '@/api/client';

import {
  buildRule,
  describe as describeRule,
  emptyRuleForm,
  nextDue,
  parseDue,
  parseTime,
  toInstant,
  type Rule,
} from '../recurrence';

const task = (
  rule: Rule,
  dueKind: 'DATE' | 'DATETIME',
  due: string,
  zone = 'Europe/Rome',
): Pick<Task, 'dueKind' | 'due' | 'familyTimeZone' | 'recurrence'> => ({
  dueKind,
  due,
  familyTimeZone: zone,
  recurrence: rule,
});
const date = (rule: Rule, due: string, now: string) =>
  nextDue(task(rule, 'DATE', due), new Date(now))?.due;
const instant = (rule: Rule, due: string, now: string, zone?: string) =>
  nextDue(task(rule, 'DATETIME', due, zone), new Date(now))?.due;

const EARLY = '2031-01-06T08:00:00Z';

describe('nextDue DATE', () => {
  it('daily', () => {
    expect(date({ type: 'DAILY' }, '2031-01-07', EARLY)).toBe('2031-01-08');
  });
  it('every N days, skipping the days already past', () => {
    const rule: Rule = { type: 'EVERY_N_DAYS', interval: 3 };
    expect(date(rule, '2031-01-07', '2031-01-12T10:00:00Z')).toBe('2031-01-13');
    expect(date(rule, '2031-01-07', '2031-01-08T10:00:00Z')).toBe('2031-01-10');
  });
  it('weekly', () => {
    const rule: Rule = { type: 'WEEKLY', days: ['TUESDAY', 'FRIDAY'] };
    expect(date(rule, '2031-01-07', EARLY)).toBe('2031-01-10');
    expect(date(rule, '2031-01-10', EARLY)).toBe('2031-01-14');
  });
  it('weekly closed late: the first Tuesday not past', () => {
    expect(date({ type: 'WEEKLY', days: ['TUESDAY'] }, '2031-01-07', '2031-01-09T10:00:00Z')).toBe(
      '2031-01-14',
    );
  });
  it('monthly on the 31st clamps to the end of the month', () => {
    const rule: Rule = { type: 'MONTHLY', dayOfMonth: 31 };
    expect(date(rule, '2031-01-31', EARLY)).toBe('2031-02-28');
    expect(date(rule, '2031-02-28', EARLY)).toBe('2031-03-31');
    expect(date(rule, '2031-03-31', EARLY)).toBe('2031-04-30');
    expect(date(rule, '2032-01-31', EARLY)).toBe('2032-02-29');
    expect(date(rule, '2031-12-31', EARLY)).toBe('2032-01-31');
  });
  it('is undefined without a rule', () => {
    expect(
      nextDue({ ...task({ type: 'DAILY' }, 'DATE', '2031-01-07'), recurrence: null }, new Date()),
    ).toBe(undefined);
  });
});

describe('nextDue DATETIME', () => {
  const daily: Rule = { type: 'DAILY', time: '07:00' };
  it('keeps the local time across the spring change', () => {
    expect(instant(daily, '2031-03-29T06:00:00Z', '2031-03-29T05:00:00Z')).toBe(
      '2031-03-30T05:00:00.000Z',
    );
  });
  it('keeps the local time across the autumn change', () => {
    expect(instant(daily, '2031-10-25T05:00:00Z', '2031-10-25T04:00:00Z')).toBe(
      '2031-10-26T06:00:00.000Z',
    );
  });
  it('works in New York', () => {
    expect(
      instant(
        { type: 'DAILY', time: '07:00' },
        '2031-03-08T12:00:00Z',
        '2031-03-08T11:00:00Z',
        'America/New_York',
      ),
    ).toBe('2031-03-09T11:00:00.000Z');
  });
  it('a time in the gap moves forward, the next day goes back', () => {
    const rule: Rule = { type: 'DAILY', time: '02:30' };
    expect(instant(rule, '2031-03-29T01:30:00Z', '2031-03-29T01:00:00Z')).toBe(
      '2031-03-30T01:30:00.000Z',
    );
    expect(instant(rule, '2031-03-30T01:30:00Z', '2031-03-30T01:00:00Z')).toBe(
      '2031-03-31T00:30:00.000Z',
    );
  });
  it('a time in the overlap is the first one', () => {
    expect(
      instant({ type: 'DAILY', time: '02:30' }, '2031-10-24T00:30:00Z', '2031-10-24T00:00:00Z'),
    ).toBe('2031-10-25T00:30:00.000Z');
    expect(
      instant({ type: 'DAILY', time: '02:30' }, '2031-10-25T00:30:00Z', '2031-10-25T00:00:00Z'),
    ).toBe('2031-10-26T00:30:00.000Z');
  });
  it('skips an instant already past', () => {
    expect(instant(daily, '2031-10-27T06:00:00Z', '2031-10-29T08:00:00Z')).toBe(
      '2031-10-30T06:00:00.000Z',
    );
  });
  it('uses the time of the due when the rule has none', () => {
    expect(instant({ type: 'DAILY' }, '2031-01-07T17:30:00Z', EARLY)).toBe(
      '2031-01-08T17:30:00.000Z',
    );
  });
});

describe('toInstant', () => {
  it('gap: 02:30 on 30 March 2031 in Rome is 03:30 CEST', () => {
    expect(toInstant('2031-03-30', '02:30', 'Europe/Rome').toISOString()).toBe(
      '2031-03-30T01:30:00.000Z',
    );
  });
  it('overlap: 02:30 on 26 October 2031 in Rome is the first (CEST)', () => {
    expect(toInstant('2031-10-26', '02:30', 'Europe/Rome').toISOString()).toBe(
      '2031-10-26T00:30:00.000Z',
    );
  });
  it('an ordinary time', () => {
    expect(toInstant('2031-01-07', '07:00', 'Europe/Rome').toISOString()).toBe(
      '2031-01-07T06:00:00.000Z',
    );
    expect(toInstant('2031-03-08', '07:00', 'America/New_York').toISOString()).toBe(
      '2031-03-08T12:00:00.000Z',
    );
  });
});

describe('buildRule', () => {
  it('never, daily', () => {
    expect(buildRule(emptyRuleForm)).toEqual({ rule: undefined });
    expect(buildRule({ ...emptyRuleForm, kind: 'daily' })).toEqual({ rule: { type: 'DAILY' } });
  });
  it('every N days between 2 and 365', () => {
    const form = { ...emptyRuleForm, kind: 'everyN' as const };
    expect(buildRule({ ...form, interval: '3' })).toEqual({
      rule: { type: 'EVERY_N_DAYS', interval: 3 },
    });
    for (const bad of ['1', '366', '', 'x', '2.5']) {
      expect(buildRule({ ...form, interval: bad })).toEqual({ error: true });
    }
  });
  it('weekly lists the days Monday to Sunday whatever the order of the taps', () => {
    const form = { ...emptyRuleForm, kind: 'weekly' as const };
    expect(buildRule({ ...form, days: ['FRIDAY', 'TUESDAY'] })).toEqual({
      rule: { type: 'WEEKLY', days: ['TUESDAY', 'FRIDAY'] },
    });
    expect(buildRule(form)).toEqual({ error: true });
  });
  it('monthly between 1 and 31', () => {
    const form = { ...emptyRuleForm, kind: 'monthly' as const };
    expect(buildRule({ ...form, dayOfMonth: '31' })).toEqual({
      rule: { type: 'MONTHLY', dayOfMonth: 31 },
    });
    for (const bad of ['0', '32', ''])
      expect(buildRule({ ...form, dayOfMonth: bad })).toEqual({ error: true });
  });
});

describe('parseDue and parseTime', () => {
  it('accepts real dates', () => {
    expect(parseDue('07/01/2031')).toBe('2031-01-07');
    expect(parseDue('29/02/2032')).toBe('2032-02-29');
  });
  it('refuses the others', () => {
    for (const bad of ['31/02/2031', '29/02/2031', '00/01/2031', '1/13/2031', '2031-01-07', '']) {
      expect(parseDue(bad)).toBeUndefined();
    }
  });
  it('times', () => {
    expect(parseTime('7:00')).toBe('07:00');
    expect(parseTime('23:59')).toBe('23:59');
    for (const bad of ['24:00', '12:60', '7', 'ab:cd']) expect(parseTime(bad)).toBeUndefined();
  });
});

describe('describe', () => {
  it('names the key, the numbers and the days in order', () => {
    expect(describeRule({ type: 'EVERY_N_DAYS', interval: 3 })).toEqual({
      key: 'recurrence.rule.everyN',
      params: { n: '3' },
      days: [],
    });
    expect(describeRule({ type: 'WEEKLY', days: ['FRIDAY', 'TUESDAY'] }).days).toEqual([
      'TUESDAY',
      'FRIDAY',
    ]);
  });
});
