import type { BrowserContext, Page, Request } from '@playwright/test';

// Round 019, T8 part 2 (app side): the fake API of the shopping list. It lives in the browser
// (`page.route('**/api/**')`) and answers like the server after round 019 (contestation 018-a):
// - tasks carry `template` (`NONE` or `SHOPPING_LIST`); POST …/tasks keeps it;
// - GET …/tasks/{t}/items: the items not cancelled (alive and struck), in order of position, with
//   `createdBy` and `removedBy`;
// - POST …/items `{ mutationId, id, text }` → 201, at the bottom, `createdBy` = caller;
// - PUT …/items/{i}/checked: a struck item → 409 `item_removed`; a cancelled one → 404;
// - PUT …/items/order: the order of the ids sent, the others after;
// - POST …/items/{i}/remove: the creator of the list (if member of the family) or a manager
//   cancel it (`deletedAt`, `removedBy`); another member strikes it (`removedBy`), a struck one
//   again → 409 `item_removed`;
// - POST …/items/{i}/restore: struck → alive; not struck → 409 `not_removed`; cancelled → 404;
// - POST …/items/clear-checked: creator, manager or assignee, else 403; cancels the alive checked.
// `addDelayMs` keeps the answer of an add pending; `removeScript` and `clearScript` let a test
// decide the next answer instead of the fake server. Demo data (invented): Appendix A, ids of
// rounds 014 and 016 for the people.

export const CSRF = 'csrf-finto-giro019';
const EXPIRES_AT = '2031-02-05T08:00:00Z';
const UPDATED_AT = '2031-01-05T08:00:00Z';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Monday 6 January 2031, 08:00Z. */
export const MONDAY = '2031-01-06T08:00:00Z';

export const PRINCIPALE = '0192a3b4-0000-7000-8000-0000000000f1';
export const MAMMA = '0192a3b4-0000-7000-8000-0000000000f2';

export type Person = { personId: string; displayName: string; email?: string };

export const GIULIA: Person = {
  personId: '0192a3b4-0000-7000-8000-000000000004',
  displayName: 'Giulia',
  email: 'giulia@example.com',
};
export const MARCO: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a1',
  displayName: 'Marco',
  email: 'marco@example.com',
};
const LEO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a2', displayName: 'Leo' };
export const ANNA: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a4',
  displayName: 'Anna',
  email: 'anna@example.com',
};
export const LUCA: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a6',
  displayName: 'Luca',
  email: 'luca@example.com',
};
/** Pietro added an item in Mamma and then left: not a member of any family here. */
export const PIETRO: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a5',
  displayName: 'Pietro',
};

type Role = 'MANAGER' | 'MEMBER';
type Member = { person: Person; role: Role; hasAccount: boolean; referentPersonId: string | null };
type Family = { id: string; name: string; timeZone: string; members: Member[] };

const account = (person: Person, role: Role): Member => ({
  person,
  role,
  hasAccount: true,
  referentPersonId: null,
});

const FAMILIES: Family[] = [
  {
    id: PRINCIPALE,
    name: 'Famiglia Principale',
    timeZone: 'Europe/Rome',
    members: [
      account(MARCO, 'MANAGER'),
      account(GIULIA, 'MANAGER'),
      { person: LEO, role: 'MEMBER', hasAccount: false, referentPersonId: GIULIA.personId },
    ],
  },
  {
    id: MAMMA,
    name: 'Famiglia Mamma',
    timeZone: 'Europe/Rome',
    members: [account(ANNA, 'MANAGER'), account(GIULIA, 'MEMBER'), account(LUCA, 'MEMBER')],
  },
];

export type Template = 'NONE' | 'SHOPPING_LIST';

export type Task = {
  id: string;
  familyId: string;
  familyTimeZone: string;
  title: string;
  notes: string | null;
  dueKind: 'DATE' | 'DATETIME' | null;
  due: string | null;
  criticality: 'LOW' | 'NORMAL' | 'HIGH';
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  assigneePersonId: string | null;
  createdBy: string;
  completedBy: string | null;
  version: number;
  updatedAt: string;
  recurrence: null;
  seriesId: null;
  template: Template;
};

export type Item = {
  id: string;
  taskId: string;
  text: string;
  checked: boolean;
  position: number;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  createdBy: string;
  removedBy: string | null;
};

export const LISTA = 'Lista della spesa';
export const FOTO = 'Ritirare le foto';
export const NONNA = 'Spesa per la nonna';
export const SABATO = 'Spesa del sabato';

