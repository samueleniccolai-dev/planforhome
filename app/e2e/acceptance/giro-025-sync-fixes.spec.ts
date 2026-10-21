import { expect, test } from '@playwright/test';

import {
  ANNA,
  BIANCHI_VERDI,
  BOLLETTA,
  FakeSyncServer,
  LATTE,
  LUCA,
  PANE,
  ROSSI,
  SPESA_SABATO,
  SPRING_NOT_FOUND,
  UOVA,
  VETERINARIO,
  openNodeSqlDatabase,
  type HttpRequest,
  type HttpResponse,
  type SqlDatabase,
} from './giro-025-fake-sync-server';

// Round 025, T9: fixes of the sync engine for the contested decisions 83 and 84
// (docs/lab/giri/025-piano.md). Node only, no page. Every test runs twice: on the in-memory store
// and on the SQLite store of `src/sync/sqlStore.ts` over node:sqlite. Production modules are
// loaded at run time, so that this file compiles before `sqlStore.ts` exists.

type EntityKind = 'task' | 'shopping_item';
type LocalRow = {
  entity: EntityKind;
  id: string;
  familyId: string;
  taskId: string | null;
  data: Record<string, unknown>;
};
type MutationInput = {
  familyId: string;
  entity: EntityKind;
  entityId: string;
  taskId: string | null;
  method: 'POST' | 'PUT';
  path: string;
  body: Record<string, unknown>;
  patch: Record<string, unknown>;
};
type QueuedMutation = MutationInput & { mutationId: string };
type SyncNotice = {
  kind: 'conflict' | 'forbidden' | 'notFound' | 'invalid';
  familyId: string;
  entity: EntityKind;
  entityId: string;
  mutationId: string;
};
type SyncResult = { status: 'ok' | 'offline' | 'unauthorized' | 'retry'; notices: SyncNotice[] };
/** The `StoreOps` contract of round 025 (cancellations scoped to a family). */
type LocalStore = {
  getRows(familyId: string): Promise<LocalRow[]>;
  putRow(row: LocalRow): Promise<void>;
  deleteRow(familyId: string, entity: EntityKind, id: string): Promise<void>;
  deleteRowsOfTask(familyId: string, taskId: string): Promise<void>;
  getCursor(familyId: string): Promise<number | undefined>;
  cursorFamilies(): Promise<string[]>;
  getQueue(): Promise<QueuedMutation[]>;
};
type SyncEngine = {
  enqueue(input: MutationInput): Promise<QueuedMutation>;
  sync(): Promise<SyncResult>;
  rows(familyId: string): Promise<LocalRow[]>;
};
type CreateEngine = (options: {
  store: LocalStore;
  http: (request: HttpRequest) => Promise<HttpResponse>;
}) => SyncEngine;
type Dump = { rows: LocalRow[]; queue: QueuedMutation[]; cursors: Record<string, number> };

const STORES = ['memory', 'sqlite'] as const;
type StoreKind = (typeof STORES)[number];

async function importOrUndefined(path: string) {
  return import(path).catch(() => undefined);
}

/** Loads the engine and the store of the given kind at run time. */
async function load(
  kind: StoreKind,
): Promise<{ createSyncEngine: CreateEngine; store: LocalStore }> {
  const engine = await importOrUndefined('../../src/sync/engine');
  expect(engine?.createSyncEngine, 'src/sync/engine.ts exports createSyncEngine').toBeInstanceOf(
    Function,
  );
  if (kind === 'memory') {
    const memory = await importOrUndefined('../../src/sync/memoryStore');
    expect(memory?.createMemoryStore, 'memoryStore.ts exports createMemoryStore').toBeInstanceOf(
      Function,
    );
    return { createSyncEngine: engine.createSyncEngine, store: memory.createMemoryStore() };
  }
  const sql = await importOrUndefined('../../src/sync/sqlStore');
  expect(sql?.createSqlStore, 'src/sync/sqlStore.ts exports createSqlStore').toBeInstanceOf(
    Function,
  );
  const db: SqlDatabase = await openNodeSqlDatabase();
  return { createSyncEngine: engine.createSyncEngine, store: await sql.createSqlStore(db) };
}

async function setup(kind: StoreKind, user = ANNA) {
  const { createSyncEngine, store } = await load(kind);
  const server = new FakeSyncServer();
  server.user = user;
  const engine = createSyncEngine({ store, http: server.http });
  return { server, store, engine };
}

