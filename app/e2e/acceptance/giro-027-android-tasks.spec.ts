import { expect, test } from '@playwright/test';

import {
  ANNA,
  BIANCHI_VERDI,
  BOLLETTA,
  FakeSyncServer,
  LAMPADINE,
  LUCA,
  MARCO,
  PEOPLE,
  ROSSI,
  SPESA_SABATO,
  VETERINARIO,
  ZONE,
  openNodeSqlDatabase,
  romeMidnight,
  type HttpRequest,
  type HttpResponse,
  type SqlDatabase,
} from './giro-027-fake-sync-server';

// Round 027, T9 part 4: tasks on Android through the queue, with a discreet notice
// (docs/lab/giri/027-piano.md, «Contratti per i test»). Node only, no page: the engine talks to a
// fake server through its `Http`; memory store and SQLite on node:sqlite. Production modules are
// loaded at run time, so that this file compiles before they exist; they must not import
// react-native or expo modules at load time.

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
  /** Path of the change that was refused (round 027). */
  path: string;
  /** Body of the answer, kept on a 409 (round 027). */
  detail?: Record<string, unknown>;
};
type SyncResult = { status: 'ok' | 'offline' | 'unauthorized' | 'retry'; notices: SyncNotice[] };
type LocalStore = { getQueue(): Promise<QueuedMutation[]> };
type Http = (request: HttpRequest) => Promise<HttpResponse>;
type Role = 'MANAGER' | 'MEMBER';
type FamilyEntry = { id: string; name: string; timeZone: string; role: Role };
type Member = { personId: string; displayName: string; role: Role };
type Directory = { family?: FamilyEntry; members: Member[] };
type SyncEngine = {
  enqueue(input: MutationInput): Promise<QueuedMutation>;
  sync(): Promise<SyncResult>;
  rows(familyId: string): Promise<LocalRow[]>;
  directory(familyId: string): Promise<Directory>;
  families(): Promise<FamilyEntry[]>;
};
/** The `Task` of src/api/client.ts, as far as these tests look at it. */
type Task = {
  id: string;
  familyId: string;
  familyTimeZone: string;
  title: string;
  dueKind: 'DATE' | 'DATETIME' | null;
  due: string | null;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  assigneePersonId: string | null;
  completedBy: string | null;
};
type Queued = {
  createTaskMutation(input: {
    familyId: string;
    taskId: string;
    me: string;
    title: string;
    dueKind?: 'DATE' | 'DATETIME';
    due?: string;
  }): MutationInput;
  assignTaskMutation(input: {
    familyId: string;
    taskId: string;
    assigneePersonId: string | null;
  }): MutationInput;
  takeTaskMutation(input: { familyId: string; taskId: string; me: string }): MutationInput;
  completeTaskMutation(input: { familyId: string; taskId: string; me: string }): MutationInput;
  forwardTaskMutation(input: {
    familyId: string;
    taskId: string;
    toFamilyId: string;
  }): MutationInput;
};
type Offline = {
  tasksFromRows(rows: LocalRow[], directory: Directory): Task[];
  taskNotice(
    notice: SyncNotice,
    members: Member[],
  ): { key: string; params?: Record<string, string> } | undefined;
};

const ANNA_ID = PEOPLE[ANNA].personId;
const LUCA_ID = PEOPLE[LUCA].personId;
const MARCO_ID = PEOPLE[MARCO].personId;
const UNKNOWN_TASK = '0192f0a0-0000-7000-8000-000000000199';
const tasksPath = (familyId: string) => `/api/families/${familyId}/tasks`;

const STORES = ['memory', 'sqlite'] as const;
type StoreKind = (typeof STORES)[number];

async function importOrUndefined(path: string) {
  return import(path).catch(() => undefined);
}

