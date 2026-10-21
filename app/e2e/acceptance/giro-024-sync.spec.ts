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
  UOVA,
  VETERINARIO,
  type HttpRequest,
  type HttpResponse,
} from './giro-024-fake-sync-server';

// Round 024, T9 part 2: the client sync engine, black box. These tests run in Node (no page):
// they load `src/sync/engine.ts` and `src/sync/memoryStore.ts` (plain TypeScript, no React Native
// or Expo import) and drive them against the fake server of round 023's API. The contract is in
// docs/lab/giri/024-piano.md, «Contratto del motore».

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
type SyncResult = {
  status: 'ok' | 'offline' | 'unauthorized' | 'retry';
  notices: SyncNotice[];
};
type LocalDump = { rows: LocalRow[]; queue: QueuedMutation[]; cursors: Record<string, number> };
type LocalStore = { dump(): Promise<LocalDump> };
type SyncEngine = {
  enqueue(input: MutationInput): Promise<QueuedMutation>;
  sync(): Promise<SyncResult>;
  rows(familyId: string): Promise<LocalRow[]>;
  clear(): Promise<void>;
};
type SyncModules = {
  createMemoryStore: () => LocalStore;
  createSyncEngine: (options: {
    store: LocalStore;
    http: (request: HttpRequest) => Promise<HttpResponse>;
  }) => SyncEngine;
};

/** Loads the production modules at run time, so that this file compiles before they exist. */
async function load(): Promise<SyncModules> {
  const enginePath = '../../src/sync/engine';
  const storePath = '../../src/sync/memoryStore';
  const engine = await import(enginePath).catch(() => undefined);
  const store = await import(storePath).catch(() => undefined);
  expect(engine?.createSyncEngine, 'src/sync/engine.ts exports createSyncEngine').toBeInstanceOf(
    Function,
  );
  expect(
    store?.createMemoryStore,
    'src/sync/memoryStore.ts exports createMemoryStore',
  ).toBeInstanceOf(Function);
  return { createSyncEngine: engine.createSyncEngine, createMemoryStore: store.createMemoryStore };
}

const itemsPath = (familyId: string, taskId: string, itemId: string) =>
  `/api/families/${familyId}/tasks/${taskId}/items/${itemId}/checked`;

const check = (itemId: string, checked = true): MutationInput => ({
  familyId: ROSSI,
  entity: 'shopping_item',
  entityId: itemId,
  taskId: SPESA_SABATO,
  method: 'PUT',
  path: itemsPath(ROSSI, SPESA_SABATO, itemId),
  body: { checked },
  patch: { checked },
});

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
  path: `/api/families/${familyId}/tasks/${taskId}`,
  body: { title, version },
  patch: { title },
});

const isMutation = (r: HttpRequest) => r.method !== 'GET';
const isChanges = (familyId: string) => (r: HttpRequest) =>
  r.path.startsWith(`/api/sync/families/${familyId}/changes`);
const row = (rows: LocalRow[], id: string) => rows.find((r) => r.id === id);
const appliedChecks = (server: FakeSyncServer) =>
  server.applied.map((a) => a.path.split('/items/')[1]?.split('/')[0]);

async function setup(user = ANNA) {
  const { createSyncEngine, createMemoryStore } = await load();
  const server = new FakeSyncServer();
  server.user = user;
  const store = createMemoryStore();
  const engine = createSyncEngine({ store, http: server.http });
  return { server, store, engine, createSyncEngine };
}