export const LISTA_ID = '0192a3b4-0000-7000-8000-000000001901';
export const FOTO_ID = '0192a3b4-0000-7000-8000-000000001902';
export const NONNA_ID = '0192a3b4-0000-7000-8000-000000001903';
export const SABATO_ID = '0192a3b4-0000-7000-8000-000000001904';

function task(
  id: string,
  familyId: string,
  title: string,
  fields: Partial<Task> & { createdBy: string },
): Task {
  const family = FAMILIES.find((f) => f.id === familyId)!;
  return {
    id,
    familyId,
    familyTimeZone: family.timeZone,
    title,
    notes: null,
    dueKind: null,
    due: null,
    criticality: 'NORMAL',
    status: 'OPEN',
    assigneePersonId: null,
    completedBy: null,
    version: 1,
    updatedAt: UPDATED_AT,
    recurrence: null,
    seriesId: null,
    template: 'NONE',
    ...fields,
  };
}

function startingTasks(): Task[] {
  return [
    // Principale: the demo list of Giulia.
    task(LISTA_ID, PRINCIPALE, LISTA, { createdBy: GIULIA.personId, template: 'SHOPPING_LIST' }),
    // Principale: a task without template.
    task(FOTO_ID, PRINCIPALE, FOTO, { createdBy: MARCO.personId }),
    // Mamma: forwarded from Principale; its creator Marco is not in Mamma.
    task(NONNA_ID, MAMMA, NONNA, { createdBy: MARCO.personId, template: 'SHOPPING_LIST' }),
    // Mamma: created by Anna, assigned to Luca.
    task(SABATO_ID, MAMMA, SABATO, {
      createdBy: ANNA.personId,
      assigneePersonId: LUCA.personId,
      template: 'SHOPPING_LIST',
    }),
  ];
}

let counter = 0;
const itemId = () => `0192a3b4-0000-7000-8000-0000000019${String(++counter).padStart(2, '0')}`;

function item(
  taskId: string,
  text: string,
  position: number,
  createdBy: Person,
  fields: Partial<Item> = {},
): Item {
  return {
    id: itemId(),
    taskId,
    text,
    checked: false,
    position,
    version: 1,
    updatedAt: UPDATED_AT,
    deletedAt: null,
    createdBy: createdBy.personId,
    removedBy: null,
    ...fields,
  };
}