async function loadModules() {
  const engine = await importOrUndefined('../../src/sync/engine');
  expect(engine?.createSyncEngine, 'src/sync/engine.ts exports createSyncEngine').toBeInstanceOf(
    Function,
  );
  const queued = await importOrUndefined('../../src/task/queued');
  for (const name of [
    'createTaskMutation',
    'assignTaskMutation',
    'takeTaskMutation',
    'completeTaskMutation',
    'forwardTaskMutation',
  ]) {
    expect(queued?.[name], `src/task/queued.ts exports ${name}`).toBeInstanceOf(Function);
  }
  const offline = await importOrUndefined('../../src/task/offline');
  expect(offline?.tasksFromRows, 'src/task/offline.ts exports tasksFromRows').toBeInstanceOf(
    Function,
  );
  expect(offline?.taskNotice, 'src/task/offline.ts exports taskNotice').toBeInstanceOf(Function);
  const memory = await importOrUndefined('../../src/sync/memoryStore');
  const sql = await importOrUndefined('../../src/sync/sqlStore');
  return {
    createSyncEngine: engine.createSyncEngine as (o: {
      store: LocalStore;
      http: Http;
    }) => SyncEngine,
    queued: queued as Queued,
    offline: offline as Offline,
    memoryStore: () => memory.createMemoryStore() as LocalStore,
    sqlStore: (db: SqlDatabase) => sql.createSqlStore(db) as Promise<LocalStore>,
  };
}

/** Anna's phone (or `user`'s), after a first online cycle. */
async function setup(kind: StoreKind = 'memory', user: string = ANNA) {
  const mods = await loadModules();
  const server = new FakeSyncServer();
  const db = kind === 'sqlite' ? await openNodeSqlDatabase() : undefined;
  const store = db ? await mods.sqlStore(db) : mods.memoryStore();
  const engine = mods.createSyncEngine({ store, http: server.httpAs(user) });
  expect((await engine.sync()).status, 'first cycle online').toBe('ok');
  const tasks = async (familyId: string) =>
    mods.offline.tasksFromRows(await engine.rows(familyId), await engine.directory(familyId));
  const task = async (familyId: string, id: string) =>
    (await tasks(familyId)).find((t) => t.id === id);
  return { ...mods, server, db, store, engine, tasks, task };
}

const pick = (m: Member) => ({ personId: m.personId, displayName: m.displayName, role: m.role });
const byName = (a: { displayName: string }, b: { displayName: string }) =>
  a.displayName.localeCompare(b.displayName);
const familyFields = (f: FamilyEntry) => ({
  id: f.id,
  name: f.name,
  timeZone: f.timeZone,
  role: f.role,
});

async function membersOf(engine: SyncEngine, familyId: string) {
  return (await engine.directory(familyId)).members.map(pick).sort(byName);
}

const ROSSI_MEMBERS = [
  { personId: ANNA_ID, displayName: 'Anna', role: 'MANAGER' },
  { personId: LUCA_ID, displayName: 'Luca Rossi', role: 'MEMBER' },
];
const BIANCHI_VERDI_MEMBERS = [
  { personId: ANNA_ID, displayName: 'Anna', role: 'MEMBER' },
  { personId: MARCO_ID, displayName: 'Marco Verdi', role: 'MANAGER' },
];
const ROSSI_ENTRY = { id: ROSSI, name: 'Rossi', timeZone: ZONE, role: 'MANAGER' };
const BIANCHI_VERDI_ENTRY = {
  id: BIANCHI_VERDI,
  name: 'Bianchi-Verdi',
  timeZone: ZONE,
  role: 'MEMBER',
};