test.describe('giro 024 — sync engine: queue, order, restart', () => {
  test('offline checks of latte, pane, uova reach the server after reconnection, in order', async () => {
    const { server, engine } = await setup(LUCA);
    expect((await engine.sync()).status).toBe('ok');
    server.failOnce(() => true, 'network-before');
    const queued = [];
    for (const id of [LATTE, PANE, UOVA]) queued.push(await engine.enqueue(check(id)));
    for (const id of [LATTE, PANE, UOVA]) {
      expect(row(await engine.rows(ROSSI), id)?.data.checked, `${id} checked locally`).toBe(true);
    }
    expect((await engine.sync()).status).toBe('offline');
    expect(server.applied).toHaveLength(0);
    expect((await engine.sync()).status).toBe('ok');
    expect(appliedChecks(server)).toEqual([LATTE, PANE, UOVA]);
    expect(server.applied.map((a) => a.mutationId)).toEqual(queued.map((q) => q.mutationId));
    for (const id of [LATTE, PANE, UOVA]) expect(server.items.get(id)?.checked).toBe(true);
  });

  test('the queue is sent before any read of the cycle', async () => {
    const { server, engine } = await setup(LUCA);
    await engine.sync();
    for (const id of [LATTE, PANE, UOVA]) await engine.enqueue(check(id));
    const before = server.requests.length;
    await engine.sync();
    const cycle = server.requests.slice(before);
    expect(cycle.slice(0, 3).map((r) => r.path)).toEqual(
      [LATTE, PANE, UOVA].map((id) => itemsPath(ROSSI, SPESA_SABATO, id)),
    );
    expect(cycle.slice(3).every((r) => r.method === 'GET')).toBe(true);
    expect(cycle.slice(3).some(isChanges(ROSSI))).toBe(true);
  });

  for (const when of ['network-before', 'network-after'] as const) {
    test(`network drops mid-send (${when} the server applies): nothing lost, nothing doubled, also with a new engine on the same store`, async () => {
      const { server, store, engine, createSyncEngine } = await setup(LUCA);
      await engine.sync();
      const queued = [];
      for (const id of [LATTE, PANE, UOVA]) queued.push(await engine.enqueue(check(id)));
      server.failOnce((r) => r.path === itemsPath(ROSSI, SPESA_SABATO, PANE), when);
      expect((await engine.sync()).status).toBe('offline');
      const dump = await store.dump();
      expect(dump.queue[0]?.mutationId, 'pane keeps its mutation id in the store').toBe(
        queued[1].mutationId,
      );
      // The app was closed: a new engine on the same store finishes the job.
      const again = createSyncEngine({ store, http: server.http });
      expect((await again.sync()).status).toBe('ok');
      expect(server.applied.map((a) => a.mutationId)).toEqual(queued.map((q) => q.mutationId));
      expect(appliedChecks(server)).toEqual([LATTE, PANE, UOVA]);
      const sent = server.receivedMutationIds();
      expect(new Set(sent)).toEqual(new Set(queued.map((q) => q.mutationId)));
      expect((await store.dump()).queue).toHaveLength(0);
    });
  }

  test('two sync() calls at once: one cycle, each mutation id sent once', async () => {
    const { server, engine } = await setup(LUCA);
    for (const id of [LATTE, PANE, UOVA]) await engine.enqueue(check(id));
    await Promise.all([engine.sync(), engine.sync()]);
    const sent = server.receivedMutationIds();
    expect(sent).toHaveLength(3);
    expect(new Set(sent).size).toBe(3);
    expect(server.requestsTo(`/api/sync/families/${ROSSI}/snapshot`)).toHaveLength(1);
  });

  test('a tap during the read is not overwritten by the server state', async () => {
    const { server, engine } = await setup(LUCA);
    await engine.sync();
    server.setItemText(PANE, 'pane integrale');
    let tap: Promise<QueuedMutation> | undefined;
    server.onRequest = (r) => {
      if (!tap && isChanges(ROSSI)(r)) tap = engine.enqueue(check(PANE));
    };
    expect((await engine.sync()).status).toBe('ok');
    await tap;
    const pane = row(await engine.rows(ROSSI), PANE);
    expect(pane?.data.text).toBe('pane integrale');
    expect(pane?.data.checked, 'the pending check stays on top').toBe(true);
    server.onRequest = undefined;
    await engine.sync();
    expect(server.items.get(PANE)?.checked).toBe(true);
  });
});

