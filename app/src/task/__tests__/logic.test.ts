import type { Task } from '@/api/client';

import { attemptFor, keepAttempt, mergeAll, mergeTask } from '../logic';

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
  completedBy: null,
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

describe('mergeAll', () => {
  it('keeps the newer version when a slow reload brings an older one', () => {
    const merged = mergeAll([task('a', 2, 'written')], [task('a', 1, 'old')]);
    expect(merged.map((t) => [t.title, t.version])).toEqual([['written', 2]]);
  });

  it('adds the task that is new in the reload (the next occurrence)', () => {
    const merged = mergeAll([task('a', 2)], [task('a', 2), task('b', 1)]);
    expect(merged.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('keepAttempt', () => {
  const attempt = { key: 'done:a', ids: { id: 'i', mutationId: 'm' } };

  it('keeps the identifiers only after a network error', () => {
    expect(keepAttempt(attempt, 'error')).toBe(attempt);
  });

  it.each(['ok', 'forbidden', 'notFound', 'changed', 'tooSoon', 'alreadyTaken', 'unauthorized'])(
    'drops them after %s',
    (status) => {
      expect(keepAttempt(attempt, status)).toBeUndefined();
    },
  );
});
