import { uuidv7 } from '../task/ids';
import type {
  EntityKind,
  Http,
  LocalRow,
  LocalStore,
  MutationInput,
  QueuedMutation,
  StoreOps,
  SyncNotice,
  SyncResult,
} from './types';

type Options = { store: LocalStore; http: Http; newId?: () => string };
type Body = Record<string, unknown>;
type Stop = { stop: SyncResult['status'] };

const NOTICE_KINDS: Record<number, SyncNotice['kind']> = {
  409: 'conflict',
  404: 'notFound',
  403: 'forbidden',
  400: 'invalid',
};

const ok = (status: number) => status >= 200 && status < 300;

/** Why a request that is not a 2xx stops the cycle (or `undefined` if it does not). */
function stopFor(status: number): SyncResult['status'] | undefined {
  if (status === 401) return 'unauthorized';
  if (status >= 500 || status === 429) return 'retry';
  return undefined;
}

export function createSyncEngine({ store, http, newId = () => uuidv7() }: Options) {
  let running: Promise<SyncResult> | undefined;

  const send = async (request: Parameters<Http>[0]): Promise<ReturnType<Http> | Stop> =>
    http(request).catch(() => ({ stop: 'offline' }) as Stop);
  const stopped = (r: Awaited<ReturnType<typeof send>>): r is Stop => 'stop' in r;

  const notice = (kind: SyncNotice['kind'], m: QueuedMutation): SyncNotice => ({
    kind,
    familyId: m.familyId,
    entity: m.entity,
    entityId: m.entityId,
    mutationId: m.mutationId,
  });

  async function sendQueue(notices: SyncNotice[]): Promise<Stop | undefined> {
    for (const m of await store.getQueue()) {
      const r = await send({
        method: m.method,
        path: m.path,
        body: { ...m.body, mutationId: m.mutationId },
      });
      if (stopped(r)) return r;
      if (ok(r.status)) {
        await store.removeFromQueue(m.mutationId);
        continue;
      }
      const stop = stopFor(r.status);
      if (stop) return { stop };
      // Any other 4xx is final: the server will never accept this change.
      notices.push(notice(NOTICE_KINDS[r.status] ?? 'invalid', m));
      await store.removeFromQueue(m.mutationId);
    }
    return undefined;
  }

  const toRows = (familyId: string, tasks: Body[], items: Body[]): LocalRow[] => [
    ...tasks.map((data) => ({
      entity: 'task' as const,
      id: data.id as string,
      familyId,
      taskId: null,
      data,
    })),
    ...items.map((data) => ({
      entity: 'shopping_item' as const,
      id: data.id as string,
      familyId,
      taskId: data.taskId as string,
      data,
    })),
  ];

  async function lostFamily(familyId: string, notices: SyncNotice[]) {
    const dropped = (await store.getQueue()).filter((m) => m.familyId === familyId);
    notices.push(...dropped.map((m) => notice('notFound', m)));
    await store.wipeFamily(familyId);
  }

  async function readFamily(familyId: string, notices: SyncNotice[]): Promise<Stop | undefined> {
    const base = `/api/sync/families/${familyId}`;
    let cursor = await store.getCursor(familyId);
    for (let more = true; more;) {
      const first = cursor === undefined;
      const r = await send({
        method: 'GET',
        path: first ? `${base}/snapshot` : `${base}/changes?after=${cursor}&limit=500`,
      });
      if (stopped(r)) return r;
      if (r.status === 404) return void (await lostFamily(familyId, notices));
      if (!ok(r.status)) return { stop: stopFor(r.status) ?? 'retry' };
      const body = r.body as Body;
      more = !first && body.hasMore === true;
      cursor = (first ? body.seq : body.lastSeq) as number;
      await store.transaction(async (tx) => {
        await (first ? applySnapshot(tx, familyId, body) : applyChanges(tx, familyId, body));
        await tx.setCursor(familyId, cursor as number);
      });
    }
    return undefined;
  }

  async function applySnapshot(tx: StoreOps, familyId: string, body: Body) {
    for (const row of toRows(familyId, body.tasks as Body[], body.shoppingItems as Body[])) {
      await tx.putRow(row);
    }
  }

  async function applyChanges(tx: StoreOps, familyId: string, body: Body) {
    for (const c of body.changes as Body[]) {
      const entity = c.entity as EntityKind;
      const id = c.entityId as string;
      if (c.op === 'DELETE') {
        await tx.deleteRow(entity, id);
        if (entity === 'task') await tx.deleteRowsOfTask(id);
        continue;
      }
      const data = c.data as Body;
      const taskId = entity === 'shopping_item' ? (data.taskId as string) : null;
      await tx.putRow({ entity, id, familyId, taskId, data });
    }
  }

  async function cycle(): Promise<SyncResult> {
    const notices: SyncNotice[] = [];
    const done = (status: SyncResult['status']): SyncResult => ({ status, notices });
    const queueStop = await sendQueue(notices);
    if (queueStop) return done(queueStop.stop);
    const list = await send({ method: 'GET', path: '/api/families' });
    if (stopped(list)) return done(list.stop);
    if (!ok(list.status)) return done(stopFor(list.status) ?? 'retry');
    const listed = (list.body as { id: string }[]).map((f) => f.id);
    const families = new Set([...listed, ...(await store.cursorFamilies())]);
    for (const familyId of families) {
      const stop = await readFamily(familyId, notices);
      if (stop) return done(stop.stop);
    }
    return done('ok');
  }

  return {
    async enqueue(input: MutationInput): Promise<QueuedMutation> {
      const mutation = { ...input, mutationId: newId() };
      await store.addToQueue(mutation);
      return mutation;
    },

    /** One cycle at a time: a call during a cycle waits for that cycle. */
    sync(): Promise<SyncResult> {
      running ??= cycle().finally(() => {
        running = undefined;
      });
      return running;
    },

    /** Server rows with the queued patches laid over them. */
    async rows(familyId: string): Promise<LocalRow[]> {
      const rows = new Map((await store.getRows(familyId)).map((r) => [`${r.entity}:${r.id}`, r]));
      for (const m of await store.getQueue()) {
        if (m.familyId !== familyId) continue;
        const k = `${m.entity}:${m.entityId}`;
        const current = rows.get(k);
        if (current) rows.set(k, { ...current, data: { ...current.data, ...m.patch } });
        else if (m.method === 'POST') {
          const data = { id: m.entityId, ...m.patch };
          rows.set(k, { entity: m.entity, id: m.entityId, familyId, taskId: m.taskId, data });
        }
      }
      return [...rows.values()];
    },

    clear: () => store.clearAll(),
  };
}