test.describe('giro 024 — sync engine: reads by seq', () => {
  test('a new family: snapshot first, then only changes after its seq', async () => {
    const { server, engine } = await setup(ANNA);
    await engine.sync();
    for (const family of [ROSSI, BIANCHI_VERDI]) {
      const snapshots = server.requestsTo(`/api/sync/families/${family}/snapshot`);
      expect(snapshots, `one snapshot of ${family}`).toHaveLength(1);
      const first = server.requests.findIndex((r) => r.path.includes(`/families/${family}/`));
      expect(server.requests[first].path).toContain('/snapshot');
    }
    const seq = server.currentSeq(ROSSI);
    server.renameTask(BOLLETTA, 'Pagare la bolletta della luce entro venerdì');
    const before = server.requests.length;
    await engine.sync();
    const cycle = server.requests.slice(before);
    expect(cycle.some((r) => r.path.includes('/snapshot'))).toBe(false);
    const rossi = cycle.filter(isChanges(ROSSI));
    expect(rossi.length).toBeGreaterThan(0);
    expect(new URL(rossi[0].path, 'http://x').searchParams.get('after')).toBe(String(seq));
    expect(row(await engine.rows(ROSSI), BOLLETTA)?.data.title).toBe(
      'Pagare la bolletta della luce entro venerdì',
    );
  });

  test('hasMore: pages are read until the end in one cycle; a cut page resumes from the saved cursor', async () => {
    const { server, store, engine, createSyncEngine } = await setup(LUCA);
    await engine.sync();
    server.pageSize = 2;
    server.setItemText(LATTE, 'latte fresco');
    server.setItemText(PANE, 'pane integrale');
    server.setItemText(UOVA, 'uova bio');
    server.renameTask(BOLLETTA, 'Pagare la bolletta della luce entro venerdì');
    server.renameTask(SPESA_SABATO, 'Spesa sabato mattina');
    const start = server.currentSeq(ROSSI) - 5;
    const pageOne = start + 2;
    // The second page is lost on the way: the first one stays, with its cursor.
    let pages = 0;
    server.failOnce((r) => isChanges(ROSSI)(r) && ++pages === 2, 'network-before');
    expect((await engine.sync()).status).toBe('offline');
    const dump = await store.dump();
    expect(dump.cursors[ROSSI]).toBe(pageOne);
    expect(row(dump.rows, LATTE)?.data.text).toBe('latte fresco');
    expect(row(dump.rows, PANE)?.data.text).toBe('pane integrale');
    const again = createSyncEngine({ store, http: server.http });
    const before = server.requests.length;
    expect((await again.sync()).status).toBe('ok');
    const reads = server.requests.slice(before).filter(isChanges(ROSSI));
    expect(new URL(reads[0].path, 'http://x').searchParams.get('after')).toBe(String(pageOne));
    expect(reads.length, 'two more pages in the same cycle').toBeGreaterThanOrEqual(2);
    const rows = await again.rows(ROSSI);
    expect(row(rows, UOVA)?.data.text).toBe('uova bio');
    expect(row(rows, SPESA_SABATO)?.data.title).toBe('Spesa sabato mattina');
    expect((await store.dump()).cursors[ROSSI]).toBe(server.currentSeq(ROSSI));
  });
});

