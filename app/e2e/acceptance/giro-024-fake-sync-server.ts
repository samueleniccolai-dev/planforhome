// Round 024, T9 part 2: an in-process fake of the server's sync API (round 023), used by the
// acceptance tests of the client sync engine. It runs in Node, without a browser: the engine gets
// `server.http` as its transport. It answers like the server after round 023:
// - GET /api/families: the families of the current user;
// - GET /api/sync/families/{f}/snapshot → { familyId, seq, tasks, shoppingItems, members };
// - GET /api/sync/families/{f}/changes?after=&limit= → { changes, lastSeq, hasMore }, with raw
//   pages of at most min(limit, pageSize) rows, one row per entity (highest seq of the page), and
//   the rule of the current family: an entity now elsewhere (or deleted) comes out as DELETE;
// - PUT /api/families/{f}/tasks/{t}/items/{i}/checked { mutationId, checked };
// - PUT /api/families/{f}/tasks/{t} { mutationId, title, version? } → 409 version_conflict with
//   `current` when `version` is old;
// - a `mutationId` already applied is a replay: 200, no effect;
// - a family the user is not in, or does not exist → 404 (same body); unknown path → 404.
// Faults let a test cut the network before or after the server applies a request, or answer a
// given status once. Demo data (invented): families «Rossi» and «Bianchi-Verdi», anna@demo.test
// (manager of Rossi, member of Bianchi-Verdi), luca@demo.test (member of Rossi).

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

const PEOPLE: Record<string, { personId: string; displayName: string }> = {
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
  /** `network-before`: rejects without applying; `network-after`: applies, then rejects. */
  kind: 'network-before' | 'network-after' | number;
};

/** One applied write (not a replay), in the order the server applied it. */
export type Applied = { mutationId: string; method: string; path: string; body: unknown };

export class NetworkError extends Error {
  constructor() {
    super('network down (fake)');
  }
}

export class FakeSyncServer {
  user: string = ANNA;
  pageSize = 500;
  readonly families = new Map<string, FamilyRec>();
  readonly tasks = new Map<string, TaskRec>();
  readonly items = new Map<string, ItemRec>();
  readonly log: LogRow[] = [];
  /** Every request received, with the user who sent it. */
  readonly requests: (HttpRequest & { user: string })[] = [];
  readonly applied: Applied[] = [];
  private readonly replies = new Map<string, unknown>();
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
    this.requests.push({ ...request, user: this.user });
    this.onRequest?.(request);
    const at = this.faults.findIndex((f) => f.match(request));
    const fault = at >= 0 ? this.faults.splice(at, 1)[0] : undefined;
    if (fault?.kind === 'network-before') throw new NetworkError();
    if (typeof fault?.kind === 'number') {
      return { status: fault.kind, body: { error: `fake_${fault.kind}` } };
    }
    const response = this.handle(request);
    if (fault?.kind === 'network-after') throw new NetworkError();
    return response;
  };

  /** The next request that matches gets the fault, once. */
  failOnce(match: (request: HttpRequest) => boolean, kind: Fault['kind']): void {
    this.faults.push({ match, kind });
  }

  /** Requests whose path contains `part`. */
  requestsTo(part: string): (HttpRequest & { user: string })[] {
    return this.requests.filter((r) => r.path.includes(part));
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

  /** Forward: the source family gets only the DELETE of the task (dubbio 2 of round 023). */
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

  private handle(request: HttpRequest): HttpResponse {
    const notFound = { status: 404, body: { error: 'not_found' } };
    const url = new URL(request.path, 'http://fake.test');
    const parts = url.pathname.split('/').filter(Boolean);
    if (request.method === 'GET' && url.pathname === '/api/families') {
      return {
        status: 200,
        body: [...this.families.values()]
          .filter((f) => f.members.has(this.user))
          .map((f) => ({
            id: f.id,
            name: f.name,
            timeZone: 'Europe/Rome',
            role: f.members.get(this.user),
          })),
      };
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
    if (parts[1] === 'families' && parts[3] === 'tasks' && request.method === 'PUT') {
      const familyId = parts[2];
      const task = this.tasks.get(parts[4]);
      if (!this.isMember(familyId) || !task || task.familyId !== familyId) return notFound;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const mutationId = body.mutationId;
      if (typeof mutationId !== 'string')
        return { status: 400, body: { error: 'invalid_request' } };
      if (this.replies.has(mutationId)) {
        return { status: 200, body: this.replies.get(mutationId) };
      }
      if (parts.length === 8 && parts[5] === 'items' && parts[7] === 'checked') {
        const item = this.items.get(parts[6]);
        if (!item || item.taskId !== task.id || item.deleted) return notFound;
        if (task.status !== 'OPEN') return { status: 409, body: { error: 'not_open' } };
        item.checked = body.checked === true;
        item.version++;
        this.write(familyId, 'shopping_item', item.id, 'UPSERT');
        return this.done(request, mutationId, this.itemData(item));
      }
      if (parts.length === 5) {
        if (typeof body.version === 'number' && body.version !== task.version) {
          return {
            status: 409,
            body: { error: 'version_conflict', current: this.taskData(task) },
          };
        }
        if (typeof body.title === 'string') task.title = body.title;
        task.version++;
        this.write(familyId, 'task', task.id, 'UPSERT');
        return this.done(request, mutationId, this.taskData(task));
      }
    }
    return notFound;
  }

  private done(request: HttpRequest, mutationId: string, value: unknown): HttpResponse {
    this.replies.set(mutationId, value);
    this.applied.push({
      mutationId,
      method: request.method,
      path: request.path,
      body: request.body,
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