test.describe('giro 027 — the local directory (R1)', () => {
  test('R1 after Anna’s first cycle: directory and families() of both families, with the same person in both', async () => {
    const { engine } = await setup();
    const rossi = await engine.directory(ROSSI);
    expect(rossi.family && familyFields(rossi.family)).toEqual(ROSSI_ENTRY);
    expect(await membersOf(engine, ROSSI)).toEqual(ROSSI_MEMBERS);
    const bv = await engine.directory(BIANCHI_VERDI);
    expect(bv.family && familyFields(bv.family)).toEqual(BIANCHI_VERDI_ENTRY);
    expect(
      await membersOf(engine, BIANCHI_VERDI),
      'Anna is in both families: one member row per family',
    ).toEqual(BIANCHI_VERDI_MEMBERS);
    const families = (await engine.families()).map(familyFields);
    families.sort((a, b) => a.name.localeCompare(b.name));
    expect(families).toEqual([BIANCHI_VERDI_ENTRY, ROSSI_ENTRY]);
  });

  test('R1b SQLite reopened with the network down: directory and families() are still there', async () => {
    const t = await setup('sqlite');
    t.server.down = true;
    const reopened = t.createSyncEngine({
      store: await t.sqlStore(t.db!),
      http: t.server.httpAs(ANNA),
    });
    expect((await reopened.sync()).status).toBe('offline');
    const rossi = await reopened.directory(ROSSI);
    expect(rossi.family && familyFields(rossi.family)).toEqual(ROSSI_ENTRY);
    expect(await membersOf(reopened, ROSSI)).toEqual(ROSSI_MEMBERS);
    expect(await membersOf(reopened, BIANCHI_VERDI)).toEqual(BIANCHI_VERDI_MEMBERS);
    const families = (await reopened.families()).map(familyFields);
    families.sort((a, b) => a.name.localeCompare(b.name));
    expect(families).toEqual([BIANCHI_VERDI_ENTRY, ROSSI_ENTRY]);
  });

  for (const kind of STORES) {
    test(`R1c [${kind}] Anna loses Bianchi-Verdi: its directory is empty, families() has only Rossi, Anna is still in the Rossi directory`, async () => {
      const { server, engine } = await setup(kind);
      server.removeMember(BIANCHI_VERDI, ANNA);
      expect((await engine.sync()).status).toBe('ok');
      const bv = await engine.directory(BIANCHI_VERDI);
      expect(bv.family).toBeUndefined();
      expect(bv.members).toEqual([]);
      expect((await engine.families()).map(familyFields)).toEqual([ROSSI_ENTRY]);
      expect(await membersOf(engine, ROSSI)).toEqual(ROSSI_MEMBERS);
    });
  }

  test('R1d rows() holds only task and shopping_item rows', async () => {
    const { engine } = await setup();
    for (const familyId of [ROSSI, BIANCHI_VERDI]) {
      const rows = await engine.rows(familyId);
      expect(rows.some((r) => r.entity === 'task')).toBe(true);
      for (const row of rows) expect(['task', 'shopping_item'], row.id).toContain(row.entity);
    }
  });
});

test.describe('giro 027 — the five commands (shape of the changes)', () => {
  test('M1 every task change has entity task, entityId and taskId equal to the task, and the paths and bodies of client.ts', async () => {
    const { queued } = await loadModules();
    const create = queued.createTaskMutation({
      familyId: ROSSI,
      taskId: LAMPADINE,
      me: ANNA_ID,
      title: 'Comprare le lampadine',
      dueKind: 'DATE',
      due: '2026-10-24',
    });
    expect(create).toMatchObject({
      familyId: ROSSI,
      entity: 'task',
      entityId: LAMPADINE,
      taskId: LAMPADINE,
      method: 'POST',
      path: tasksPath(ROSSI),
    });
    expect(create.body).toMatchObject({
      id: LAMPADINE,
      title: 'Comprare le lampadine',
      dueKind: 'DATE',
      due: '2026-10-24',
    });
    expect(create.patch).toMatchObject({
      id: LAMPADINE,
      familyId: ROSSI,
      title: 'Comprare le lampadine',
      dueKind: 'DATE',
      due: '2026-10-24',
      status: 'OPEN',
      assigneePersonId: null,
      createdBy: ANNA_ID,
    });
    const cases: [MutationInput, string, 'POST' | 'PUT', Record<string, unknown>][] = [
      [
        queued.assignTaskMutation({
          familyId: ROSSI,
          taskId: SPESA_SABATO,
          assigneePersonId: LUCA_ID,
        }),
        `${tasksPath(ROSSI)}/${SPESA_SABATO}/assignee`,
        'PUT',
        { assigneePersonId: LUCA_ID },
      ],
      [
        queued.takeTaskMutation({ familyId: ROSSI, taskId: BOLLETTA, me: ANNA_ID }),
        `${tasksPath(ROSSI)}/${BOLLETTA}/take`,
        'POST',
        {},
      ],
      [
        queued.completeTaskMutation({ familyId: ROSSI, taskId: BOLLETTA, me: ANNA_ID }),
        `${tasksPath(ROSSI)}/${BOLLETTA}/done`,
        'POST',
        {},
      ],
      [
        queued.forwardTaskMutation({
          familyId: ROSSI,
          taskId: BOLLETTA,
          toFamilyId: BIANCHI_VERDI,
        }),
        `${tasksPath(ROSSI)}/${BOLLETTA}/forward`,
        'POST',
        { toFamilyId: BIANCHI_VERDI },
      ],
    ];
    for (const [m, path, method, body] of cases) {
      expect(m.path).toBe(path);
      expect(m.method, path).toBe(method);
      expect(m.body, path).toEqual(body);
      expect(m.entity, path).toBe('task');
      expect(m.entityId, path).toBe(m.path.split('/')[5]);
      expect(m.taskId, `${path}: taskId = the task (isBlocked)`).toBe(m.entityId);
    }
  });
});

