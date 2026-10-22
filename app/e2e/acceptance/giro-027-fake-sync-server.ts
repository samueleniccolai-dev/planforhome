// Round 027, T9 part 4: a fake sync server for the task commands that go through the queue on
// Android. It is a trimmed copy of the round 026 fake (that file is not touched): only the `Http`
// transport handed to the engine (no fetch, no tokens), plus the task writes of TaskService:
// - POST /api/families/{f}/tasks { id, mutationId, title, dueKind?, due?, template? } → 201
//   (a MEMBER may not create a task assigned to someone else: 403);
// - PUT  …/tasks/{t}/assignee { mutationId, assigneePersonId } (MEMBER: only the rules of
//   memberMayAssign, else 403; P4);
// - POST …/tasks/{t}/take { mutationId } (409 `already_taken` with assigneePersonId and
//   assigneeName when someone else has it);
// - POST …/tasks/{t}/done { mutationId } (409 `not_open`);
// - POST …/tasks/{t}/forward { mutationId, toFamilyId } (403 when a MEMBER forwards a task that is
//   not hers; 404 when she is not in the target family; DELETE in the source family, UPSERT in
//   the target one);
// - a replayed `mutationId` answers 200 with the current state, like TaskService.replay;
// - the snapshot carries `members`; task data has the shape of SyncService.task (dueKind, dueAt,
//   criticality, createdBy, completedBy, …). A DATE due is stored as midnight of that day in
//   Europe/Rome, like TaskService.dueAt.
// It also exports `openNodeSqlDatabase()` on Node's built-in `node:sqlite`, as in round 026.
// Demo data (invented): families «Rossi» and «Bianchi-Verdi»; Anna (manager of Rossi, member of
// Bianchi-Verdi), Luca Rossi (member of Rossi), Marco Verdi (manager of Bianchi-Verdi, author of
// «Portare il cane dal veterinario»).

export type HttpRequest = { method: 'GET' | 'POST' | 'PUT'; path: string; body?: unknown };
export type HttpResponse = { status: number; body: unknown };

export const ROSSI = '0192f0a0-0000-7000-8000-0000000000f1';
export const BIANCHI_VERDI = '0192f0a0-0000-7000-8000-0000000000f2';
export const ANNA = 'anna@demo.test';
export const LUCA = 'luca@demo.test';
export const MARCO = 'marco@demo.test';

export const SPESA_SABATO = '0192f0a0-0000-7000-8000-000000000101';
export const BOLLETTA = '0192f0a0-0000-7000-8000-000000000102';
export const VETERINARIO = '0192f0a0-0000-7000-8000-000000000103';
export const LAMPADINE = '0192f0a0-0000-7000-8000-000000000104';
export const LATTE = '0192f0a0-0000-7000-8000-000000000201';
export const PANE = '0192f0a0-0000-7000-8000-000000000202';
export const UOVA = '0192f0a0-0000-7000-8000-000000000203';

export const ZONE = 'Europe/Rome';

export const PEOPLE: Record<string, { personId: string; displayName: string }> = {
  [ANNA]: { personId: '0192f0a0-0000-7000-8000-0000000000a1', displayName: 'Anna' },
  [LUCA]: { personId: '0192f0a0-0000-7000-8000-0000000000a2', displayName: 'Luca Rossi' },
  [MARCO]: { personId: '0192f0a0-0000-7000-8000-0000000000a3', displayName: 'Marco Verdi' },
};

const userOf = (personId: string) =>
  Object.keys(PEOPLE).find((u) => PEOPLE[u].personId === personId);

type Role = 'MANAGER' | 'MEMBER';
type FamilyRec = { id: string; name: string; members: Map<string, Role> };
type TaskRec = {
  id: string;
  familyId: string;
  title: string;
  dueKind: 'DATE' | 'DATETIME' | null;
  dueAt: string | null;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  assigneePersonId: string | null;
  createdBy: string;
  completedBy: string | null;
  template: 'NONE' | 'SHOPPING_LIST';
  version: number;
};
type ItemRec = {
  id: string;
  taskId: string;
  text: string;
  checked: boolean;
  position: number;
  version: number;
};
type LogRow = {
  seq: number;
  familyId: string;
  entity: 'task' | 'shopping_item';
  entityId: string;
  op: 'UPSERT' | 'DELETE';
};

