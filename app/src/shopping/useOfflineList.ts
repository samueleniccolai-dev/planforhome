import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { Item } from '@/api/client';
import { getRuntime, type Runtime } from '@/sync/runtime';
import type { SyncResult } from '@/sync/types';
import { newIds } from '@/task/logic';

import { isBlocked, noticeKey, viewFromRows, type OfflineView } from './offline';
import { addItemMutation, checkItemMutation } from './queued';

/**
 * Android: the list comes from the local rows and the check and the add go through the queue.
 * On the web `active` is false and nothing here runs.
 */
export function useOfflineList(familyId: string, taskId: string) {
  const active = Platform.OS !== 'web';
  const [runtime, setRuntime] = useState<Runtime>();
  const [view, setView] = useState<OfflineView>();
  const [problem, setProblem] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [blocked, setBlocked] = useState(false);
  const last = useRef<SyncResult['status']>(undefined);

  useEffect(() => {
    if (active) void getRuntime().then(setRuntime);
  }, [active]);

  const refresh = useCallback(async () => {
    if (!runtime) return;
    const [rows, queue, who] = await Promise.all([
      runtime.engine.rows(familyId),
      runtime.engine.queue(),
      runtime.auth.current(),
    ]);
    const next = viewFromRows(rows, taskId, who?.personId);
    setBlocked(isBlocked(last.current, queue, taskId));
    setView(next);
    setProblem(next ? undefined : 'list.notFound');
  }, [runtime, familyId, taskId]);

  useEffect(() => {
    if (!runtime) return;
    void refresh();
    // A network error never goes to /login: only `onUnauthorized` of the session does.
    return runtime.subscribe((result) => {
      last.current = result.status;
      const mine = result.notices.find((n) => n.familyId === familyId);
      if (mine) setNotice(noticeKey(mine.kind));
      void refresh();
    });
  }, [runtime, refresh, familyId]);

  const after = useCallback(() => {
    runtime?.session.afterWrite();
    return refresh();
  }, [runtime, refresh]);

  return {
    active,
    view,
    problem,
    notice,
    blocked,
    after,
    async toggle(item: Item) {
      if (!runtime) return;
      setNotice(undefined);
      const checked = !item.checked;
      await runtime.engine.enqueue(
        checkItemMutation({ familyId, taskId, itemId: item.id, checked }),
      );
      await after();
    },
    async add(text: string) {
      if (!runtime) return;
      setNotice(undefined);
      await runtime.engine.enqueue(
        addItemMutation({ familyId, taskId, itemId: newIds().id, text }),
      );
      await after();
    },
  };
}
