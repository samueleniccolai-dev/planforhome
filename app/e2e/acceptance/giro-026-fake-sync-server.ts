// Round 026, T9: a copy of the fake sync server of round 025 (that file is not touched), with:
// - a `fetch` in front of it, as seen by the Android client: absolute URLs under `FAKE_BASE_URL`,
//   POST /api/auth/login (`client: "android"` → opaque token in the body, like AuthController),
//   POST /api/auth/logout (revokes the token), `Authorization: Bearer` on every other request
//   (unknown or revoked token → 401); `down` (fetch rejects), `hang` (fetch never answers until
//   its signal aborts), `hold()` (a matching request waits until released);
// - POST /api/families/{f}/tasks/{t}/items { id, mutationId, text } → 201 with the item;
// - PUT  …/items/{i}/checked { mutationId, checked } as in round 025.
// The round 025 notes follow. Differences of round 025 from round 024:
// - GET /api/families is ordered by name like the real server (Bianchi-Verdi before Rossi), or in
//   reverse order (`familyOrder = 'reverse'`);
// - a replayed `mutationId` answers 200 with the CURRENT state of the entity, like the real
//   TaskService.replay (not the saved answer); a replay on another route is 409 mutation_conflict;
// - POST /api/families/{f}/tasks/{t}/done { mutationId } (no version in the body);
// - `addMember`, and forwarding in both directions;
// - a fault can answer a given status with a given body (for example Spring's default 404 body,
//   or an empty body).
// It also exports `openNodeSqlDatabase()`: the `SqlDatabase` of docs/lab/giri/025-piano.md on
// Node's built-in `node:sqlite` (no npm package), in memory.
// Demo data (invented): families «Rossi» and «Bianchi-Verdi», anna@demo.test (manager of Rossi,
// member of Bianchi-Verdi), luca@demo.test (member of Rossi).

export type HttpRequest = { method: 'GET' | 'POST' | 'PUT'; path: string; body?: unknown };
export type HttpResponse = { status: number; body: unknown };

export const ROSSI = '0192f0a0-0000-7000-8000-0000000000f1';
export const BIANCHI_VERDI = '0192f0a0-0000-7000-8000-0000000000f2';
export const ANNA = 'anna@demo.test';
export const LUCA = 'luca@demo.test';

export const SPESA_SABATO = '0192f0a0-0000-7000-8000-000000000101';
export const BOLLETTA = '0192f0a0-0000-7000-8000-000000000102';
export const VETERINARIO = '0192f0a0-0000-7000-8000-000000000103';
export const LATTE = '0192f0a0-0000-7000-8000-000000000201';
export const PANE = '0192f0a0-0000-7000-8000-000000000202';
export const UOVA = '0192f0a0-0000-7000-8000-000000000203';

/** The body Spring Boot writes for a 404 of an unmapped path (not the API's `not_found`). */
export const SPRING_NOT_FOUND = {
  timestamp: '2031-03-01T08:00:00.000+00:00',
  status: 404,
  error: 'Not Found',
  path: '/api/sync/families',
};

export const FAKE_BASE_URL = 'https://api.fake.test';
export const DEMO_PASSWORD = 'demo-password-1';

export const PEOPLE: Record<string, { personId: string; displayName: string }> = {
  [ANNA]: { personId: '0192f0a0-0000-7000-8000-0000000000a1', displayName: 'Anna' },
  [LUCA]: { personId: '0192f0a0-0000-7000-8000-0000000000a2', displayName: 'Luca' },
};

type Role = 'MANAGER' | 'MEMBER';
type FamilyRec = { id: string; name: string; members: Map<string, Role> };
type TaskRec = {
  id: string;
  familyId: string;
  title: string;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  assigneePersonId: string | null;
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
  deleted: boolean;
};
type LogRow = {
  seq: number;
  familyId: string;
  entity: 'task' | 'shopping_item';
  entityId: string;
  op: 'UPSERT' | 'DELETE';
};

