import { expect, test } from '@playwright/test';

import {
  ANNA,
  BIANCHI_VERDI,
  DEMO_PASSWORD,
  FAKE_BASE_URL,
  FakeSyncServer,
  LATTE,
  LUCA,
  PANE,
  PEOPLE,
  ROSSI,
  SPESA_SABATO,
  openNodeSqlDatabase,
  type FetchInit,
  type FetchRecord,
  type HttpRequest,
  type HttpResponse,
  type SqlDatabase,
} from './giro-026-fake-sync-server';

// Round 026, T9 part 3: Android session with a token and the life cycle of the sync engine
// (docs/lab/giri/026-piano.md, «Contratti per i test»). Node only, no page: fake fetch, fake
// timers, fake AppState, fake vault. Production modules are loaded at run time, so that this file
// compiles before they exist; they must not import react-native or expo modules at load time.

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
type SyncResult = { status: 'ok' | 'offline' | 'unauthorized' | 'retry'; notices: unknown[] };
type LocalStore = {
  getRows(familyId: string): Promise<LocalRow[]>;
  getCursor(familyId: string): Promise<number | undefined>;
  cursorFamilies(): Promise<string[]>;
  getQueue(): Promise<QueuedMutation[]>;
};
type Http = (request: HttpRequest) => Promise<HttpResponse>;
type SyncEngine = {
  enqueue(input: MutationInput): Promise<QueuedMutation>;
  sync(): Promise<SyncResult>;
  rows(familyId: string): Promise<LocalRow[]>;
  clear(): Promise<void>;
};
type Credentials = { token: string; personId: string };
type TokenVault = {
  get(): Promise<Credentials | null>;
  set(credentials: Credentials): Promise<void>;
  clear(): Promise<void>;
};
type Timers = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};
type AppStateLike = {
  currentState: string | null;
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
};
type LoginOutcome = 'ok' | 'invalid' | 'tooMany' | 'error';
type Fetch = (input: string, init?: FetchInit) => Promise<Response>;
/** `src/api/tokenSession.ts` */
type TokenSession = {
  login(email: string, password: string): Promise<LoginOutcome>;
  current(): Promise<Credentials | undefined>;
  http: Http;
  logout(): Promise<void>;
};
type CreateTokenSession = (options: {
  vault: TokenVault;
  fetch: Fetch;
  baseUrl: string;
  timers: Timers;
  timeoutMs: number;
}) => TokenSession;
/** `src/sync/session.ts` */
type SyncSession = {
  start(): Promise<void>;
  afterWrite(): void;
  stop(): void;
  signIn(email: string, password: string): Promise<LoginOutcome>;
  signOut(): Promise<void>;
};
type CreateSyncSession = (options: {
  engine: SyncEngine;
  auth: TokenSession;
  timers: Timers;
  appState: AppStateLike;
  onUnauthorized: () => void;
}) => SyncSession;
/** `src/shopping/queued.ts` */
type CheckItemMutation = (input: {
  familyId: string;
  taskId: string;
  itemId: string;
  checked: boolean;
}) => MutationInput;
type AddItemMutation = (input: {
  familyId: string;
  taskId: string;
  itemId: string;
  text: string;
}) => MutationInput;

const TIMEOUT_MS = 15_000;
const MINUTE = 60_000;
/** The longest `signOut()` waits for a cycle in flight (plan: 5 s). */
const SIGN_OUT_WAIT_MS = 5_000;
const CAFFE = '0192f0a0-0000-7000-8000-000000000204';
const ANNA_ID = PEOPLE[ANNA].personId;
const LUCA_ID = PEOPLE[LUCA].personId;

/** Lets every pending promise and real immediate run (the fake timers do not move). */
async function settle(rounds = 40): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve));
}

class FakeTimers implements Timers {
  private now = 0;
  private nextId = 1;
  private readonly tasks = new Map<number, { at: number; fn: () => void; every?: number }>();