function startingItems(): Item[] {
  counter = 10;
  return [
    item(LISTA_ID, 'Latte', 0, GIULIA),
    item(LISTA_ID, 'Pane', 1, GIULIA),
    item(LISTA_ID, 'Mele', 2, GIULIA),
    item(LISTA_ID, 'Biscotti', 3, MARCO),
    item(NONNA_ID, 'Uova', 0, MARCO),
    item(NONNA_ID, 'Farina', 1, LUCA),
    item(NONNA_ID, 'Zucchero', 2, PIETRO, { checked: true, version: 2 }),
    item(NONNA_ID, 'Sale', 3, ANNA, { removedBy: LUCA.personId, version: 2 }),
    item(SABATO_ID, 'Pane', 0, ANNA, { checked: true, version: 2 }),
  ];
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** An answer the test decides for the next call, instead of the fake server. */
export type Scripted = { status: number; json?: unknown };

type Body = {
  mutationId?: string;
  id?: string;
  text?: string;
  checked?: boolean;
  itemIds?: string[];
};

export class FakeApi {
  user: Person | undefined;
  tasks: Task[] = startingTasks();
  items: Item[] = startingItems();
  now: string = MONDAY;
  addDelayMs = 0;
  readonly removeScript: Scripted[] = [];
  readonly clearScript: Scripted[] = [];
  readonly requests: Request[] = [];
  private readonly seen = new Map<string, unknown>(); // mutationId -> answer

  constructor(
    private readonly page: Page,
    private readonly context: BrowserContext,
  ) {}

  async install(): Promise<void> {
    await this.page.route('**/api/**', async (route) => {
      const request = route.request();
      this.requests.push(request);
      const path = new URL(request.url()).pathname;
      const method = request.method();
      const reply = (status: number, json: unknown) => route.fulfill({ status, json });

      if (method === 'GET' && path === '/api/me') {
        if (!this.user) return route.fulfill({ status: 401 });
        return reply(200, {
          personId: this.user.personId,
          email: this.user.email,
          displayName: this.user.displayName,
          locale: 'it',
        });
      }
      if (method === 'POST' && path === '/api/auth/refresh') {
        if (!this.user) return route.fulfill({ status: 401 });
        return reply(200, { expiresAt: EXPIRES_AT });
      }
      if (!this.user) return reply(401, { error: 'unauthorized' });
      const user = this.user;

      if (method === 'GET' && path === '/api/families') {
        return reply(
          200,
          this.familiesOf(user)
            .sort((a, b) => (a.name < b.name ? -1 : 1))
            .map((f) => ({
              id: f.id,
              name: f.name,
              timeZone: f.timeZone,
              role: this.roleOf(user, f),
            })),
        );
      }
      if (method === 'GET' && path === '/api/tasks') {
        const mine = new Set(this.familiesOf(user).map((f) => f.id));
        return reply(
          200,
          this.tasks.filter((t) => mine.has(t.familyId)),
        );
      }

      const members = /^\/api\/families\/([^/]+)\/members$/.exec(path);
      if (method === 'GET' && members) {
        const family = this.mine(user, members[1]);
        if (!family) return reply(404, { error: 'not_found' });
        return reply(
          200,
          [...family.members]
            .sort((a, b) => (a.person.displayName < b.person.displayName ? -1 : 1))
            .map((m) => ({
              personId: m.person.personId,
              displayName: m.person.displayName,
              role: m.role,
              hasAccount: m.hasAccount,
              referentPersonId: m.referentPersonId,
            })),
        );
      }

      const tasks = /^\/api\/families\/([^/]+)\/tasks$/.exec(path);
      if (tasks && method === 'GET') {
        if (!this.mine(user, tasks[1])) return reply(404, { error: 'not_found' });
        return reply(200, clone(this.tasks.filter((t) => t.familyId === tasks[1])));
      }
      if (tasks && method === 'POST') {
        const family = this.mine(user, tasks[1]);
        if (!family) return reply(404, { error: 'not_found' });
        const body = request.postDataJSON() as {
          id: string;
          mutationId: string;
          title: string;
          template?: Template;
        };
        if (this.seen.has(body.mutationId)) return reply(200, this.seen.get(body.mutationId));
        if (body.template !== undefined && !['NONE', 'SHOPPING_LIST'].includes(body.template)) {
          return reply(400, { error: 'template_invalid' });
        }
        const created = task(body.id, family.id, body.title, {
          createdBy: user.personId,
          template: body.template ?? 'NONE',
        });
        this.tasks.push(created);
        this.seen.set(body.mutationId, created);
        return reply(201, created);
      }

      const items =
        /^\/api\/families\/([^/]+)\/tasks\/([^/]+)\/items(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(path);
      if (items) {
        const family = this.mine(user, items[1]);
        const list = family
          ? this.tasks.find((t) => t.id === items[2] && t.familyId === family.id)
          : undefined;
        if (!family || !list) return reply(404, { error: 'not_found' });
        const [, , , first, second] = items;
        if (method === 'GET' && !first) return reply(200, clone(this.visible(list)));

        const body = (request.postDataJSON() ?? {}) as Body;
        if (!body.mutationId) return reply(400, { error: 'invalid_request' });
        if (this.seen.has(body.mutationId)) return reply(200, this.seen.get(body.mutationId));
        if (list.template !== 'SHOPPING_LIST') return reply(409, { error: 'not_shopping_list' });
        if (list.status !== 'OPEN') return reply(409, { error: 'not_open' });

        if (method === 'POST' && !first) {
          if (this.addDelayMs > 0) await sleep(this.addDelayMs);
          const text = (body.text ?? '').trim();
          if (!text) return reply(400, { error: 'text_invalid' });
          const position =
            Math.max(-1, ...this.items.filter((i) => i.taskId === list.id).map((i) => i.position)) +
            1;
          const added = item(list.id, text, position, user, {
            id: body.id ?? itemId(),
            updatedAt: this.now,
          });
          this.items.push(added);
          return this.answer(route, body.mutationId, 201, added);
        }
        if (method === 'POST' && first === 'clear-checked') {
          const scripted = this.clearScript.shift();
          if (scripted) return reply(scripted.status, scripted.json ?? {});
          if (!this.mayClear(user, family, list)) return reply(403, { error: 'forbidden' });
          for (const i of this.visible(list)) {
            if (i.checked && !i.removedBy) this.cancel(i, user);
          }
          return this.answer(route, body.mutationId, 200, this.visible(list));
        }
        if (method === 'PUT' && first === 'order') {
          const ids = body.itemIds ?? [];
          const alive = this.visible(list);
          const sequence = [
            ...ids.map((id) => alive.find((i) => i.id === id)).filter((i): i is Item => !!i),
            ...alive.filter((i) => !ids.includes(i.id)),
          ];
          sequence.forEach((i, position) => {
            if (i.position !== position) this.touch(i, { position });
          });
          return this.answer(route, body.mutationId, 200, this.visible(list));
        }

        const found = this.items.find((i) => i.id === first && i.taskId === list.id);
        if (!found || found.deletedAt) return reply(404, { error: 'not_found' });
        if (method === 'PUT' && second === 'checked') {
          if (found.removedBy) return reply(409, { error: 'item_removed' });
          if (typeof body.checked !== 'boolean') return reply(400, { error: 'invalid_request' });
          if (found.checked !== body.checked) this.touch(found, { checked: body.checked });
          return this.answer(route, body.mutationId, 200, found);
        }
        if (method === 'POST' && second === 'remove') {
          const scripted = this.removeScript.shift();
          if (scripted) return reply(scripted.status, scripted.json ?? {});
          if (this.isCreatorOrManager(user, family, list)) {
            this.cancel(found, user);
          } else if (found.removedBy) {
            return reply(409, { error: 'item_removed' });
          } else {
            this.touch(found, { removedBy: user.personId });
          }
          return this.answer(route, body.mutationId, 200, found);
        }
        if (method === 'POST' && second === 'restore') {
          if (!found.removedBy) return reply(409, { error: 'not_removed' });
          this.touch(found, { removedBy: null });
          return this.answer(route, body.mutationId, 200, found);
        }
      }
      return reply(404, { error: 'not_found' });
    });
  }

  private answer(
    route: { fulfill: (o: { status: number; json: unknown }) => Promise<void> },
    mutationId: string,
    status: number,
    json: unknown,
  ): Promise<void> {
    const copy = clone(json);
    this.seen.set(mutationId, copy);
    return route.fulfill({ status, json: copy });
  }

  private touch(found: Item, change: Partial<Item>): void {
    Object.assign(found, change);
    found.version += 1;
    found.updatedAt = this.now;
  }

  private cancel(found: Item, by: Person): void {
    this.touch(found, { deletedAt: this.now, removedBy: by.personId });
  }

  visible(list: Task): Item[] {
    return this.items
      .filter((i) => i.taskId === list.id && !i.deletedAt)
      .sort((a, b) => a.position - b.position);
  }

  isCreatorOrManager(person: Person, family: Family, list: Task): boolean {
    const creatorHere =
      list.createdBy === person.personId &&
      family.members.some((m) => m.person.personId === list.createdBy);
    return creatorHere || this.roleOf(person, family) === 'MANAGER';
  }

  mayClear(person: Person, family: Family, list: Task): boolean {
    return (
      this.isCreatorOrManager(person, family, list) || list.assigneePersonId === person.personId
    );
  }

  /** The item of a list with that text (alive or struck); fails if missing. */
  itemOf(taskId: string, text: string): Item {
    const found = this.items.find((i) => i.taskId === taskId && i.text === text && !i.deletedAt);
    if (!found) throw new Error(`no item ${text} in ${taskId}`);
    return found;
  }

  /** A change made by somebody else, on the fake server only (the screen does not know yet). */
  elsewhere(taskId: string, text: string, change: Partial<Item>): void {
    this.touch(this.itemOf(taskId, text), change);
  }

  familiesOf(person: Person): Family[] {
    return FAMILIES.filter((f) => f.members.some((m) => m.person.personId === person.personId));
  }

  mine(person: Person, familyId: string): Family | undefined {
    return this.familiesOf(person).find((f) => f.id === familyId);
  }

  roleOf(person: Person, family: Family): Role {
    return family.members.find((m) => m.person.personId === person.personId)!.role;
  }

  async openSession(person: Person): Promise<void> {
    this.user = person;
    await this.context.addCookies([
      { name: 'pfh_csrf', value: CSRF, domain: 'localhost', path: '/', sameSite: 'Lax' },
    ]);
  }

  calls(method: string, path: string): Request[] {
    return this.requests.filter((r) => r.method() === method && new URL(r.url()).pathname === path);
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