/** One applied write (not a replay), in the order the server applied it. */
export type Applied = { mutationId: string; method: string; path: string; body: unknown };

export class NetworkError extends Error {
  constructor() {
    super('network down (fake)');
  }
}

/** Midnight of `day` (yyyy-MM-dd) in Europe/Rome, as an ISO instant (TaskService.dueAt). */
export function romeMidnight(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  for (const offsetHours of [1, 2]) {
    const at = new Date(Date.UTC(y, m - 1, d, -offsetHours));
    const hour = new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONE,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(at);
    if (Number(hour) === 0) return at.toISOString().replace('.000Z', 'Z');
  }
  throw new Error(`no midnight for ${day}`);
}

export class FakeSyncServer {
  user: string = ANNA;
  /** The phone has no network: every request rejects. */
  down = false;
  readonly families = new Map<string, FamilyRec>();
  readonly tasks = new Map<string, TaskRec>();
  readonly items = new Map<string, ItemRec>();
  readonly log: LogRow[] = [];
  /** Every request received, with the user who sent it (bodies copied as sent). */
  readonly requests: (HttpRequest & { user: string })[] = [];
  readonly applied: Applied[] = [];
  /** mutationId → `METHOD path` of the write that applied it. */
  private readonly done = new Map<string, string>();
  private seq = 0;

  constructor() {
    this.families.set(ROSSI, {
      id: ROSSI,
      name: 'Rossi',
      members: new Map<string, Role>([
        [ANNA, 'MANAGER'],
        [LUCA, 'MEMBER'],
      ]),
    });
    this.families.set(BIANCHI_VERDI, {
      id: BIANCHI_VERDI,
      name: 'Bianchi-Verdi',
      members: new Map<string, Role>([
        [MARCO, 'MANAGER'],
        [ANNA, 'MEMBER'],
      ]),
    });
    this.addTask(SPESA_SABATO, ROSSI, 'Spesa sabato', ANNA, 'SHOPPING_LIST');
    this.addItem(LATTE, SPESA_SABATO, 'latte', 1);
    this.addItem(PANE, SPESA_SABATO, 'pane', 2);
    this.addItem(UOVA, SPESA_SABATO, 'uova', 3);
    this.addTask(BOLLETTA, ROSSI, 'Pagare la bolletta della luce', ANNA, 'NONE');
    this.addTask(VETERINARIO, BIANCHI_VERDI, 'Portare il cane dal veterinario', MARCO, 'NONE');
  }

  /** The transport handed to the engine (as `user`): rejects while `down`. */
  readonly http = async (request: HttpRequest): Promise<HttpResponse> => {
    if (this.down) throw new NetworkError();
    this.requests.push({ ...structuredClone(request), user: this.user });
    return structuredClone(this.handle(request));
  };

  /** The same transport, for another person (each person has her own engine). */
  httpAs(user: string) {
    return async (request: HttpRequest): Promise<HttpResponse> => {
      const before = this.user;
      this.user = user;
      try {
        return await this.http(request);
      } finally {
        this.user = before;
      }
    };
  }

  /** Mutation ids received (replays included), in order. */
  receivedMutationIds(): string[] {
    return this.requests
      .map((r) => (r.body as { mutationId?: string } | undefined)?.mutationId)
      .filter((id): id is string => typeof id === 'string');
  }

  currentSeq(familyId: string): number {
    return this.log.filter((r) => r.familyId === familyId).reduce((m, r) => Math.max(m, r.seq), 0);
  }

  /** The snapshot the server would send now (to compare with the local rows). */
  snapshotOf(familyId: string) {
    return structuredClone(this.snapshot(familyId));
  }

  // --- what other people do on the server, outside the engine under test ---

  /** `user` takes the task online, from another device. */
  takeAs(user: string, taskId: string): void {
    const task = this.tasks.get(taskId)!;
    task.assigneePersonId = PEOPLE[user].personId;
    task.version++;
    this.write(task.familyId, 'task', taskId, 'UPSERT');
  }

  setRole(familyId: string, user: string, role: Role): void {
    this.families.get(familyId)!.members.set(user, role);
  }

  removeMember(familyId: string, user: string): void {
    this.families.get(familyId)!.members.delete(user);
  }