  readonly setTimeout = (fn: () => void, ms = 0): unknown => {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + Math.max(0, ms), fn });
    return id;
  };
  readonly clearTimeout = (handle: unknown): void => void this.tasks.delete(handle as number);
  readonly setInterval = (fn: () => void, ms = 0): unknown => {
    if (ms <= 0) throw new Error('interval of 0 ms');
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + ms, fn, every: ms });
    return id;
  };
  readonly clearInterval = (handle: unknown): void => void this.tasks.delete(handle as number);

  /** Moves the clock, running due callbacks in order and settling after each. */
  async advance(ms: number): Promise<void> {
    const end = this.now + ms;
    await settle();
    for (;;) {
      let next: [number, { at: number; fn: () => void; every?: number }] | undefined;
      for (const entry of this.tasks) {
        if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
      }
      if (!next) break;
      const [id, task] = next;
      this.now = task.at;
      if (task.every) task.at += task.every;
      else this.tasks.delete(id);
      task.fn();
      await settle();
    }
    this.now = end;
    await settle();
  }
}

class FakeAppState implements AppStateLike {
  currentState: string | null = 'active';
  private readonly listeners = new Set<(state: string) => void>();

  addEventListener(_type: 'change', listener: (state: string) => void) {
    this.listeners.add(listener);
    return { remove: () => void this.listeners.delete(listener) };
  }

  emit(state: string): void {
    this.currentState = state;
    for (const listener of [...this.listeners]) listener(state);
  }
}

class FakeVault implements TokenVault {
  value: Credentials | null = null;
  /** `get()` rejects, like «Could not decrypt the item» after a Keystore change. */
  failGet = false;
  clears = 0;

  async get(): Promise<Credentials | null> {
    if (this.failGet) throw new Error('Could not decrypt the item (fake)');
    return this.value ? { ...this.value } : null;
  }
  async set(credentials: Credentials): Promise<void> {
    this.value = { ...credentials };
  }
  async clear(): Promise<void> {
    this.clears++;
    this.value = null;
  }
}

const STORES = ['memory', 'sqlite'] as const;
type StoreKind = (typeof STORES)[number];

async function importOrUndefined(path: string) {
  return import(path).catch(() => undefined);
}

async function load(kind: StoreKind) {
  const engine = await importOrUndefined('../../src/sync/engine');
  expect(engine?.createSyncEngine, 'src/sync/engine.ts exports createSyncEngine').toBeInstanceOf(
    Function,
  );
  const tokenSession = await importOrUndefined('../../src/api/tokenSession');
  expect(
    tokenSession?.createTokenSession,
    'src/api/tokenSession.ts exports createTokenSession (no react-native import at load time)',
  ).toBeInstanceOf(Function);
  const session = await importOrUndefined('../../src/sync/session');
  expect(
    session?.createSyncSession,
    'src/sync/session.ts exports createSyncSession (no react-native import at load time)',
  ).toBeInstanceOf(Function);
  const queued = await importOrUndefined('../../src/shopping/queued');
  expect(
    queued?.checkItemMutation,
    'src/shopping/queued.ts exports checkItemMutation',
  ).toBeInstanceOf(Function);
  expect(queued?.addItemMutation, 'src/shopping/queued.ts exports addItemMutation').toBeInstanceOf(
    Function,
  );
  let store: LocalStore;
  if (kind === 'memory') {
    const memory = await importOrUndefined('../../src/sync/memoryStore');
    store = memory.createMemoryStore();
  } else {
    const sql = await importOrUndefined('../../src/sync/sqlStore');
    const db: SqlDatabase = await openNodeSqlDatabase();
    store = await sql.createSqlStore(db);
  }
  return {
    store,
    createSyncEngine: engine.createSyncEngine as (o: {
      store: LocalStore;
      http: Http;
    }) => SyncEngine,
    createTokenSession: tokenSession.createTokenSession as CreateTokenSession,
    createSyncSession: session.createSyncSession as CreateSyncSession,
    checkItemMutation: queued.checkItemMutation as CheckItemMutation,
    addItemMutation: queued.addItemMutation as AddItemMutation,
  };
}

