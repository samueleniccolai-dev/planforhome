import type { Task, WriteOutcome } from '@/api/client';

import { afterWrite } from '../useQuickActions';

const task = { id: 't', title: 'Pagare la mensa', recurrence: null } as unknown as Task;
const people = [{ personId: 'p1', displayName: 'Paolo' }];
const ok: WriteOutcome = { status: 'ok', value: task };

describe('afterWrite', () => {
  it('done: a success with undo; a recurring task reloads', () => {
    expect(afterWrite('done', ok, task, people)).toEqual({
      notice: {
        tone: 'success',
        key: 'task.card.doneNotice',
        params: { title: task.title },
        undo: true,
      },
      reload: false,
    });
    const cyclic = { ...task, recurrence: { type: 'DAILY' } } as Task;
    expect(afterWrite('done', ok, cyclic, people).reload).toBe(true);
  });

  it('take: a success with undo', () => {
    expect(afterWrite('take', ok, task, people).notice).toEqual({
      tone: 'success',
      key: 'task.card.takenNotice',
      params: { title: task.title },
      undo: true,
    });
  });

  it('undo: the notice goes away', () => {
    expect(afterWrite('undo', ok, task, people)).toEqual({ notice: undefined, reload: false });
  });

  it('the refusals say why and reload only when the list is stale', () => {
    expect(afterWrite('done', { status: 'forbidden' }, task, people)).toMatchObject({
      notice: { key: 'task.forbidden' },
      reload: false,
    });
    expect(afterWrite('done', { status: 'changed' }, task, people)).toMatchObject({
      notice: { key: 'task.changed' },
      reload: true,
    });
    expect(afterWrite('done', { status: 'notFound' }, task, people)).toMatchObject({
      notice: { key: 'task.notAvailable' },
      reload: true,
    });
    expect(afterWrite('done', { status: 'error' }, task, people)).toMatchObject({
      notice: { key: 'task.failed' },
      reload: false,
    });
  });

  it('already taken: the name of the server, else the one we know, and reload', () => {
    const named = afterWrite(
      'take',
      { status: 'alreadyTaken', assigneePersonId: 'p9', assigneeName: 'Anna' },
      task,
      people,
    );
    expect(named).toMatchObject({
      notice: { key: 'task.taken', params: { name: 'Anna' } },
      reload: true,
    });
    const known = afterWrite(
      'take',
      { status: 'alreadyTaken', assigneePersonId: 'p1' },
      task,
      people,
    );
    expect(known.notice?.params).toEqual({ name: 'Paolo' });
  });

  it('unauthorized asks for the login', () => {
    expect(afterWrite('done', { status: 'unauthorized' }, task, people).login).toBe(true);
  });
});