  /** A task seen by the server, with a due (for the date cases). */
  addDatedTask(
    id: string,
    familyId: string,
    title: string,
    dueKind: 'DATE' | 'DATETIME',
    due: string,
  ): void {
    this.addTask(id, familyId, title, ANNA, 'NONE');
    const task = this.tasks.get(id)!;
    task.dueKind = dueKind;
    task.dueAt = dueKind === 'DATE' ? romeMidnight(due) : due;
  }

  // --- internals ---

  private addTask(
    id: string,
    familyId: string,
    title: string,
    author: string,
    template: TaskRec['template'],
  ) {
    this.tasks.set(id, {
      id,
      familyId,
      title,
      dueKind: null,
      dueAt: null,
      status: 'OPEN',
      assigneePersonId: null,
      createdBy: PEOPLE[author].personId,
      completedBy: null,
      template,
      version: 1,
    });
    this.write(familyId, 'task', id, 'UPSERT');
  }

  private addItem(id: string, taskId: string, text: string, position: number): void {
    this.items.set(id, { id, taskId, text, checked: false, position, version: 1 });
    this.write(this.tasks.get(taskId)!.familyId, 'shopping_item', id, 'UPSERT');
  }

  private write(familyId: string, entity: LogRow['entity'], entityId: string, op: LogRow['op']) {
    this.log.push({ seq: ++this.seq, familyId, entity, entityId, op });
  }

  private roleIn(familyId: string, user: string | undefined): Role | undefined {
    return user === undefined ? undefined : this.families.get(familyId)?.members.get(user);
  }

  private me(): string {
    return PEOPLE[this.user].personId;
  }

  private taskData(task: TaskRec) {
    return {
      id: task.id,
      familyId: task.familyId,
      title: task.title,
      notes: null,
      dueKind: task.dueKind,
      dueAt: task.dueAt,
      criticality: 'NORMAL',
      status: task.status,
      assigneePersonId: task.assigneePersonId,
      createdBy: task.createdBy,
      completedBy: task.completedBy,
      version: task.version,
      updatedAt: '2026-10-22T08:00:00Z',
      template: task.template,
    };
  }

  private itemData(item: ItemRec) {
    return {
      id: item.id,
      taskId: item.taskId,
      text: item.text,
      checked: item.checked,
      position: item.position,
      version: item.version,
      removedBy: null,
      updatedAt: '2026-10-22T08:00:00Z',
    };
  }

  private listFamilies() {
    const mine = [...this.families.values()].filter((f) => f.members.has(this.user));
    mine.sort((a, b) => a.name.localeCompare(b.name));
    return mine.map((f) => ({
      id: f.id,
      name: f.name,
      timeZone: ZONE,
      role: f.members.get(this.user),
    }));
  }

  private handle(request: HttpRequest): HttpResponse {
    const notFound = { status: 404, body: { error: 'not_found' } };
    const url = new URL(request.path, 'http://fake.test');
    const parts = url.pathname.split('/').filter(Boolean);
    if (request.method === 'GET' && url.pathname === '/api/families') {
      return { status: 200, body: this.listFamilies() };
    }
    if (request.method === 'GET' && parts[1] === 'sync' && parts[2] === 'families') {
      const familyId = parts[3];
      if (!this.roleIn(familyId, this.user)) return notFound;
      if (parts[4] === 'snapshot') return { status: 200, body: this.snapshot(familyId) };
      if (parts[4] === 'changes') {
        const after = Number(url.searchParams.get('after') ?? '0');
        return { status: 200, body: this.changes(familyId, after) };
      }
      return notFound;
    }
    if (parts[1] === 'families' && parts[3] === 'tasks' && request.method !== 'GET') {
      return this.taskWrite(request, url.pathname, parts);
    }
    return notFound;
  }

