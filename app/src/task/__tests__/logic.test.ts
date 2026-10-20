import type { Task } from '@/api/client';

import { attemptFor, mergeTask } from '../logic';

const task = (id: string, version: number, title = id): Task => ({
  id,
  familyId: 'f',
  familyTimeZone: 'Europe/Rome',
  title,
  notes: null,
  dueKind: null,
  due: null,
  criticality: 'NORMAL',
  status: 'OPEN',
  assigneePersonId: null,
  createdBy: 'p',
  version,
  updatedAt: '2026-10-20T08:00:00Z',
});

describe('mergeTask', () => {
  it('appends a task that is not in the list', () => {
    expect(mergeTask([task('a', 1)], task('b', 1)).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('replaces by id when the version is newer, keeping the position', () => {
    const merged = mergeTask([task('a', 1), task('b', 1)], task('a', 2, 'new'));
    expect(merged.map((t) => t.title)).toEqual(['new', 'b']);
  });

  it('ignores an older or equal version (a late answer)', () => {
    const merged = mergeTask([task('a', 3, 'kept')], task('a', 2, 'late'));
    expect(merged[0].title).toBe('kept');
    expect(mergeTask([task('a', 3, 'kept')], task('a', 3, 'same'))[0].title).toBe('kept');
  });

  it('can force the replacement', () => {
    expect(mergeTask([task('a', 3, 'old')], task('a', 3, 'forced'), true)[0].title).toBe('forced');
  });
});

describe('attemptFor', () => {
  let n = 0;
  const make = () => ({ id: `id${++n}`, mutationId: `m${n}` });

  it('makes new ids the first time', () => {
    expect(attemptFor(undefined, 'k', make).ids).toEqual({ id: 'id1', mutationId: 'm1' });
  });

  it('reuses the ids for the same content', () => {
    const first = attemptFor(undefined, 'create:Zaino', make);
    expect(attemptFor(first, 'create:Zaino', make)).toBe(first);
  });

  it('makes new ids when the content changes', () => {
    const first = attemptFor(undefined, 'create:Zaino', make);
    const second = attemptFor(first, 'create:Altro', make);
    expect(second.ids).not.toEqual(first.ids);
  });
});
