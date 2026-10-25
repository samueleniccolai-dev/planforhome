import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  assignTask,
  completeTask,
  reopenTask,
  takeTask,
  type FamilyMember,
  type Task,
  type WriteOutcome,
} from '@/api/client';
import { getRuntime } from '@/sync/runtime';

import { attemptFor, mergeTask, nameOf, type Attempt } from './logic';

export type QuickKind = 'done' | 'take' | 'undo';
export type QuickNotice = {
  tone: 'notice' | 'danger' | 'success';
  key: string;
  params?: Record<string, string>;
  /** The notice carries «Undo». */
  undo?: boolean;
};
export type QuickResult = { notice?: QuickNotice; reload?: boolean; login?: boolean };

type People = Pick<FamilyMember, 'personId' | 'displayName'>[];

/** What the answer of the server means for the screen: the notice, a reload, the login. */
export function afterWrite(
  kind: QuickKind,
  outcome: WriteOutcome,
  task: Task,
  people: People,
): QuickResult {
  switch (outcome.status) {
    case 'ok': {
      if (kind === 'undo') return { notice: undefined, reload: false };
      const key = kind === 'done' ? 'task.card.doneNotice' : 'task.card.takenNotice';
      return {
        notice: { tone: 'success', key, params: { title: task.title }, undo: true },
        reload: kind === 'done' && !!task.recurrence,
      };
    }
    case 'unauthorized':
      return { login: true };
    case 'forbidden':
      return { notice: { tone: 'danger', key: 'task.forbidden' }, reload: false };
    case 'changed':
      return { notice: { tone: 'notice', key: 'task.changed' }, reload: true };
    case 'notFound':
      return { notice: { tone: 'notice', key: 'task.notAvailable' }, reload: true };
    case 'alreadyTaken': {
      const name =
        outcome.assigneeName ??
        (outcome.assigneePersonId ? nameOf(people, outcome.assigneePersonId) : '?');
      return { notice: { tone: 'notice', key: 'task.taken', params: { name } }, reload: true };
    }
    default:
      return { notice: { tone: 'danger', key: 'task.failed' }, reload: false };
  }
}

/** Android: the ids of the tasks that still have changes in the offline queue. */
export function useQueue(): { taskId: string | null }[] {
  const [queue, setQueue] = useState<{ taskId: string | null }[]>([]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    let stop: (() => void) | undefined;
    void getRuntime().then((runtime) => {
      if (!runtime || !alive) return;
      const refresh = () => void runtime.engine.queue().then((q) => alive && setQueue(q));
      refresh();
      stop = runtime.subscribe(refresh);
    });
    return () => {
      alive = false;
      stop?.();
    };
  }, []);
  return queue;
}

type Options = {
  people: People;
  setTasks: (update: (list: Task[]) => Task[]) => void;
  /** Asks the server again and replaces the list. */
  reload: () => Promise<void>;
  onUnauthorized: () => void;
};

/**
 * Done, take and undo from the aggregate view: one write at a time for the whole screen, one
 * notice, identifiers reused only to retry the same write after a network error.
 */
export function useQuickActions({ people, setTasks, reload, onUnauthorized }: Options) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<QuickNotice>();
  const running = useRef(false);
  const attempt = useRef<Attempt | undefined>(undefined);
  const last = useRef<{ kind: 'done' | 'take'; task: Task } | undefined>(undefined);

  const run = useCallback(
    async (kind: QuickKind, task: Task) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        const key = `${kind}:${task.id}`;
        attempt.current = attemptFor(attempt.current, key);
        const body = { mutationId: attempt.current.ids.mutationId };
        const outcome = await (kind === 'done'
          ? completeTask(task.familyId, task.id, body)
          : kind === 'take'
            ? takeTask(task.familyId, task.id, body)
            : last.current?.kind === 'take'
              ? assignTask(task.familyId, task.id, { ...body, assigneePersonId: null })
              : reopenTask(task.familyId, task.id, body));
        if (outcome.status !== 'error') attempt.current = undefined;
        const result = afterWrite(kind, outcome, task, people);
        if (result.login) return onUnauthorized();
        if (outcome.status === 'ok') {
          const saved = outcome.value;
          setTasks((list) => mergeTask(list, saved, true));
          last.current = kind === 'undo' ? undefined : { kind, task: saved };
        }
        const retryUndo = kind === 'undo' && outcome.status === 'error';
        setNotice(retryUndo ? { ...result.notice!, undo: true } : result.notice);
        if (result.reload) await reload();
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [people, setTasks, reload, onUnauthorized],
  );

  return {
    busy,
    notice,
    done: (task: Task) => run('done', task),
    take: (task: Task) => run('take', task),
    undo: () => (last.current ? run('undo', last.current.task) : Promise.resolve()),
  };
}