  private taskWrite(request: HttpRequest, pathname: string, parts: string[]): HttpResponse {
    const notFound = { status: 404, body: { error: 'not_found' } };
    const forbidden = { status: 403, body: { error: 'forbidden' } };
    const familyId = parts[2];
    const role = this.roleIn(familyId, this.user);
    if (!role) return notFound;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const mutationId = body.mutationId;
    if (typeof mutationId !== 'string') return { status: 400, body: { error: 'invalid_request' } };
    const route = `${request.method} ${pathname}`;
    const me = this.me();

    if (request.method === 'POST' && parts.length === 4) {
      if (this.done.has(mutationId)) {
        const same = this.tasks.get(body.id as string);
        return same ? { status: 200, body: this.taskData(same) } : notFound;
      }
      if (typeof body.id !== 'string' || typeof body.title !== 'string' || !body.title.trim()) {
        return { status: 400, body: { error: 'invalid_request' } };
      }
      const assignee = (body.assigneePersonId as string | undefined) ?? null;
      if (role === 'MEMBER' && assignee !== null && assignee !== me) return forbidden;
      const dueKind = (body.dueKind as TaskRec['dueKind'] | undefined) ?? null;
      const due = (body.due as string | undefined) ?? null;
      this.tasks.set(body.id, {
        id: body.id,
        familyId,
        title: body.title.trim(),
        dueKind: due === null ? null : dueKind,
        dueAt: due === null ? null : dueKind === 'DATE' ? romeMidnight(due) : due,
        status: 'OPEN',
        assigneePersonId: assignee,
        createdBy: me,
        completedBy: null,
        template: body.template === 'SHOPPING_LIST' ? 'SHOPPING_LIST' : 'NONE',
        version: 1,
      });
      this.write(familyId, 'task', body.id, 'UPSERT');
      const created = this.apply(request, route, mutationId, this.tasks.get(body.id)!);
      return { ...created, status: 201 };
    }

    const task = this.tasks.get(parts[4]);
    if (this.done.has(mutationId)) {
      if (this.done.get(mutationId) !== route) {
        return { status: 409, body: { error: 'mutation_conflict' } };
      }
      return task ? { status: 200, body: this.taskData(task) } : notFound;
    }
    if (!task || task.familyId !== familyId) return notFound;
    const action = parts[5];
    const own = task.createdBy === me;

    if (request.method === 'PUT' && parts.length === 6 && action === 'assignee') {
      if (task.status !== 'OPEN') return { status: 409, body: { error: 'not_open' } };
      const destination = (body.assigneePersonId as string | null | undefined) ?? null;
      if (destination !== null && !this.roleIn(familyId, userOf(destination))) {
        return { status: 400, body: { error: 'assignee_invalid' } };
      }
      if (role === 'MEMBER') {
        const mine = task.assigneePersonId === me;
        const allowed =
          destination === null
            ? mine
            : destination === me && (mine || (task.assigneePersonId === null && own));
        if (!allowed) return forbidden;
      }
      task.assigneePersonId = destination;
      return this.changed(request, route, mutationId, task);
    }
    if (request.method === 'POST' && parts.length === 6 && action === 'take') {
      if (task.status !== 'OPEN') return { status: 409, body: { error: 'not_open' } };
      if (task.assigneePersonId === me) return { status: 200, body: this.taskData(task) };
      if (task.assigneePersonId !== null) {
        const holder = userOf(task.assigneePersonId);
        return {
          status: 409,
          body: {
            error: 'already_taken',
            assigneePersonId: task.assigneePersonId,
            assigneeName: holder ? PEOPLE[holder].displayName : null,
          },
        };
      }
      task.assigneePersonId = me;
      return this.changed(request, route, mutationId, task);
    }
    if (request.method === 'POST' && parts.length === 6 && action === 'done') {
      if (task.status !== 'OPEN') return { status: 409, body: { error: 'not_open' } };
      task.status = 'DONE';
      task.completedBy = me;
      return this.changed(request, route, mutationId, task);
    }
    if (request.method === 'POST' && parts.length === 6 && action === 'forward') {
      const to = body.toFamilyId;
      if (typeof to !== 'string') return { status: 400, body: { error: 'invalid_request' } };
      if (!this.roleIn(to, this.user)) return notFound;
      if (to === familyId) return { status: 400, body: { error: 'same_family' } };
      if (role !== 'MANAGER' && !own) return forbidden;
      if (task.status !== 'OPEN') return { status: 409, body: { error: 'not_open' } };
      const previous = task.assigneePersonId;
      const kept = previous !== null && this.roleIn(to, userOf(previous)) !== undefined;
      task.familyId = to;
      task.assigneePersonId = kept ? previous : null;
      task.version++;
      this.write(familyId, 'task', task.id, 'DELETE');
      this.write(to, 'task', task.id, 'UPSERT');
      for (const item of this.items.values()) {
        if (item.taskId === task.id) this.write(to, 'shopping_item', item.id, 'UPSERT');
      }
      return this.apply(request, route, mutationId, task);
    }
    return notFound;
  }

