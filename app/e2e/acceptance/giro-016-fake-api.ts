import type { BrowserContext, Page, Request } from '@playwright/test';

// Round 016, T7 (app side): the fake API of the forward of a task between families. It lives in
// the browser (`page.route('**/api/**')`) and answers like the server after round 016:
// - POST …/tasks/{id}/forward with `{ mutationId, toFamilyId }`: 404 if the caller is not in both
//   families or the task is not in the family of the URL; 400 `same_family`; P11 (a manager any
//   task, a member only his own) → 403; not OPEN → 409; otherwise the task moves, keeps its
//   assignee only if he is in the family of arrival, `version + 1`;
// - the same `mutationId` again gives the current task.
// `forwardDelayMs` keeps the answer of the forward pending for a while (the button must stay
// disabled meanwhile); `forwardScript` lets a test decide the answer of the next forward.
// Demo data (invented): Appendix A, ids of round 014 for the people.

export const CSRF = 'csrf-finto-giro016';
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
};
const LEO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a2', displayName: 'Leo' };
export const ANNA: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a4',
  displayName: 'Anna',
};
export const LUCA: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a6',
  displayName: 'Luca',
  email: 'luca@example.com',
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
};

export const FOTO = 'Ritirare le foto';
export const REGALO = 'Comprare il regalo per la nonna';
export const PRANZO = 'Prenotare il pranzo di Natale';

export const FOTO_ID = '0192a3b4-0000-7000-8000-000000001601';
export const REGALO_ID = '0192a3b4-0000-7000-8000-000000001602';
export const PRANZO_ID = '0192a3b4-0000-7000-8000-000000001603';

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
    ...fields,
  };
}

function startingTasks(): Task[] {
  return [
    // Principale: assigned to Marco, who is not in Mamma.
    task(FOTO_ID, PRINCIPALE, FOTO, {
      createdBy: MARCO.personId,
      assigneePersonId: MARCO.personId,
    }),
    // Principale: assigned to Giulia, who is in Mamma too.
    task(REGALO_ID, PRINCIPALE, REGALO, {
      createdBy: GIULIA.personId,
      assigneePersonId: GIULIA.personId,
    }),
    // Mamma: created by Anna, in the queue.
    task(PRANZO_ID, MAMMA, PRANZO, { createdBy: ANNA.personId }),
  ];
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** An answer the test decides for the next forward, instead of the fake server. */
export type Scripted = { status: number; json?: unknown };

export class FakeApi {
  user: Person | undefined;
  tasks: Task[] = startingTasks();
  now: string = MONDAY;
  forwardDelayMs = 0;
  readonly forwardScript: Scripted[] = [];
  readonly requests: Request[] = [];
  private readonly seen = new Map<string, string>(); // mutationId -> task id

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

      if (method === 'GET' && path === '/api/me') {
        if (!this.user) return route.fulfill({ status: 401 });
        return route.fulfill({
          status: 200,
          json: {
            personId: this.user.personId,
            email: this.user.email,
            displayName: this.user.displayName,
            locale: 'it',
          },
        });
      }
      if (method === 'POST' && path === '/api/auth/refresh') {
        if (!this.user) return route.fulfill({ status: 401 });
        return route.fulfill({ status: 200, json: { expiresAt: EXPIRES_AT } });
      }
      if (!this.user) return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
      const user = this.user;

      if (method === 'GET' && path === '/api/families') {
        return route.fulfill({
          status: 200,
          json: this.familiesOf(user)
            .sort((a, b) => (a.name < b.name ? -1 : 1))
            .map((f) => ({
              id: f.id,
              name: f.name,
              timeZone: f.timeZone,
              role: this.roleOf(user, f),
            })),
        });
      }
      if (method === 'GET' && path === '/api/tasks') {
        const mine = new Set(this.familiesOf(user).map((f) => f.id));
        return route.fulfill({ status: 200, json: this.tasks.filter((t) => mine.has(t.familyId)) });
      }

      const members = /^\/api\/families\/([^/]+)\/members$/.exec(path);
      if (method === 'GET' && members) {
        const family = this.mine(user, members[1]);
        if (!family) return route.fulfill({ status: 404, json: { error: 'not_found' } });
        return route.fulfill({
          status: 200,
          json: [...family.members]
            .sort((a, b) => (a.person.displayName < b.person.displayName ? -1 : 1))
            .map((m) => ({
              personId: m.person.personId,
              displayName: m.person.displayName,
              role: m.role,
              hasAccount: m.hasAccount,
              referentPersonId: m.referentPersonId,
            })),
        });
      }

      const tasks = /^\/api\/families\/([^/]+)\/tasks$/.exec(path);
      if (tasks && method === 'GET') {
        if (!this.mine(user, tasks[1])) {
          return route.fulfill({ status: 404, json: { error: 'not_found' } });
        }
        return route.fulfill({
          status: 200,
          json: JSON.parse(JSON.stringify(this.tasks.filter((t) => t.familyId === tasks[1]))),
        });
      }

      const forward = /^\/api\/families\/([^/]+)\/tasks\/([^/]+)\/forward$/.exec(path);
      if (forward && method === 'POST') {
        if (this.forwardDelayMs > 0) await sleep(this.forwardDelayMs);
        const scripted = this.forwardScript.shift();
        if (scripted) return route.fulfill({ status: scripted.status, json: scripted.json ?? {} });
        const body = request.postDataJSON() as { mutationId?: string; toFamilyId?: string };
        const replayed = body.mutationId ? this.seen.get(body.mutationId) : undefined;
        if (replayed) {
          return route.fulfill({ status: 200, json: this.tasks.find((t) => t.id === replayed) });
        }
        const from = this.mine(user, forward[1]);
        const found = from
          ? this.tasks.find((t) => t.id === forward[2] && t.familyId === forward[1])
          : undefined;
        if (!from || !found) return route.fulfill({ status: 404, json: { error: 'not_found' } });
        if (!body.mutationId || !body.toFamilyId) {
          return route.fulfill({ status: 400, json: { error: 'invalid_request' } });
        }
        const to = this.mine(user, body.toFamilyId);
        if (!to) return route.fulfill({ status: 404, json: { error: 'not_found' } });
        if (to.id === from.id) {
          return route.fulfill({ status: 400, json: { error: 'same_family' } });
        }
        const own = found.createdBy === user.personId || found.assigneePersonId === user.personId;
        if (this.roleOf(user, from) !== 'MANAGER' && !own) {
          return route.fulfill({ status: 403, json: { error: 'forbidden' } });
        }
        if (found.status !== 'OPEN') {
          return route.fulfill({ status: 409, json: { error: 'not_open' } });
        }
        found.familyId = to.id;
        found.familyTimeZone = to.timeZone;
        if (!to.members.some((m) => m.person.personId === found.assigneePersonId)) {
          found.assigneePersonId = null;
        }
        found.version += 1;
        found.updatedAt = this.now;
        this.seen.set(body.mutationId, found.id);
        return route.fulfill({ status: 200, json: found });
      }
      return route.fulfill({ status: 404, json: { error: 'not_found' } });
    });
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