/** Engine, token session and sync session wired as the Android root layout does. */
async function setup(kind: StoreKind = 'memory') {
  const mods = await load(kind);
  const server = new FakeSyncServer();
  const timers = new FakeTimers();
  const vault = new FakeVault();
  const appState = new FakeAppState();
  const net: { fetch: Fetch } = { fetch: server.fetch };
  const auth = mods.createTokenSession({
    vault,
    fetch: (input, init) => net.fetch(input, init),
    baseUrl: FAKE_BASE_URL,
    timers,
    timeoutMs: TIMEOUT_MS,
  });
  const engine = mods.createSyncEngine({ store: mods.store, http: auth.http });
  const unauthorized = { count: 0 };
  const session = mods.createSyncSession({
    engine,
    auth,
    timers,
    appState,
    onUnauthorized: () => unauthorized.count++,
  });
  return { ...mods, server, timers, vault, appState, net, auth, engine, session, unauthorized };
}

/** A vault already holding a live token of `user` (an earlier login, before a restart). */
function remembered(server: FakeSyncServer, vault: FakeVault, user: string) {
  vault.value = { token: server.issueToken(user), personId: PEOPLE[user].personId };
}

async function dumpOf(store: LocalStore) {
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

/** Cycles that reached the family list (one per completed online cycle). */
const cycles = (server: FakeSyncServer) =>
  server.fetches.filter((f) => f.method === 'GET' && f.url === `${FAKE_BASE_URL}/api/families`)
    .length;

const isChangesOf = (familyId: string) => (f: FetchRecord) =>
  f.method === 'GET' && f.url.startsWith(`${FAKE_BASE_URL}/api/sync/families/${familyId}/changes`);

const check = (itemId: string) => ({
  familyId: ROSSI,
  taskId: SPESA_SABATO,
  itemId,
  checked: true,
});

test.describe('giro 026 — Android login with a token (S1)', () => {
  test('S1 Anna signs in: client "android", token and personId in the vault, then Bearer requests without CSRF and without cookies', async () => {
    const { server, vault, session } = await setup();
    expect(await session.signIn(ANNA, DEMO_PASSWORD)).toBe('ok');
    await settle();
    const [loginCall, ...rest] = server.fetches;
    expect(loginCall.url).toBe(`${FAKE_BASE_URL}/api/auth/login`);
    expect(loginCall.method).toBe('POST');
    expect(loginCall.body).toMatchObject({ email: ANNA, client: 'android' });
    expect(vault.value).toEqual({ token: 'tok-anna-demo', personId: ANNA_ID });
    expect(rest.length, 'a sync cycle starts after the login').toBeGreaterThan(0);
    expect(cycles(server)).toBe(1);
    for (const f of rest) {
      expect(f.url.startsWith(`${FAKE_BASE_URL}/api/`), f.url).toBe(true);
      expect(f.headers.authorization).toBe('Bearer tok-anna-demo');
      expect(f.headers['x-csrf-token']).toBeUndefined();
    }
    for (const f of server.fetches) expect(f.credentials, f.url).toBe('omit');
  });

  test('S1b wrong password: "invalid", vault empty, no sync request', async () => {
    const { server, vault, session, timers } = await setup();
    expect(await session.signIn(ANNA, 'not-the-password')).toBe('invalid');
    await timers.advance(2 * MINUTE);
    expect(vault.value).toBeNull();
    expect(server.fetches).toHaveLength(1);
  });
});

test.describe('giro 026 — life cycle of the sync session (S2)', () => {
  test('S2 start with a token in the vault: one cycle at once, one every 60 s while active, none in background, one at once back in active', async () => {
    const { server, vault, session, timers, appState } = await setup();
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    expect(cycles(server), 'one cycle at start').toBe(1);
    await timers.advance(MINUTE);
    expect(cycles(server)).toBe(2);
    await timers.advance(MINUTE);
    expect(cycles(server)).toBe(3);
    appState.emit('background');
    await timers.advance(3 * MINUTE);
    expect(cycles(server), 'no cycle in background').toBe(3);
    appState.emit('active');
    await settle();
    expect(cycles(server), 'one cycle at once back in active').toBe(4);
    await timers.advance(MINUTE);
    expect(cycles(server)).toBe(5);
  });

  test('S2b start() twice: a single cycle at start and a single interval', async () => {
    const { server, vault, session, timers } = await setup();
    remembered(server, vault, ANNA);
    await session.start();
    await session.start();
    await settle();
    expect(cycles(server)).toBe(1);
    await timers.advance(MINUTE);
    expect(cycles(server), 'one cycle per minute, not two').toBe(2);
    await timers.advance(MINUTE);
    expect(cycles(server)).toBe(3);
  });

  test('S2c AppState.currentState null at start counts as active: one cycle, then the interval runs', async () => {
    const { server, vault, session, timers, appState } = await setup();
    remembered(server, vault, ANNA);
    appState.currentState = null;
    await session.start();
    await settle();
    expect(cycles(server)).toBe(1);
    await timers.advance(MINUTE);
    expect(cycles(server)).toBe(2);
  });

  test('S2d the vault fails to read: no token, the entry is cleared, no request at all', async () => {
    const { server, vault, session, auth, timers } = await setup();
    remembered(server, vault, ANNA);
    vault.failGet = true;
    await session.start();
    await timers.advance(2 * MINUTE);
    expect(server.fetches).toHaveLength(0);
    expect(vault.clears).toBeGreaterThanOrEqual(1);
    expect(vault.value).toBeNull();
    expect(await auth.current()).toBeUndefined();
  });

  test('S2e stop(): no cycle afterwards, not even back in active', async () => {
    const { server, vault, session, timers, appState } = await setup();
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    session.stop();
    await timers.advance(3 * MINUTE);
    appState.emit('background');
    appState.emit('active');
    await settle();
    expect(cycles(server)).toBe(1);
  });
});

for (const kind of STORES) {
  test(`S3 [${kind}] offline: Anna checks latte and pane and adds «caffè»; at the next 60 s tick with the network back the server gets the three changes once, in order`, async () => {
    const t = await setup(kind);
    const { server, vault, session, timers, engine } = t;
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    expect(cycles(server)).toBe(1);
    server.down = true;
    const queued: QueuedMutation[] = [];
    queued.push(await engine.enqueue(t.checkItemMutation(check(LATTE))));
    session.afterWrite();
    queued.push(await engine.enqueue(t.checkItemMutation(check(PANE))));
    session.afterWrite();
    queued.push(
      await engine.enqueue(
        t.addItemMutation({ familyId: ROSSI, taskId: SPESA_SABATO, itemId: CAFFE, text: 'caffè' }),
      ),
    );
    session.afterWrite();
    await settle();
    expect(server.applied, 'nothing reaches the server while offline').toHaveLength(0);
    const local = await engine.rows(ROSSI);
    const byId = (id: string) => local.find((r) => r.id === id);
    expect(byId(LATTE)?.data.checked).toBe(true);
    expect(byId(PANE)?.data.checked).toBe(true);
    expect(byId(CAFFE)).toMatchObject({ entity: 'shopping_item', taskId: SPESA_SABATO });
    expect(byId(CAFFE)?.data.text).toBe('caffè');
    expect(byId(CAFFE)?.data.checked).not.toBe(true);

    server.down = false;
    await timers.advance(MINUTE);
    expect(server.applied.map((a) => a.mutationId)).toEqual(queued.map((q) => q.mutationId));
    expect(server.items.get(LATTE)?.checked).toBe(true);
    expect(server.items.get(PANE)?.checked).toBe(true);
    expect(server.items.get(CAFFE)).toMatchObject({ taskId: SPESA_SABATO, text: 'caffè' });
    expect((await t.store.getQueue()).length).toBe(0);
    const sent = server.fetchesWithMutation().length;
    await timers.advance(MINUTE);
    expect(server.fetchesWithMutation().length, 'a second cycle sends nothing again').toBe(sent);
    expect(server.applied).toHaveLength(3);
  });
}

test.describe('giro 026 — afterWrite during a cycle (S4)', () => {
  test('S4 three afterWrite() during a cycle in flight: exactly one more cycle, without moving the clock, and the change applied once', async () => {
    const t = await setup();
    const { server, vault, session, engine } = t;
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    expect(cycles(server)).toBe(1);
    const release = server.hold(
      (f) => f.method === 'GET' && f.url === `${FAKE_BASE_URL}/api/families`,
    );
    session.afterWrite();
    await settle();
    expect(cycles(server), 'the second cycle is in flight, held on /api/families').toBe(2);
    const latte = await engine.enqueue(t.checkItemMutation(check(LATTE)));
    session.afterWrite();
    session.afterWrite();
    session.afterWrite();
    release();
    await settle();
    expect(cycles(server), 'exactly one cycle more, at once').toBe(3);
    expect(server.applied.map((a) => a.mutationId)).toEqual([latte.mutationId]);
    await settle();
    expect(cycles(server), 'and no further cycle').toBe(3);
  });
});

test.describe('giro 026 — 401 (S5)', () => {
  test('S5 the token is revoked: result unauthorized, onUnauthorized once, timer stopped, store and queue unchanged, vault kept', async () => {
    const t = await setup();
    const { server, vault, session, engine, timers, unauthorized } = t;
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    server.revokeTokensOf(ANNA);
    await engine.enqueue(t.checkItemMutation(check(LATTE)));
    const before = await dumpOf(t.store);
    session.afterWrite();
    await settle();
    expect(unauthorized.count).toBe(1);
    expect(await dumpOf(t.store)).toEqual(before);
    expect(vault.value?.personId).toBe(ANNA_ID);
    const sent = server.fetches.length;
    await timers.advance(3 * MINUTE);
    expect(server.fetches.length, 'no request after a 401').toBe(sent);
  });

  test('S5b after the 401 Luca signs in on the same phone: Anna’s store and queue are cleared before his first sync; Anna’s change never leaves with Luca’s token', async () => {
    const t = await setup();
    const { server, vault, session, engine } = t;
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    server.revokeTokensOf(ANNA);
    const latte = await engine.enqueue(t.checkItemMutation(check(LATTE)));
    session.afterWrite();
    await settle();
    expect(t.unauthorized.count).toBe(1);
    expect(await session.signIn(LUCA, DEMO_PASSWORD)).toBe('ok');
    await settle();
    expect(vault.value).toEqual({ token: 'tok-luca-demo', personId: LUCA_ID });
    expect(server.receivedMutationIds()).not.toContain(latte.mutationId);
    expect(server.items.get(LATTE)?.checked).toBe(false);
    const dump = await dumpOf(t.store);
    expect(dump.queue).toEqual([]);
    expect(
      dump.rows.filter((r) => r.familyId === BIANCHI_VERDI),
      'nothing of Bianchi-Verdi',
    ).toEqual([]);
    expect(dump.cursors[BIANCHI_VERDI]).toBeUndefined();
    expect((await engine.rows(ROSSI)).find((r) => r.id === LATTE)?.data.checked).toBe(false);
  });

  test('S5c after the 401 Anna signs in again: her queue is kept and sent once with the new token', async () => {
    const t = await setup();
    const { server, vault, session, engine } = t;
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    server.revokeTokensOf(ANNA);
    const latte = await engine.enqueue(t.checkItemMutation(check(LATTE)));
    session.afterWrite();
    await settle();
    expect(await session.signIn(ANNA, DEMO_PASSWORD)).toBe('ok');
    await settle();
    expect(server.applied.map((a) => a.mutationId)).toEqual([latte.mutationId]);
    const sentWith = server
      .fetchesWithMutation()
      .filter((f) => f.body && (f.body as { mutationId: string }).mutationId === latte.mutationId);
    expect(sentWith.at(-1)?.headers.authorization).toBe(`Bearer ${vault.value?.token}`);
    expect(vault.value?.token).not.toBe('tok-anna-demo');
  });
});

for (const kind of STORES) {
  test(`S6 [${kind}] logout of Anna with a change in the queue and no network: store, queue, cursors and vault empty, no cycle afterwards; Luca then sees nothing of Anna`, async () => {
    const t = await setup(kind);
    const { server, vault, session, engine, timers, appState } = t;
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    const latte = await engine.enqueue(t.checkItemMutation(check(LATTE)));
    server.down = true;
    await session.signOut();
    expect(await dumpOf(t.store)).toEqual({ rows: [], queue: [], cursors: {} });
    expect(vault.value).toBeNull();
    const sent = server.fetches.length;
    await timers.advance(3 * MINUTE);
    appState.emit('background');
    appState.emit('active');
    await settle();
    expect(server.fetches.length, 'no request after the logout').toBe(sent);

    server.down = false;
    expect(await session.signIn(LUCA, DEMO_PASSWORD)).toBe('ok');
    await settle();
    expect(server.receivedMutationIds()).not.toContain(latte.mutationId);
    expect(await engine.rows(BIANCHI_VERDI)).toEqual([]);
    expect((await engine.rows(ROSSI)).find((r) => r.id === LATTE)?.data.checked).toBe(false);
    for (const f of server.fetches.slice(sent)) {
      if (f.url.endsWith('/api/auth/login')) continue;
      expect(f.headers.authorization, f.url).toBe('Bearer tok-luca-demo');
    }
  });
}

test.describe('giro 026 — logout that cannot reach the server (S6b, S6c)', () => {
  test('S6b the network never answers: signOut() resolves without moving the clock, everything local is cleared, the server logout was attempted with Anna’s token', async () => {
    const { server, vault, session, timers, store } = await setup();
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    server.hang = true;
    let done = false;
    const out = session.signOut().then(() => (done = true));
    await settle();
    expect(done, 'signOut() does not wait for the server').toBe(true);
    expect(vault.value).toBeNull();
    expect(await dumpOf(store)).toEqual({ rows: [], queue: [], cursors: {} });
    const logoutCall = server.fetches.find((f) => f.url === `${FAKE_BASE_URL}/api/auth/logout`);
    expect(logoutCall?.headers.authorization).toBe('Bearer tok-anna-demo');
    await timers.advance(TIMEOUT_MS);
    await out;
  });

  test('S6c logout with a cycle held on /changes: signOut() resolves within 5 s; when the answer finally arrives nothing is written back', async () => {
    const { server, vault, session, timers, store } = await setup();
    remembered(server, vault, ANNA);
    await session.start();
    await settle();
    const release = server.hold(isChangesOf(ROSSI));
    session.afterWrite();
    await settle();
    expect(server.fetches.some(isChangesOf(ROSSI)), 'the cycle is waiting on /changes').toBe(true);
    let done = false;
    const out = session.signOut().then(() => (done = true));
    await timers.advance(SIGN_OUT_WAIT_MS);
    expect(done, 'signOut() waits at most 5 s for the cycle').toBe(true);
    await out;
    expect(vault.value).toBeNull();
    expect(await dumpOf(store)).toEqual({ rows: [], queue: [], cursors: {} });
    server.renameTask(SPESA_SABATO, 'Spesa sabato e domenica');
    release();
    await settle();
    await timers.advance(TIMEOUT_MS);
    expect(await dumpOf(store), 'the late answer is discarded').toEqual({
      rows: [],
      queue: [],
      cursors: {},
    });
  });
});

test.describe('giro 026 — the Http adapter of the token session', () => {
  test('H1 a request that never answers is aborted after the timeout: the cycle ends "offline"', async () => {
    const { server, vault, engine, timers } = await setup();
    remembered(server, vault, ANNA);
    server.hang = true;
    let result: SyncResult | undefined;
    const pending = engine.sync().then((r) => (result = r));
    await settle();
    expect(result, 'still waiting before the timeout').toBeUndefined();
    await timers.advance(TIMEOUT_MS);
    await pending;
    expect(result?.status).toBe('offline');
    expect(server.fetches[0]?.signal?.aborted, 'the fetch was aborted').toBe(true);
  });

  test('H2 a 502 with an HTML body is an answer, not a missing network: the cycle ends "retry"', async () => {
    const { server, vault, engine, net } = await setup();
    remembered(server, vault, ANNA);
    net.fetch = async (input, init) => {
      if (input === `${FAKE_BASE_URL}/api/families`) {
        server.fetches.push({
          url: input,
          method: 'GET',
          headers: {},
          credentials: init?.credentials,
          body: undefined,
          signal: undefined,
        });
        return new Response('<html><body>502 Bad Gateway</body></html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        });
      }
      return server.fetch(input, init);
    };
    expect((await engine.sync()).status).toBe('retry');
  });
});