  private changed(
    request: HttpRequest,
    route: string,
    mutationId: string,
    task: TaskRec,
  ): HttpResponse {
    task.version++;
    this.write(task.familyId, 'task', task.id, 'UPSERT');
    return this.apply(request, route, mutationId, task);
  }

  private apply(
    request: HttpRequest,
    route: string,
    mutationId: string,
    task: TaskRec,
  ): HttpResponse {
    this.done.set(mutationId, route);
    this.applied.push({
      mutationId,
      method: request.method,
      path: request.path,
      body: structuredClone(request.body),
    });
    return { status: 200, body: this.taskData(task) };
  }

  private snapshot(familyId: string) {
    const tasks = [...this.tasks.values()].filter((t) => t.familyId === familyId);
    const ids = new Set(tasks.map((t) => t.id));
    const family = this.families.get(familyId)!;
    return {
      familyId,
      seq: this.currentSeq(familyId),
      tasks: tasks.map((t) => this.taskData(t)),
      shoppingItems: [...this.items.values()]
        .filter((i) => ids.has(i.taskId))
        .map((i) => this.itemData(i)),
      members: [...family.members.entries()].map(([user, role]) => ({ ...PEOPLE[user], role })),
    };
  }

  private changes(familyId: string, after: number) {
    const raw = this.log.filter((r) => r.familyId === familyId && r.seq > after);
    const lastSeq = raw.length ? raw[raw.length - 1].seq : after;
    const latest = new Map<string, LogRow>();
    for (const row of raw) latest.set(`${row.entity}:${row.entityId}`, row);
    const changes = [...latest.values()]
      .sort((a, b) => a.seq - b.seq)
      .map((row) => {
        const head = { seq: row.seq, entity: row.entity, entityId: row.entityId };
        const gone = { ...head, op: 'DELETE', data: null, deletedAt: '2026-10-22T08:00:00Z' };
        if (row.op === 'DELETE') return gone;
        if (row.entity === 'task') {
          const task = this.tasks.get(row.entityId);
          if (!task || task.familyId !== familyId) return gone;
          return { ...head, op: 'UPSERT', data: this.taskData(task), deletedAt: null };
        }
        const item = this.items.get(row.entityId);
        const task = item && this.tasks.get(item.taskId);
        if (!item || !task || task.familyId !== familyId) return gone;
        return { ...head, op: 'UPSERT', data: this.itemData(item), deletedAt: null };
      });
    return { changes, lastSeq, hasMore: false };
  }
}

// --- `SqlDatabase` (docs/lab/giri/025-piano.md) on node:sqlite, for the SQLite variant ---

type SqlParam = string | number | null;
export type SqlDatabase = {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlParam[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqlParam[]): Promise<T | null>;
  withExclusiveTransactionAsync(fn: (txn: SqlDatabase) => Promise<void>): Promise<void>;
};

type NodeStatement = {
  run(...params: SqlParam[]): unknown;
  all(...params: SqlParam[]): unknown[];
  get(...params: SqlParam[]): unknown;
};
type NodeDatabase = { exec(sql: string): void; prepare(sql: string): NodeStatement };

/** A fresh in-memory database. `node:sqlite` is loaded at run time (Node ≥ 22.5, no npm package). */
export async function openNodeSqlDatabase(): Promise<SqlDatabase> {
  const moduleName = 'node:sqlite';
  const sqlite = (await import(moduleName)) as {
    DatabaseSync: new (path: string) => NodeDatabase;
  };
  const raw = new sqlite.DatabaseSync(':memory:');
  const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;
  const db: SqlDatabase = {
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, ...params) {
      return raw.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, ...params: SqlParam[]) {
      return raw
        .prepare(sql)
        .all(...params)
        .map((r) => plain<T>(r));
    },
    async getFirstAsync<T>(sql: string, ...params: SqlParam[]) {
      const row = raw.prepare(sql).get(...params);
      return row === undefined ? null : plain<T>(row);
    },
    async withExclusiveTransactionAsync(fn) {
      raw.exec('BEGIN EXCLUSIVE');
      try {
        await fn(db);
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db;
}