for (const kind of STORES) {
  test(`Q1 [${kind}] offline Anna creates «Comprare le lampadine», takes the bill, assigns «Spesa sabato» to Luca, marks the new task done: seen at once; network back → applied once, in order; rows equal the server`, async () => {
    const t = await setup(kind);
    const { server, engine, queued } = t;
    server.down = true;
    const sent: QueuedMutation[] = [];
    sent.push(
      await engine.enqueue(
        queued.createTaskMutation({
          familyId: ROSSI,
          taskId: LAMPADINE,
          me: ANNA_ID,
          title: 'Comprare le lampadine',
          dueKind: 'DATE',
          due: '2026-10-24',
        }),
      ),
    );
    sent.push(
      await engine.enqueue(
        queued.takeTaskMutation({ familyId: ROSSI, taskId: BOLLETTA, me: ANNA_ID }),
      ),
    );
    sent.push(
      await engine.enqueue(
        queued.assignTaskMutation({
          familyId: ROSSI,
          taskId: SPESA_SABATO,
          assigneePersonId: LUCA_ID,
        }),
      ),
    );
    sent.push(
      await engine.enqueue(
        queued.completeTaskMutation({ familyId: ROSSI, taskId: LAMPADINE, me: ANNA_ID }),
      ),
    );
    expect((await engine.sync()).status).toBe('offline');
    expect(server.applied, 'nothing reaches the server while offline').toHaveLength(0);
    expect(await t.task(ROSSI, LAMPADINE)).toMatchObject({
      familyId: ROSSI,
      familyTimeZone: ZONE,
      title: 'Comprare le lampadine',
      dueKind: 'DATE',
      due: '2026-10-24',
      status: 'DONE',
      completedBy: ANNA_ID,
    });
    expect((await t.task(ROSSI, BOLLETTA))?.assigneePersonId).toBe(ANNA_ID);
    expect((await t.task(ROSSI, SPESA_SABATO))?.assigneePersonId).toBe(LUCA_ID);

    server.down = false;
    expect((await engine.sync()).status).toBe('ok');
    expect(server.applied.map((a) => a.mutationId)).toEqual(sent.map((m) => m.mutationId));
    expect(server.tasks.get(LAMPADINE)).toMatchObject({
      familyId: ROSSI,
      title: 'Comprare le lampadine',
      dueKind: 'DATE',
      dueAt: romeMidnight('2026-10-24'),
      status: 'DONE',
      completedBy: ANNA_ID,
    });
    expect(server.tasks.get(BOLLETTA)?.assigneePersonId).toBe(ANNA_ID);
    expect(server.tasks.get(SPESA_SABATO)?.assigneePersonId).toBe(LUCA_ID);
    expect(await t.store.getQueue()).toEqual([]);

    const received = server.receivedMutationIds().length;
    expect((await engine.sync()).status).toBe('ok');
    expect(server.receivedMutationIds().length, 'the next cycle sends nothing again').toBe(
      received,
    );
    const local = await engine.rows(ROSSI);
    for (const remote of server.snapshotOf(ROSSI).tasks) {
      const row = local.find((r) => r.entity === 'task' && r.id === remote.id);
      expect(row?.data, remote.title).toEqual(remote);
    }
    expect(
      (await t.task(ROSSI, LAMPADINE))?.due,
      'a DATE from the server (midnight in Rome, as an instant) is the day in the family zone',
    ).toBe('2026-10-24');
  });
}