test.describe('giro 024 — sync engine: answers of the server', () => {
  test('409 version_conflict: the change is dropped, a notice comes out, the server state wins', async () => {
    const { server, store, engine } = await setup(LUCA);
    await engine.sync();
    const version = row(await engine.rows(ROSSI), BOLLETTA)?.data.version as number;
    server.renameTask(BOLLETTA, 'Pagare la bolletta della luce entro venerdì');
    const queued = await engine.enqueue(rename(ROSSI, BOLLETTA, 'Bolletta pagata?', version));
    const result = await engine.sync();
    expect(result.status).toBe('ok');
    expect(result.notices).toContainEqual(
      expect.objectContaining({
        kind: 'conflict',
        entityId: BOLLETTA,
        mutationId: queued.mutationId,
      }),
    );
    expect((await store.dump()).queue).toHaveLength(0);
    expect(row(await engine.rows(ROSSI), BOLLETTA)?.data.title).toBe(
      'Pagare la bolletta della luce entro venerdì',
    );
  });

  for (const [status, kind] of [
    [403, 'forbidden'],
    [400, 'invalid'],
    [404, 'notFound'],
  ] as const) {
    test(`${status}: the change is dropped with a «${kind}» notice and the view goes back to the server`, async () => {
      const { server, store, engine } = await setup(LUCA);
      await engine.sync();
      const queued = await engine.enqueue(check(UOVA));
      server.failOnce((r) => r.path === itemsPath(ROSSI, SPESA_SABATO, UOVA), status);
      const result = await engine.sync();
      expect(result.notices).toContainEqual(
        expect.objectContaining({ kind, entityId: UOVA, mutationId: queued.mutationId }),
      );
      expect((await store.dump()).queue).toHaveLength(0);
      expect(row(await engine.rows(ROSSI), UOVA)?.data.checked).toBe(false);
      await engine.sync();
      expect(server.receivedMutationIds()).toEqual([queued.mutationId]);
    });
  }

  for (const fault of [503, 429, 'network-before'] as const) {
    test(`transient (${fault}): the change stays queued and is retried`, async () => {
      const { server, store, engine } = await setup(LUCA);
      await engine.sync();
      const queued = await engine.enqueue(check(LATTE));
      server.failOnce(isMutation, fault);
      const result = await engine.sync();
      expect(result.status).toBe(fault === 'network-before' ? 'offline' : 'retry');
      expect(result.notices).toHaveLength(0);
      expect((await store.dump()).queue.map((q) => q.mutationId)).toEqual([queued.mutationId]);
      expect(row(await engine.rows(ROSSI), LATTE)?.data.checked).toBe(true);
      expect((await engine.sync()).status).toBe('ok');
      expect(server.applied.map((a) => a.mutationId)).toEqual([queued.mutationId]);
    });
  }

  test('401: the cycle stops, nothing is dropped, nothing is deleted', async () => {
    const { server, store, engine } = await setup(ANNA);
    await engine.sync();
    await engine.enqueue(check(LATTE));
    const before = await store.dump();
    server.failOnce(isMutation, 401);
    const count = server.requests.length;
    expect((await engine.sync()).status).toBe('unauthorized');
    expect(server.requests.length, 'no request after the 401').toBe(count + 1);
    expect(await store.dump()).toEqual(before);
    server.failOnce(isChanges(BIANCHI_VERDI), 401);
    const result = await engine.sync();
    expect(result.status).toBe('unauthorized');
    expect((await engine.rows(BIANCHI_VERDI)).length).toBeGreaterThan(0);
  });
});