/** The whole local state, read through the public store contract (same on both stores). */
async function dumpOf(store: LocalStore): Promise<Dump> {
  const byKey = (a: LocalRow, b: LocalRow) =>
    `${a.entity}:${a.id}`.localeCompare(`${b.entity}:${b.id}`);
  const rows = [...(await store.getRows(ROSSI)), ...(await store.getRows(BIANCHI_VERDI))];
  const cursors: Record<string, number> = {};
  for (const family of await store.cursorFamilies()) {
    const seq = await store.getCursor(family);
    if (seq !== undefined) cursors[family] = seq;
  }
  return { rows: rows.sort(byKey), queue: await store.getQueue(), cursors };
}

const taskPath = (familyId: string, taskId: string) => `/api/families/${familyId}/tasks/${taskId}`;

const rename = (
  familyId: string,
  taskId: string,
  title: string,
  version: number,
): MutationInput => ({
  familyId,
  entity: 'task',
  entityId: taskId,
  taskId: null,
  method: 'PUT',
  path: taskPath(familyId, taskId),
  body: { title, version },
  patch: { title },
});

const markDone = (familyId: string, taskId: string): MutationInput => ({
  familyId,
  entity: 'task',
  entityId: taskId,
  taskId: null,
  method: 'POST',
  path: `${taskPath(familyId, taskId)}/done`,
  body: {},
  patch: { status: 'DONE' },
});

const isRead = (familyId: string, what: 'changes' | 'snapshot') => (r: HttpRequest) =>
  r.method === 'GET' && r.path.startsWith(`/api/sync/families/${familyId}/${what}`);
const ids = (rows: LocalRow[]) => rows.map((r) => r.id).sort();
const SPESA_IDS = [SPESA_SABATO, LATTE, PANE, UOVA].sort();
const notFound404 = { status: 404, body: { error: 'not_found' } };