test.describe('giro 027 — answers of the server (Q2–Q4)', () => {
  test('Q2 Anna takes the bill offline, Luca takes it online: conflict with the name, «task.taken» with Luca Rossi, local row assigned to Luca', async () => {
    const t = await setup();
    const { server, engine, queued, offline } = t;
    server.down = true;
    await engine.enqueue(
      queued.takeTaskMutation({ familyId: ROSSI, taskId: BOLLETTA, me: ANNA_ID }),
    );
    expect((await t.task(ROSSI, BOLLETTA))?.assigneePersonId).toBe(ANNA_ID);
    server.takeAs(LUCA, BOLLETTA);
    server.down = false;
    const result = await engine.sync();
    expect(result.status).toBe('ok');
    const notice = result.notices.find((n) => n.entityId === BOLLETTA);
    expect(notice).toMatchObject({
      kind: 'conflict',
      familyId: ROSSI,
      entity: 'task',
      entityId: BOLLETTA,
      path: `${tasksPath(ROSSI)}/${BOLLETTA}/take`,
    });
    expect(notice?.detail).toMatchObject({
      error: 'already_taken',
      assigneePersonId: LUCA_ID,
      assigneeName: 'Luca Rossi',
    });
    const members = (await engine.directory(ROSSI)).members;
    expect(offline.taskNotice(notice!, members)).toEqual({
      key: 'task.taken',
      params: { name: 'Luca Rossi' },
    });
    expect((await t.task(ROSSI, BOLLETTA))?.assigneePersonId).toBe(LUCA_ID);
  });

  test('Q3 Anna forwards the bill offline from Rossi to Bianchi-Verdi: gone at once from Rossi; after the sync it is in Bianchi-Verdi only', async () => {
    const t = await setup();
    const { server, engine, queued } = t;
    server.down = true;
    await engine.enqueue(
      queued.forwardTaskMutation({ familyId: ROSSI, taskId: BOLLETTA, toFamilyId: BIANCHI_VERDI }),
    );
    expect(await t.task(ROSSI, BOLLETTA), 'hidden while the forward waits').toBeUndefined();
    expect(await t.task(BIANCHI_VERDI, BOLLETTA), 'the server decides the arrival').toBeUndefined();
    server.down = false;
    const result = await engine.sync();
    expect(result.status).toBe('ok');
    expect(result.notices).toEqual([]);
    expect(server.tasks.get(BOLLETTA)?.familyId).toBe(BIANCHI_VERDI);
    expect((await engine.rows(ROSSI)).some((r) => r.id === BOLLETTA)).toBe(false);
    expect((await engine.rows(BIANCHI_VERDI)).some((r) => r.id === BOLLETTA)).toBe(true);
    expect(await t.task(BIANCHI_VERDI, BOLLETTA)).toMatchObject({
      familyId: BIANCHI_VERDI,
      familyTimeZone: ZONE,
      title: 'Pagare la bolletta della luce',
    });
  });

  test('Q4 Luca (MEMBER) assigns the bill to Anna offline: 403, «task.forbidden», the local row goes back to the server state', async () => {
    const t = await setup('memory', LUCA);
    const { server, engine, queued, offline } = t;
    server.down = true;
    await engine.enqueue(
      queued.assignTaskMutation({ familyId: ROSSI, taskId: BOLLETTA, assigneePersonId: ANNA_ID }),
    );
    expect((await t.task(ROSSI, BOLLETTA))?.assigneePersonId).toBe(ANNA_ID);
    server.down = false;
    const result = await engine.sync();
    const notice = result.notices.find((n) => n.entityId === BOLLETTA);
    expect(notice).toMatchObject({
      kind: 'forbidden',
      entity: 'task',
      path: `${tasksPath(ROSSI)}/${BOLLETTA}/assignee`,
    });
    expect(offline.taskNotice(notice!, (await engine.directory(ROSSI)).members)).toEqual({
      key: 'task.forbidden',
    });
    expect(server.tasks.get(BOLLETTA)?.assigneePersonId).toBeNull();
    expect((await t.task(ROSSI, BOLLETTA))?.assigneePersonId).toBeNull();
  });

  test('Q4b Anna stops being a manager of Rossi while offline; her assignment to Luca is refused; the row is restored and the directory says MEMBER', async () => {
    const t = await setup();
    const { server, engine, queued, offline } = t;
    expect((await engine.directory(ROSSI)).family?.role).toBe('MANAGER');
    server.down = true;
    await engine.enqueue(
      queued.assignTaskMutation({ familyId: ROSSI, taskId: BOLLETTA, assigneePersonId: LUCA_ID }),
    );
    server.setRole(ROSSI, ANNA, 'MEMBER');
    server.down = false;
    const result = await engine.sync();
    const notice = result.notices.find((n) => n.entityId === BOLLETTA);
    expect(notice?.kind).toBe('forbidden');
    expect(offline.taskNotice(notice!, (await engine.directory(ROSSI)).members)?.key).toBe(
      'task.forbidden',
    );
    expect((await t.task(ROSSI, BOLLETTA))?.assigneePersonId).toBeNull();
    expect((await engine.directory(ROSSI)).family?.role).toBe('MEMBER');
  });

  test('Q4c Anna (MEMBER of Bianchi-Verdi) forwards Marco’s task offline: 403 on the forward, «task.forward.forbidden», the task is back in Bianchi-Verdi', async () => {
    const t = await setup();
    const { server, engine, queued, offline } = t;
    server.down = true;
    await engine.enqueue(
      queued.forwardTaskMutation({
        familyId: BIANCHI_VERDI,
        taskId: VETERINARIO,
        toFamilyId: ROSSI,
      }),
    );
    expect(await t.task(BIANCHI_VERDI, VETERINARIO)).toBeUndefined();
    server.down = false;
    const result = await engine.sync();
    const notice = result.notices.find((n) => n.entityId === VETERINARIO);
    expect(notice).toMatchObject({
      kind: 'forbidden',
      familyId: BIANCHI_VERDI,
      path: `${tasksPath(BIANCHI_VERDI)}/${VETERINARIO}/forward`,
    });
    expect(offline.taskNotice(notice!, (await engine.directory(BIANCHI_VERDI)).members)).toEqual({
      key: 'task.forward.forbidden',
    });
    expect(server.tasks.get(VETERINARIO)?.familyId).toBe(BIANCHI_VERDI);
    expect((await t.task(BIANCHI_VERDI, VETERINARIO))?.title).toBe(
      'Portare il cane dal veterinario',
    );
    expect(await t.task(ROSSI, VETERINARIO)).toBeUndefined();
  });

  test('Q6 take, done or forward queued for a task with no local row: no ghost task in the list', async () => {
    const { queued } = await loadModules();
    const commands: [string, MutationInput][] = [
      ['take', queued.takeTaskMutation({ familyId: ROSSI, taskId: UNKNOWN_TASK, me: ANNA_ID })],
      ['done', queued.completeTaskMutation({ familyId: ROSSI, taskId: UNKNOWN_TASK, me: ANNA_ID })],
      [
        'forward',
        queued.forwardTaskMutation({
          familyId: ROSSI,
          taskId: UNKNOWN_TASK,
          toFamilyId: BIANCHI_VERDI,
        }),
      ],
    ];
    for (const [name, command] of commands) {
      // each on a fresh phone, so that a later patch (forwardedTo) cannot hide an earlier ghost
      const t = await setup();
      t.server.down = true;
      await t.engine.enqueue(command);
      const ids = (await t.tasks(ROSSI)).map((x) => x.id);
      expect(ids, `after ${name}`).toEqual([SPESA_SABATO, BOLLETTA].sort());
    }
  });
});