test.describe('giro 024 — sync engine: forwarding, lost families, isolation', () => {
  test('a task forwarded out of the user families leaves no row of the task nor of its items', async () => {
    const { server, store, engine } = await setup(LUCA);
    await engine.sync();
    expect((await engine.rows(ROSSI)).filter((r) => r.taskId === SPESA_SABATO)).toHaveLength(3);
    server.forwardTask(SPESA_SABATO, BIANCHI_VERDI);
    expect((await engine.sync()).status).toBe('ok');
    const rows = (await store.dump()).rows;
    expect(rows.filter((r) => r.id === SPESA_SABATO)).toHaveLength(0);
    expect(
      rows.filter((r) => r.taskId === SPESA_SABATO),
      'items deleted in cascade',
    ).toHaveLength(0);
    expect(row(rows, BOLLETTA), 'the rest of Rossi stays').toBeDefined();
  });

  test('a lost family (404 on its reads) is wiped, its queued change dropped with a notice', async () => {
    const { server, store, engine } = await setup(ANNA);
    await engine.sync();
    expect((await engine.rows(BIANCHI_VERDI)).length).toBeGreaterThan(0);
    const queued = await engine.enqueue(
      rename(BIANCHI_VERDI, VETERINARIO, 'Portare Fido dal veterinario', 1),
    );
    server.removeMember(BIANCHI_VERDI, ANNA);
    const result = await engine.sync();
    expect(result.notices).toContainEqual(
      expect.objectContaining({ kind: 'notFound', mutationId: queued.mutationId }),
    );
    const dump = await store.dump();
    expect(dump.rows.filter((r) => r.familyId === BIANCHI_VERDI)).toHaveLength(0);
    expect(dump.queue.filter((q) => q.familyId === BIANCHI_VERDI)).toHaveLength(0);
    expect(dump.cursors[BIANCHI_VERDI]).toBeUndefined();
    expect(dump.rows.some((r) => r.familyId === ROSSI)).toBe(true);
  });

  test('a network error or 401 is not a lost family: nothing is wiped', async () => {
    const { server, store, engine } = await setup(ANNA);
    await engine.sync();
    const count = (await store.dump()).rows.filter((r) => r.familyId === BIANCHI_VERDI).length;
    server.removeMember(BIANCHI_VERDI, ANNA);
    server.failOnce(isChanges(BIANCHI_VERDI), 'network-before');
    await engine.sync();
    let dump = await store.dump();
    expect(dump.rows.filter((r) => r.familyId === BIANCHI_VERDI)).toHaveLength(count);
    server.failOnce(() => true, 401);
    await engine.sync();
    dump = await store.dump();
    expect(dump.rows.filter((r) => r.familyId === BIANCHI_VERDI)).toHaveLength(count);
    server.failOnce((r) => r.path === '/api/families', 'network-before');
    await engine.sync();
    dump = await store.dump();
    expect(dump.rows.filter((r) => r.familyId === BIANCHI_VERDI)).toHaveLength(count);
    // The certain signal: 404 on the read of the family.
    await engine.sync();
    dump = await store.dump();
    expect(dump.rows.filter((r) => r.familyId === BIANCHI_VERDI)).toHaveLength(0);
  });

  test('isolation: Luca never reads Bianchi-Verdi; on a shared store his sync wipes what Anna had there', async () => {
    const luca = await setup(LUCA);
    await luca.engine.sync();
    expect(luca.server.requests.some((r) => r.path.includes(BIANCHI_VERDI))).toBe(false);
    const lucaDump = await luca.store.dump();
    expect(lucaDump.rows.every((r) => r.familyId === ROSSI)).toBe(true);
    expect(lucaDump.rows.some((r) => r.id === VETERINARIO)).toBe(false);

    const anna = await setup(ANNA);
    await anna.engine.sync();
    expect(row(await anna.engine.rows(BIANCHI_VERDI), VETERINARIO)).toBeDefined();
    // Same phone, Luca signs in without a cleared store.
    anna.server.user = LUCA;
    await anna.engine.sync();
    const shared = await anna.store.dump();
    expect(shared.rows.some((r) => r.familyId === BIANCHI_VERDI)).toBe(false);
    expect(shared.cursors[BIANCHI_VERDI]).toBeUndefined();
    const lucaReads = anna.server.requests.filter((r) => r.user === LUCA && r.method === 'GET');
    expect(
      lucaReads.some((r) => r.path.includes('/snapshot') && r.path.includes(BIANCHI_VERDI)),
    ).toBe(false);
  });

  test('clear() empties rows, queue and cursors (sign out)', async () => {
    const { store, engine } = await setup(ANNA);
    await engine.sync();
    await engine.enqueue(check(LATTE));
    await engine.clear();
    expect(await store.dump()).toEqual({ rows: [], queue: [], cursors: {} });
  });
});