for (const kind of STORES) {
  test.describe(`giro 025 [${kind}] — deletions only in the family being read (contestazione 83)`, () => {
    for (const order of ['name', 'reverse'] as const) {
      test(`C1/C2 forward Rossi → Bianchi-Verdi, families read in ${order} order: task and 3 items end in Bianchi-Verdi only`, async () => {
        const { server, store, engine } = await setup(kind, ANNA);
        server.familyOrder = order;
        expect((await engine.sync()).status).toBe('ok');
        server.forwardTask(SPESA_SABATO, BIANCHI_VERDI);
        expect((await engine.sync()).status).toBe('ok');
        const bv = (await store.getRows(BIANCHI_VERDI)).filter(
          (r) => r.id === SPESA_SABATO || r.taskId === SPESA_SABATO,
        );
        expect(ids(bv), 'task and its 3 items in Bianchi-Verdi').toEqual(SPESA_IDS);
        const rossi = await store.getRows(ROSSI);
        expect(rossi.some((r) => r.id === SPESA_SABATO || r.taskId === SPESA_SABATO)).toBe(false);
        expect(
          rossi.some((r) => r.id === BOLLETTA),
          'the rest of Rossi stays',
        ).toBe(true);
        const before = await dumpOf(store);
        expect((await engine.sync()).status).toBe('ok');
        expect(await dumpOf(store), 'a second cycle changes nothing').toEqual(before);
      });

      test(`C3 forward Bianchi-Verdi → Rossi of «Portare il cane dal veterinario», ${order} order: the task is only in Rossi`, async () => {
        const { server, store, engine } = await setup(kind, ANNA);
        server.familyOrder = order;
        await engine.sync();
        server.forwardTask(VETERINARIO, ROSSI);
        expect((await engine.sync()).status).toBe('ok');
        expect((await store.getRows(ROSSI)).some((r) => r.id === VETERINARIO)).toBe(true);
        expect((await store.getRows(BIANCHI_VERDI)).some((r) => r.id === VETERINARIO)).toBe(false);
      });
    }

    test('C4 Bianchi-Verdi never read before (no cursor), forward from Rossi: its snapshot, then the changes of Rossi, keep task and items in Bianchi-Verdi', async () => {
      const { server, store, engine } = await setup(kind, ANNA);
      server.removeMember(BIANCHI_VERDI, ANNA);
      await engine.sync();
      expect((await dumpOf(store)).cursors[BIANCHI_VERDI]).toBeUndefined();
      server.addMember(BIANCHI_VERDI, ANNA);
      server.forwardTask(SPESA_SABATO, BIANCHI_VERDI);
      const before = server.requests.length;
      expect((await engine.sync()).status).toBe('ok');
      const cycle = server.requests.slice(before);
      const snapshotAt = cycle.findIndex(isRead(BIANCHI_VERDI, 'snapshot'));
      const changesAt = cycle.findIndex(isRead(ROSSI, 'changes'));
      expect(snapshotAt, 'snapshot of Bianchi-Verdi').toBeGreaterThanOrEqual(0);
      expect(changesAt, 'changes of Rossi after it').toBeGreaterThan(snapshotAt);
      const bv = (await store.getRows(BIANCHI_VERDI)).filter(
        (r) => r.id === SPESA_SABATO || r.taskId === SPESA_SABATO,
      );
      expect(ids(bv)).toEqual(SPESA_IDS);
    });

    test('C5 store contract: deleteRow and deleteRowsOfTask with another family delete nothing; with the right family they delete', async () => {
      const { store } = await load(kind);
      const task: LocalRow = {
        entity: 'task',
        id: SPESA_SABATO,
        familyId: BIANCHI_VERDI,
        taskId: null,
        data: { id: SPESA_SABATO, title: 'Spesa sabato', version: 2 },
      };
      const item: LocalRow = {
        entity: 'shopping_item',
        id: LATTE,
        familyId: BIANCHI_VERDI,
        taskId: SPESA_SABATO,
        data: { id: LATTE, taskId: SPESA_SABATO, text: 'latte' },
      };
      await store.putRow(task);
      await store.putRow(item);
      await store.deleteRow(ROSSI, 'task', SPESA_SABATO);
      await store.deleteRowsOfTask(ROSSI, SPESA_SABATO);
      expect(ids(await store.getRows(BIANCHI_VERDI))).toEqual([SPESA_SABATO, LATTE].sort());
      await store.deleteRowsOfTask(BIANCHI_VERDI, SPESA_SABATO);
      expect(ids(await store.getRows(BIANCHI_VERDI))).toEqual([SPESA_SABATO]);
      await store.deleteRow(BIANCHI_VERDI, 'task', SPESA_SABATO);
      expect(await store.getRows(BIANCHI_VERDI)).toEqual([]);
    });
  });

  test.describe(`giro 025 [${kind}] — version after a 2xx (contestazione 84.1)`, () => {
    const BOLLETTA_PATH = taskPath(ROSSI, BOLLETTA);
    const VET_PATH = taskPath(BIANCHI_VERDI, VETERINARIO);

    test('C6 two offline renames of «Pagare la bolletta» (both version 1), one cycle: both applied, title is the second, version 3, no notice', async () => {
      const { server, store, engine } = await setup(kind, ANNA);
      await engine.sync();
      await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce', 1));
      await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce entro venerdì', 1));
      const result = await engine.sync();
      expect(result.status).toBe('ok');
      expect(result.notices).toEqual([]);
      expect(server.applied).toHaveLength(2);
      expect(server.bodiesSentTo(BOLLETTA_PATH).map((b) => b.version)).toEqual([1, 2]);
      expect(server.tasks.get(BOLLETTA)).toMatchObject({
        title: 'Bolletta luce entro venerdì',
        version: 3,
      });
      expect((await store.getQueue()).length).toBe(0);
    });

    test('C7 the answer of the first is lost: next cycle the replay answers 200, the second goes with version 2 and is applied, no notice', async () => {
      const { server, store, engine } = await setup(kind, ANNA);
      await engine.sync();
      const first = await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce', 1));
      await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce entro venerdì', 1));
      server.failOnce((r) => r.path === BOLLETTA_PATH, 'network-after');
      expect((await engine.sync()).status).toBe('offline');
      const result = await engine.sync();
      expect(result.status).toBe('ok');
      expect(result.notices).toEqual([]);
      expect(server.receivedMutationIds().filter((id) => id === first.mutationId)).toHaveLength(2);
      expect(server.bodiesSentTo(BOLLETTA_PATH).map((b) => b.version)).toEqual([1, 1, 2]);
      expect(server.tasks.get(BOLLETTA)).toMatchObject({
        title: 'Bolletta luce entro venerdì',
        version: 3,
      });
      expect((await store.getQueue()).length).toBe(0);
    });

    test('C7b the answer of the first is lost, then Luca renames: the replay answers the current state (version 3), the second keeps version 1, gets 409 and a conflict notice; Luca’s title wins', async () => {
      const { server, store, engine } = await setup(kind, ANNA);
      await engine.sync();
      await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce', 1));
      const second = await engine.enqueue(
        rename(ROSSI, BOLLETTA, 'Bolletta luce entro venerdì', 1),
      );
      server.failOnce((r) => r.path === BOLLETTA_PATH, 'network-after');
      expect((await engine.sync()).status).toBe('offline');
      server.user = LUCA;
      server.renameTask(BOLLETTA, 'Bolletta pagata da Luca');
      server.user = ANNA;
      const result = await engine.sync();
      expect(result.notices).toContainEqual(
        expect.objectContaining({
          kind: 'conflict',
          entityId: BOLLETTA,
          mutationId: second.mutationId,
        }),
      );
      expect(server.bodiesSentTo(BOLLETTA_PATH).map((b) => b.version)).toEqual([1, 1, 1]);
      expect(server.tasks.get(BOLLETTA)).toMatchObject({
        title: 'Bolletta pagata da Luca',
        version: 3,
      });
      expect((await store.getQueue()).length).toBe(0);
      const local = (await engine.rows(ROSSI)).find((r) => r.id === BOLLETTA);
      expect(local?.data.title).toBe('Bolletta pagata da Luca');
    });

    test('C7c a change without version (done) whose answer is lost, then Luca renames: the rename that follows keeps version 1 and gets 409 with a conflict notice', async () => {
      const { server, store, engine } = await setup(kind, ANNA);
      await engine.sync();
      await engine.enqueue(markDone(ROSSI, BOLLETTA));
      const renamed = await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce pagata', 1));
      server.failOnce((r) => r.path === `${BOLLETTA_PATH}/done`, 'network-after');
      expect((await engine.sync()).status).toBe('offline');
      server.user = LUCA;
      server.renameTask(BOLLETTA, 'Bolletta pagata da Luca');
      server.user = ANNA;
      const result = await engine.sync();
      expect(result.notices).toContainEqual(
        expect.objectContaining({
          kind: 'conflict',
          entityId: BOLLETTA,
          mutationId: renamed.mutationId,
        }),
      );
      expect(server.bodiesSentTo(BOLLETTA_PATH).map((b) => b.version)).toEqual([1]);
      expect(server.tasks.get(BOLLETTA)).toMatchObject({
        title: 'Bolletta pagata da Luca',
        status: 'DONE',
        version: 3,
      });
      expect((await store.getQueue()).length).toBe(0);
    });

    test('C8 a tap during the send of the first queues the second: in the same sync() it leaves with the version of the answer and is applied; a change on another entity keeps its version', async () => {
      const { server, store, engine } = await setup(kind, ANNA);
      await engine.sync();
      await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce', 1));
      let taps: Promise<unknown> | undefined;
      server.onRequest = (r) => {
        if (taps || r.path !== BOLLETTA_PATH) return;
        taps = (async () => {
          await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce entro venerdì', 1));
          await engine.enqueue(
            rename(BIANCHI_VERDI, VETERINARIO, 'Portare Fido dal veterinario', 1),
          );
        })();
      };
      const result = await engine.sync();
      await taps;
      server.onRequest = undefined;
      expect(result.status).toBe('ok');
      expect(result.notices).toEqual([]);
      expect(server.bodiesSentTo(BOLLETTA_PATH).map((b) => b.version)).toEqual([1, 2]);
      expect(server.bodiesSentTo(VET_PATH).map((b) => b.version)).toEqual([1]);
      expect(server.applied, 'all three applied in the same sync()').toHaveLength(3);
      expect(server.tasks.get(BOLLETTA)).toMatchObject({
        title: 'Bolletta luce entro venerdì',
        version: 3,
      });
      expect(server.tasks.get(VETERINARIO)).toMatchObject({
        title: 'Portare Fido dal veterinario',
        version: 2,
      });
      expect((await store.getQueue()).length).toBe(0);
    });

    test('C9 another client renames the task after the first: the second gets 409, a conflict notice, the server state wins', async () => {
      const { server, store, engine } = await setup(kind, ANNA);
      await engine.sync();
      await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta luce', 1));
      const second = await engine.enqueue(
        rename(ROSSI, BOLLETTA, 'Bolletta luce entro venerdì', 1),
      );
      let sends = 0;
      server.onRequest = (r) => {
        if (r.path === BOLLETTA_PATH && ++sends === 2)
          server.renameTask(BOLLETTA, 'Bolletta pagata da Luca');
      };
      const result = await engine.sync();
      server.onRequest = undefined;
      expect(result.notices).toContainEqual(
        expect.objectContaining({
          kind: 'conflict',
          entityId: BOLLETTA,
          mutationId: second.mutationId,
        }),
      );
      expect(server.bodiesSentTo(BOLLETTA_PATH).map((b) => b.version)).toEqual([1, 2]);
      expect(server.tasks.get(BOLLETTA)?.title).toBe('Bolletta pagata da Luca');
      expect((await store.getQueue()).length).toBe(0);
      const local = (await engine.rows(ROSSI)).find((r) => r.id === BOLLETTA);
      expect(local?.data.title).toBe('Bolletta pagata da Luca');
    });
  });

  test.describe(`giro 025 [${kind}] — lost family only with a certain signal (contestazione 84.2)`, () => {
    test('C10 404 not_found on changes and family not listed: rows, queue (notFound notice) and cursor of Bianchi-Verdi wiped; Rossi intact', async () => {
      const { server, store, engine } = await setup(kind, ANNA);
      await engine.sync();
      const rossiBefore = (await dumpOf(store)).rows.filter((r) => r.familyId === ROSSI);
      const queued = await engine.enqueue(
        rename(BIANCHI_VERDI, VETERINARIO, 'Portare Fido dal veterinario', 1),
      );
      server.removeMember(BIANCHI_VERDI, ANNA);
      const result = await engine.sync();
      expect(result.notices).toContainEqual(
        expect.objectContaining({ kind: 'notFound', mutationId: queued.mutationId }),
      );
      const dump = await dumpOf(store);
      expect(dump.rows.filter((r) => r.familyId === BIANCHI_VERDI)).toHaveLength(0);
      expect(dump.queue.filter((q) => q.familyId === BIANCHI_VERDI)).toHaveLength(0);
      expect(dump.cursors[BIANCHI_VERDI]).toBeUndefined();
      expect(dump.rows.filter((r) => r.familyId === ROSSI)).toEqual(rossiBefore);
    });

    for (const what of ['changes', 'snapshot'] as const) {
      test(`C11 404 not_found on ${what} while the family is still listed: retry, nothing deleted, queue intact`, async () => {
        const { server, store, engine } = await setup(kind, ANNA);
        if (what === 'changes') await engine.sync();
        const before = await dumpOf(store);
        let tap: Promise<QueuedMutation> | undefined;
        server.onRequest = (r) => {
          if (!tap && isRead(BIANCHI_VERDI, what)(r)) {
            tap = engine.enqueue(
              rename(BIANCHI_VERDI, VETERINARIO, 'Portare Fido dal veterinario', 1),
            );
          }
        };
        server.failOnce(isRead(BIANCHI_VERDI, what), notFound404);
        const result = await engine.sync();
        server.onRequest = undefined;
        const queued = await tap;
        expect(result.status).toBe('retry');
        expect(result.notices).toEqual([]);
        const dump = await dumpOf(store);
        expect(dump.rows.filter((r) => r.familyId === BIANCHI_VERDI)).toEqual(
          before.rows.filter((r) => r.familyId === BIANCHI_VERDI),
        );
        expect(dump.cursors[BIANCHI_VERDI]).toBe(before.cursors[BIANCHI_VERDI]);
        expect(dump.queue.map((q) => q.mutationId)).toEqual([queued?.mutationId]);
      });
    }

    for (const [label, body] of [
      ['Spring default body', SPRING_NOT_FOUND],
      ['empty body', null],
    ] as const) {
      test(`C12 404 with ${label}, family not listed: retry, nothing deleted; next cycle the 404 not_found wipes it`, async () => {
        const { server, store, engine } = await setup(kind, ANNA);
        await engine.sync();
        const before = await dumpOf(store);
        expect(before.rows.some((r) => r.familyId === BIANCHI_VERDI)).toBe(true);
        server.removeMember(BIANCHI_VERDI, ANNA);
        server.failOnce(isRead(BIANCHI_VERDI, 'changes'), { status: 404, body });
        const result = await engine.sync();
        expect(result.status).toBe('retry');
        expect(await dumpOf(store)).toEqual(before);
        expect((await engine.sync()).status).toBe('ok');
        const dump = await dumpOf(store);
        expect(dump.rows.filter((r) => r.familyId === BIANCHI_VERDI)).toHaveLength(0);
        expect(dump.cursors[BIANCHI_VERDI]).toBeUndefined();
        expect(dump.rows.some((r) => r.familyId === ROSSI)).toBe(true);
      });
    }
  });
}