test.describe('giro 027 — pure functions (Q5)', () => {
  const directory: Directory = {
    family: { id: ROSSI, name: 'Rossi', timeZone: ZONE, role: 'MANAGER' },
    members: [
      { personId: ANNA_ID, displayName: 'Anna', role: 'MANAGER' },
      { personId: LUCA_ID, displayName: 'Luca Rossi', role: 'MEMBER' },
    ],
  };
  const taskRow = (id: string, data: Record<string, unknown>): LocalRow => ({
    entity: 'task',
    id,
    familyId: ROSSI,
    taskId: null,
    data: {
      id,
      familyId: ROSSI,
      notes: null,
      dueKind: null,
      dueAt: null,
      criticality: 'NORMAL',
      status: 'OPEN',
      assigneePersonId: null,
      createdBy: ANNA_ID,
      completedBy: null,
      version: 1,
      updatedAt: '2026-10-22T08:00:00Z',
      template: 'NONE',
      ...data,
    },
  });
  const id = (n: number) => `0192f0a0-0000-7000-8000-0000000003${String(n).padStart(2, '0')}`;

  test('Q5 tasksFromRows: due from dueAt in the family zone (DATE on the 25/10/2026 clock change), DATETIME kept, DATE of a queued create, zone from the directory, forwarded and untitled rows out, ordered by id', async () => {
    const { offline } = await loadModules();
    const rows: LocalRow[] = [
      taskRow(id(6), { title: 'Inoltrato in coda', forwardedTo: BIANCHI_VERDI }),
      taskRow(id(5), { status: 'DONE', completedBy: ANNA_ID }),
      {
        entity: 'shopping_item',
        id: id(9),
        familyId: ROSSI,
        taskId: id(1),
        data: { id: id(9), taskId: id(1), text: 'latte' },
      },
      taskRow(id(4), { title: 'Senza scadenza' }),
      {
        entity: 'task',
        id: id(3),
        familyId: ROSSI,
        taskId: id(3),
        data: {
          id: id(3),
          familyId: ROSSI,
          title: 'Creato offline',
          dueKind: 'DATE',
          due: '2026-10-24',
          criticality: 'NORMAL',
          status: 'OPEN',
          assigneePersonId: null,
          createdBy: ANNA_ID,
          template: 'NONE',
          version: 0,
        },
      },
      taskRow(id(2), {
        title: 'Riunione',
        dueKind: 'DATETIME',
        dueAt: '2026-10-25T08:30:00Z',
      }),
      taskRow(id(1), {
        title: 'Cambio dell’ora',
        dueKind: 'DATE',
        dueAt: '2026-10-24T22:00:00Z',
      }),
      taskRow(id(7), { title: 'Dopo il cambio', dueKind: 'DATE', dueAt: '2026-10-25T23:00:00Z' }),
    ];
    const tasks = offline.tasksFromRows(rows, directory);
    expect(tasks.map((x) => x.id)).toEqual([id(1), id(2), id(3), id(4), id(7)]);
    const of = (n: number) => tasks.find((x) => x.id === id(n));
    expect(of(1)).toMatchObject({ dueKind: 'DATE', due: '2026-10-25', familyTimeZone: ZONE });
    expect(of(2)).toMatchObject({ dueKind: 'DATETIME', due: '2026-10-25T08:30:00Z' });
    expect(of(3)).toMatchObject({ dueKind: 'DATE', due: '2026-10-24', title: 'Creato offline' });
    expect(of(4)?.due).toBeNull();
    expect(of(7)).toMatchObject({ dueKind: 'DATE', due: '2026-10-26' });
    for (const x of tasks) {
      expect(x.familyId).toBe(ROSSI);
      expect(x.familyTimeZone).toBe(ZONE);
    }
  });

  test('Q5b taskNotice: names from the directory, then assigneeName, then «?»; changed, stale, forbidden, forward forbidden; shopping notices ignored', async () => {
    const { offline } = await loadModules();
    const base = {
      familyId: ROSSI,
      entity: 'task' as const,
      entityId: BOLLETTA,
      mutationId: '0192f0a0-0000-7000-8000-000000000901',
      path: `${tasksPath(ROSSI)}/${BOLLETTA}/take`,
    };
    const taken = (detail?: Record<string, unknown>): SyncNotice => ({
      ...base,
      kind: 'conflict',
      detail,
    });
    expect(
      offline.taskNotice(
        taken({ error: 'already_taken', assigneePersonId: LUCA_ID, assigneeName: 'L. R.' }),
        directory.members,
      ),
    ).toEqual({ key: 'task.taken', params: { name: 'Luca Rossi' } });
    expect(
      offline.taskNotice(
        taken({ error: 'already_taken', assigneePersonId: MARCO_ID, assigneeName: 'Marco Verdi' }),
        directory.members,
      ),
    ).toEqual({ key: 'task.taken', params: { name: 'Marco Verdi' } });
    expect(offline.taskNotice(taken({ error: 'already_taken' }), [])).toEqual({
      key: 'task.taken',
      params: { name: '?' },
    });
    expect(offline.taskNotice(taken({ error: 'not_open' }), directory.members)).toEqual({
      key: 'task.changed',
    });
    expect(offline.taskNotice(taken(), directory.members)).toEqual({ key: 'task.changed' });
    for (const kind of ['notFound', 'invalid'] as const) {
      expect(offline.taskNotice({ ...base, kind }, directory.members)).toEqual({
        key: 'task.stale',
      });
    }
    expect(
      offline.taskNotice(
        { ...base, kind: 'forbidden', path: `${tasksPath(ROSSI)}/${BOLLETTA}/assignee` },
        directory.members,
      ),
    ).toEqual({ key: 'task.forbidden' });
    expect(
      offline.taskNotice(
        { ...base, kind: 'forbidden', path: `${tasksPath(ROSSI)}/${BOLLETTA}/forward` },
        directory.members,
      ),
    ).toEqual({ key: 'task.forward.forbidden' });
    expect(
      offline.taskNotice(
        {
          ...base,
          kind: 'forbidden',
          entity: 'shopping_item',
          path: `${tasksPath(ROSSI)}/${SPESA_SABATO}/items`,
        },
        directory.members,
      ),
    ).toBeUndefined();
  });
});
