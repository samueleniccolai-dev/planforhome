import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { Family, FamilyMember, Task } from '@/api/client';
import { isBlocked } from '@/shopping/offline';
import { getRuntime, type Runtime } from '@/sync/runtime';
import type { Directory, MutationInput, SyncResult } from '@/sync/types';

import { newIds } from './logic';
import { taskNotice, tasksFromRows } from './offline';
import {
  assignTaskMutation,
  completeTaskMutation,
  createTaskMutation,
  forwardTaskMutation,
  takeTaskMutation,
} from './queued';
import type { NewTaskInput } from './NewTaskForm';

type Notice = { key: string; params?: Record<string, string> };
type Loaded = { directory: Directory; families: Family[]; tasks: Task[]; me: string };

const asPeople = (directory: Directory): FamilyMember[] =>
  directory.members.map((m) => ({ ...m, hasAccount: true, referentPersonId: null }));

/**
 * Android: the family screen reads the local directory and rows, and its commands go through
 * the queue. On the web `active` is false and nothing here runs.
 */
export function useOfflineTasks(familyId: string | undefined) {
  const active = Platform.OS !== 'web';
  const [runtime, setRuntime] = useState<Runtime>();
  const [loaded, setLoaded] = useState<Loaded>();
  const [queued, setQueued] = useState<(string | null)[]>([]);
  const [last, setLast] = useState<SyncResult['status']>();
  const [notice, setNotice] = useState<Notice>();
  const pending = useRef(new Set<string>());

  useEffect(() => {
    if (active) void getRuntime().then(setRuntime);
  }, [active]);

  const refresh = useCallback(async () => {
    if (!runtime || !familyId) return;
    const engine = runtime.engine;
    const [rows, directory, families, queue, who] = await Promise.all([
      engine.rows(familyId),
      engine.directory(familyId),
      engine.families(),
      engine.queue(),
      runtime.auth.current(),
    ]);
    setQueued(queue.map((m) => m.taskId));
    setLoaded({
      directory,
      families,
      tasks: tasksFromRows(rows, directory),
      me: who?.personId ?? '',
    });
  }, [runtime, familyId]);

  useEffect(() => {
    if (!runtime || !familyId) return;
    void Promise.resolve().then(refresh);
    // A network error never goes to /login: only `onUnauthorized` of the session does.
    return runtime.subscribe((result) => {
      setLast(result.status);
      void (async () => {
        const members = (await runtime.engine.directory(familyId)).members;
        const found = result.notices
          .filter((n) => n.familyId === familyId)
          .map((n) => taskNotice(n, members))
          .find((n) => n !== undefined);
        if (found) setNotice(found);
        await refresh();
      })();
    });
  }, [runtime, refresh, familyId]);

  /** One command at a time per task: a second tap while the first is being queued is dropped. */
  async function command(taskId: string, build: (me: string) => MutationInput) {
    if (!runtime || !loaded || pending.current.has(taskId)) return false;
    pending.current.add(taskId);
    setNotice(undefined);
    try {
      await runtime.engine.enqueue(build(loaded.me));
      runtime.session.afterWrite();
      await refresh();
      return true;
    } finally {
      pending.current.delete(taskId);
    }
  }

  const base = { familyId: familyId ?? '' };
  return {
    active,
    ready: loaded !== undefined,
    family: loaded?.directory.family,
    people: loaded ? asPeople(loaded.directory) : [],
    families: loaded?.families ?? [],
    tasks: loaded?.tasks,
    notice,
    dismiss: () => setNotice(undefined),
    /** The direct actions wait for the network and for the queue of the task. */
    blocked: (taskId: string) =>
      isBlocked(last, queued.map((id) => ({ taskId: id })) as never, taskId),
    async loadMembers(id: string): Promise<FamilyMember[] | undefined> {
      return runtime ? asPeople(await runtime.engine.directory(id)) : undefined;
    },
    create(input: NewTaskInput) {
      const taskId = newIds().id;
      return command(taskId, (me) => createTaskMutation({ ...base, taskId, me, ...input }));
    },
    assign: (taskId: string, assigneePersonId: string | null) =>
      command(taskId, () => assignTaskMutation({ ...base, taskId, assigneePersonId })),
    take: (taskId: string) => command(taskId, (me) => takeTaskMutation({ ...base, taskId, me })),
    complete: (taskId: string) =>
      command(taskId, (me) => completeTaskMutation({ ...base, taskId, me })),
    forward: (taskId: string, toFamilyId: string) =>
      command(taskId, () => forwardTaskMutation({ ...base, taskId, toFamilyId })),
  };
}

export type OfflineTasks = ReturnType<typeof useOfflineTasks>;