export type Fault = {
  match: (request: HttpRequest) => boolean;
  /**
   * `network-before`: rejects without applying; `network-after`: applies, then rejects;
   * a number: that status with `{ error: 'fake_<status>' }`; an object: that status and body.
   */
  kind: 'network-before' | 'network-after' | number | HttpResponse;
};

/** One applied write (not a replay), in the order the server applied it. */
export type Applied = { mutationId: string; method: string; path: string; body: unknown };

/** The part of `RequestInit` the Android client uses. */
export type FetchInit = {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | null;
  credentials?: 'omit' | 'same-origin' | 'include';
  signal?: AbortSignal | null;
};

/** One call to the fake `fetch`. */
export type FetchRecord = {
  url: string;
  method: string;
  headers: Record<string, string>;
  credentials: FetchInit['credentials'];
  body: unknown;
  signal: AbortSignal | undefined;
};

/** A JSON answer; a null body for 204. */
export function json(status: number, body: unknown): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export class NetworkError extends Error {
  constructor() {
    super('network down (fake)');
  }
}

export class FakeSyncServer {
  user: string = ANNA;
  pageSize = 500;
  familyOrder: 'name' | 'reverse' = 'name';
  readonly families = new Map<string, FamilyRec>();
  readonly tasks = new Map<string, TaskRec>();
  readonly items = new Map<string, ItemRec>();
  readonly log: LogRow[] = [];
  /** Every request received, with the user who sent it (bodies copied as sent). */
  readonly requests: (HttpRequest & { user: string })[] = [];
  readonly applied: Applied[] = [];
  /** mutationId → `METHOD path` of the write that applied it. */
  private readonly done = new Map<string, string>();
  private faults: Fault[] = [];
  private seq = 0;
  /** Called on each request before the server answers it (to act "during" a sync). */
  onRequest?: (request: HttpRequest) => void;

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
      members: new Map<string, Role>([[ANNA, 'MEMBER']]),
    });
    this.addTask(SPESA_SABATO, ROSSI, 'Spesa sabato', 'SHOPPING_LIST');
    this.addItem(LATTE, SPESA_SABATO, 'latte', 1);
    this.addItem(PANE, SPESA_SABATO, 'pane', 2);
    this.addItem(UOVA, SPESA_SABATO, 'uova', 3);
    this.addTask(BOLLETTA, ROSSI, 'Pagare la bolletta della luce', 'NONE');
    this.addTask(VETERINARIO, BIANCHI_VERDI, 'Portare il cane dal veterinario', 'NONE');
  }

  /** The transport handed to the engine: rejects on a network fault. */
  readonly http = async (request: HttpRequest): Promise<HttpResponse> => {
    this.requests.push({ ...structuredClone(request), user: this.user });
    this.onRequest?.(request);
    const at = this.faults.findIndex((f) => f.match(request));
    const fault = at >= 0 ? this.faults.splice(at, 1)[0] : undefined;
    if (fault?.kind === 'network-before') throw new NetworkError();
    if (typeof fault?.kind === 'number') {
      return { status: fault.kind, body: { error: `fake_${fault.kind}` } };
    }
    if (typeof fault?.kind === 'object') return structuredClone(fault.kind);
    const response = this.handle(request);
    if (fault?.kind === 'network-after') throw new NetworkError();
    return structuredClone(response);
  };

  /** The next request that matches gets the fault, once. */
  failOnce(match: (request: HttpRequest) => boolean, kind: Fault['kind']): void {
    this.faults.push({ match, kind });
  }

  // --- the fetch of the Android client (round 026) ---

  /** fetch rejects at once, like a phone in airplane mode. */
  down = false;
  /** fetch never answers; it rejects only when its `signal` aborts. */
  hang = false;
  /** Every call to `fetch`, as sent (headers lower-cased). */
  readonly fetches: FetchRecord[] = [];
  /** token → user; revoked tokens are removed. */
  readonly tokens = new Map<string, string>();
  private readonly issued = new Map<string, number>();
  private holds: { match: (r: FetchRecord) => boolean; gate: Promise<void> }[] = [];

  /** A live token for `user`, as if a login happened earlier (for a vault filled before start). */
  issueToken(user: string): string {
    const name = user.split('@')[0];
    const n = (this.issued.get(user) ?? 0) + 1;
    this.issued.set(user, n);
    const token = n === 1 ? `tok-${name}-demo` : `tok-${name}-demo-${n}`;
    this.tokens.set(token, user);
    return token;
  }

  /** Revokes every token of `user` (the next request answers 401). */
  revokeTokensOf(user: string): void {
    for (const [token, owner] of [...this.tokens]) if (owner === user) this.tokens.delete(token);
  }

  /** The next matching fetch waits until the returned function is called. */
  hold(match: (r: FetchRecord) => boolean): () => void {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    this.holds.push({ match, gate });
    return release;
  }

  /** Mutation requests that reached the server through fetch with a known token. */
  fetchesWithMutation(): FetchRecord[] {
    return this.fetches.filter(
      (f) => typeof (f.body as { mutationId?: unknown })?.mutationId === 'string',
    );
  }

  readonly fetch = async (input: string, init: FetchInit = {}): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => (headers[key.toLowerCase()] = value));
    const record: FetchRecord = {
      url: String(input),
      method: (init.method ?? 'GET').toUpperCase(),
      headers,
      credentials: init.credentials,
      body: typeof init.body === 'string' && init.body ? JSON.parse(init.body) : undefined,
      signal: init.signal ?? undefined,
    };
    this.fetches.push(record);
    const at = this.holds.findIndex((h) => h.match(record));
    if (at >= 0) await this.holds.splice(at, 1)[0].gate;
    if (this.down) throw new TypeError('Network request failed (fake)');
    if (this.hang) {
      return new Promise<Response>((_, reject) => {
        const abort = () => reject(new DOMException('aborted (fake)', 'AbortError'));
        if (record.signal?.aborted) abort();
        record.signal?.addEventListener('abort', abort);
      });
    }
    if (!record.url.startsWith(`${FAKE_BASE_URL}/`)) return json(404, { error: 'not_found' });
    const path = record.url.slice(FAKE_BASE_URL.length);
    if (record.method === 'POST' && path === '/api/auth/login') return this.login(record.body);
    const token = /^Bearer (.+)$/.exec(headers.authorization ?? '')?.[1];
    const user = token === undefined ? undefined : this.tokens.get(token);
    if (!user) return json(401, { error: 'unauthorized' });
    if (record.method === 'POST' && path === '/api/auth/logout') {
      this.tokens.delete(token!);
      return new Response(null, { status: 204 });
    }
    this.user = user;
    const method = record.method as HttpRequest['method'];
    const answer = await this.http({ method, path, body: record.body });
    return json(answer.status, answer.body);
  };

  private login(body: unknown): Response {
    const { email, password, client } = (body ?? {}) as Record<string, unknown>;
    const person = typeof email === 'string' ? PEOPLE[email] : undefined;
    if (!person || password !== DEMO_PASSWORD) return json(401, { error: 'invalid_credentials' });
    const expiresAt = '2031-03-31T08:00:00Z';
    if (client === 'web') return json(200, { expiresAt, personId: person.personId });
    return json(200, {
      token: this.issueToken(email as string),
      expiresAt,
      personId: person.personId,
    });
  }

  /** Requests whose path contains `part`. */
  requestsTo(part: string): (HttpRequest & { user: string })[] {
    return this.requests.filter((r) => r.path.includes(part));
  }

  /** Bodies of the writes sent to exactly `path` (replays included), in order. */
  bodiesSentTo(path: string): Record<string, unknown>[] {
    return this.requests
      .filter((r) => r.method !== 'GET' && r.path === path)
      .map((r) => (r.body ?? {}) as Record<string, unknown>);
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

  // --- what other people do on the server, outside the engine under test ---

  renameTask(taskId: string, title: string): void {
    const task = this.tasks.get(taskId)!;
    task.title = title;
    task.version++;
    this.write(task.familyId, 'task', taskId, 'UPSERT');
  }

  setItemText(itemId: string, text: string): void {
    const item = this.items.get(itemId)!;
    item.text = text;
    item.version++;
    this.write(this.tasks.get(item.taskId)!.familyId, 'shopping_item', itemId, 'UPSERT');
  }

  addItem(id: string, taskId: string, text: string, position: number): void {
    this.items.set(id, { id, taskId, text, checked: false, position, version: 1, deleted: false });
    this.write(this.tasks.get(taskId)!.familyId, 'shopping_item', id, 'UPSERT');
  }

  /** Forward, any direction: the source family gets only the DELETE of the task. */
  forwardTask(taskId: string, toFamilyId: string): void {
    const task = this.tasks.get(taskId)!;
    const from = task.familyId;
    task.familyId = toFamilyId;
    task.version++;
    this.write(from, 'task', taskId, 'DELETE');
    this.write(toFamilyId, 'task', taskId, 'UPSERT');
    for (const item of this.items.values()) {
      if (item.taskId === taskId && !item.deleted) {
        this.write(toFamilyId, 'shopping_item', item.id, 'UPSERT');
      }
    }
  }

  addMember(familyId: string, user: string, role: Role = 'MEMBER'): void {
    this.families.get(familyId)!.members.set(user, role);
  }

  removeMember(familyId: string, user: string): void {
    this.families.get(familyId)!.members.delete(user);
  }

  // --- internals ---

  private addTask(id: string, familyId: string, title: string, template: TaskRec['template']) {
    this.tasks.set(id, {
      id,
      familyId,
      title,
      status: 'OPEN',
      assigneePersonId: null,
      template,
      version: 1,
    });
    this.write(familyId, 'task', id, 'UPSERT');
  }

  private write(familyId: string, entity: LogRow['entity'], entityId: string, op: LogRow['op']) {
    this.log.push({ seq: ++this.seq, familyId, entity, entityId, op });
  }

  private isMember(familyId: string): boolean {
    return this.families.get(familyId)?.members.has(this.user) ?? false;
  }

  private taskData(task: TaskRec) {
    return {
      id: task.id,
      version: task.version,
      status: task.status,
      assigneePersonId: task.assigneePersonId,
      title: task.title,
      dueAt: null,
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
    };
  }

  private listFamilies() {
    const mine = [...this.families.values()].filter((f) => f.members.has(this.user));
    mine.sort((a, b) => a.name.localeCompare(b.name));
    if (this.familyOrder === 'reverse') mine.reverse();
    return mine.map((f) => ({
      id: f.id,
      name: f.name,
      timeZone: 'Europe/Rome',
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
      if (!this.isMember(familyId)) return notFound;
      if (parts[4] === 'snapshot') return { status: 200, body: this.snapshot(familyId) };
      if (parts[4] === 'changes') {
        const after = Number(url.searchParams.get('after') ?? '0');
        const limit = Number(url.searchParams.get('limit') ?? '500');
        if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1) {
          return { status: 400, body: { error: 'invalid_request' } };
        }
        return { status: 200, body: this.changes(familyId, after, limit) };
      }
      return notFound;
    }
    if (parts[1] === 'families' && parts[3] === 'tasks' && request.method !== 'GET') {
      const familyId = parts[2];
      const task = this.tasks.get(parts[4]);
      if (!this.isMember(familyId) || !task || task.familyId !== familyId) return notFound;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const mutationId = body.mutationId;
      if (typeof mutationId !== 'string')
        return { status: 400, body: { error: 'invalid_request' } };
      const route = `${request.method} ${url.pathname}`;
      const item = parts[5] === 'items' ? this.items.get(parts[6]) : undefined;
      if (this.done.has(mutationId)) {
        // Like TaskService.replay: the current state, not the answer saved at the time.
        if (this.done.get(mutationId) !== route) {
          return { status: 409, body: { error: 'mutation_conflict' } };
        }
        return { status: 200, body: item ? this.itemData(item) : this.taskData(task) };
      }
      if (request.method === 'POST' && parts.length === 6 && parts[5] === 'items') {
        if (task.status !== 'OPEN') return { status: 409, body: { error: 'not_open' } };
        if (typeof body.id !== 'string' || typeof body.text !== 'string' || !body.text.trim()) {
          return { status: 400, body: { error: 'invalid_request' } };
        }
        const position =
          Math.max(
            0,
            ...[...this.items.values()].filter((i) => i.taskId === task.id).map((i) => i.position),
          ) + 1;
        this.items.set(body.id, {
          id: body.id,
          taskId: task.id,
          text: body.text.trim(),
          checked: false,
          position,
          version: 1,
          deleted: false,
        });
        this.write(familyId, 'shopping_item', body.id, 'UPSERT');
        const added = this.applied_(
          request,
          route,
          mutationId,
          this.itemData(this.items.get(body.id)!),
        );
        return { ...added, status: 201 };
      }
      if (request.method === 'PUT' && parts.length === 8 && parts[7] === 'checked') {
        if (!item || item.taskId !== task.id || item.deleted) return notFound;
        if (task.status !== 'OPEN') return { status: 409, body: { error: 'not_open' } };
        item.checked = body.checked === true;
        item.version++;
        this.write(familyId, 'shopping_item', item.id, 'UPSERT');
        return this.applied_(request, route, mutationId, this.itemData(item));
      }
      if (request.method === 'POST' && parts.length === 6 && parts[5] === 'done') {
        if (task.status !== 'OPEN') return { status: 409, body: { error: 'not_open' } };
        task.status = 'DONE';
        task.version++;
        this.write(familyId, 'task', task.id, 'UPSERT');
        return this.applied_(request, route, mutationId, this.taskData(task));
      }
      if (request.method === 'PUT' && parts.length === 5) {
        if (typeof body.version === 'number' && body.version !== task.version) {
          return {
            status: 409,
            body: { error: 'version_conflict', current: this.taskData(task) },
          };
        }
        if (typeof body.title === 'string') task.title = body.title;
        task.version++;
        this.write(familyId, 'task', task.id, 'UPSERT');
        return this.applied_(request, route, mutationId, this.taskData(task));
      }
    }
    return notFound;
  }

  private applied_(
    request: HttpRequest,
    route: string,
    mutationId: string,
    value: unknown,
  ): HttpResponse {
    this.done.set(mutationId, route);
    this.applied.push({
      mutationId,
      method: request.method,
      path: request.path,
      body: structuredClone(request.body),
    });
    return { status: 200, body: value };
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
        .filter((i) => ids.has(i.taskId) && !i.deleted)
        .map((i) => this.itemData(i)),
      members: [...family.members.entries()].map(([user, role]) => ({ ...PEOPLE[user], role })),
    };
  }

  private changes(familyId: string, after: number, limit: number) {
    const raw = this.log
      .filter((r) => r.familyId === familyId && r.seq > after)
      .slice(0, Math.min(limit, this.pageSize));
    const lastSeq = raw.length ? raw[raw.length - 1].seq : after;
    const hasMore = this.log.some((r) => r.familyId === familyId && r.seq > lastSeq);
    const latest = new Map<string, LogRow>();
    for (const row of raw) latest.set(`${row.entity}:${row.entityId}`, row);
    const changes = [...latest.values()]
      .sort((a, b) => a.seq - b.seq)
      .map((row) => {
        const deleted = { seq: row.seq, entity: row.entity, entityId: row.entityId };
        const gone = { ...deleted, op: 'DELETE', data: null, deletedAt: '2031-03-01T08:00:00Z' };
        if (row.op === 'DELETE') return gone;
        if (row.entity === 'task') {
          const task = this.tasks.get(row.entityId);
          if (!task || task.familyId !== familyId) return gone;
          return { ...deleted, op: 'UPSERT', data: this.taskData(task), deletedAt: null };
        }
        const item = this.items.get(row.entityId);
        const task = item && this.tasks.get(item.taskId);
        if (!item || item.deleted || !task || task.familyId !== familyId) return gone;
        return { ...deleted, op: 'UPSERT', data: this.itemData(item), deletedAt: null };
      });
    return { changes, lastSeq, hasMore };
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
