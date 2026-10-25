import type { BrowserContext, Page, Request } from '@playwright/test';

// Round 031, T10 part 1 (app side): the fake API of the nudge on the web. It lives in the browser
// (`page.route('**/api/**')`) and answers like the server after round 031:
// - task views carry `lastNudgedAt` (ISO-8601 UTC or null);
// - POST /api/families/{f}/tasks/{t}/nudge { mutationId } → 200 with the task view
//   (`lastNudgedAt` = now of the fake, `version` + 1); a member → 403 forbidden; a task in the
//   queue → 409 not_assigned; not OPEN → 409 not_open; a second nudge of the same task within 5
//   minutes → 429 nudge_too_soon with `Retry-After`; the same mutationId → the same answer.
// Demo data (invented, Appendix A): Famiglia Principale (Europe/Rome) with Marco and Giulia
// managers and Leo (resource, referent Giulia); Famiglia Mamma (Europe/Rome) with Anna manager,
// Luca and Paolo members. The ids are those of rounds 016 and 019 for the people.

export const CSRF = 'csrf-finto-giro031';
const EXPIRES_AT = '2031-02-05T08:00:00Z';
const UPDATED_AT = '2031-01-05T08:00:00Z';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Monday 6 January 2031, 08:00Z = 09:00 in Rome (CET). */
export const MONDAY = '2031-01-06T08:00:00Z';
/** The same Monday, 07:15Z = 08:15 in Rome: a nudge already there when the screen opens. */
export const EARLIER = '2031-01-06T07:15:00Z';

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
export const PAOLO: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a7',
  displayName: 'Paolo',
  email: 'paolo@example.com',
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
    members: [account(ANNA, 'MANAGER'), account(LUCA, 'MEMBER'), account(PAOLO, 'MEMBER')],
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
  template: 'NONE' | 'SHOPPING_LIST';
  lastNudgedAt: string | null;
};

export const PANE = 'Comprare il pane';
export const ZAINO = 'Zaino di Leo';
export const AUTO = "Lavare l'auto";
export const SPESA = 'Spesa per Anna';

export const PANE_ID = '0192a3b4-0000-7000-8000-000000003101';
export const ZAINO_ID = '0192a3b4-0000-7000-8000-000000003102';
export const AUTO_ID = '0192a3b4-0000-7000-8000-000000003103';
export const SPESA_ID = '0192a3b4-0000-7000-8000-000000003104';

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
    lastNudgedAt: null,
    ...fields,
  };
}

function startingTasks(): Task[] {
  return [
    // Principale: assigned to Giulia, never nudged.
    task(PANE_ID, PRINCIPALE, PANE, {
      createdBy: GIULIA.personId,
      assigneePersonId: GIULIA.personId,
    }),
    // Principale: assigned to Leo (resource), nudged at 08:15 Rome time.
    task(ZAINO_ID, PRINCIPALE, ZAINO, {
      createdBy: MARCO.personId,
      assigneePersonId: LEO.personId,
      lastNudgedAt: EARLIER,
      version: 2,
    }),
    // Principale: in the queue.
    task(AUTO_ID, PRINCIPALE, AUTO, { createdBy: MARCO.personId }),
    // Mamma: assigned to Paolo.
    task(SPESA_ID, MAMMA, SPESA, { createdBy: ANNA.personId, assigneePersonId: PAOLO.personId }),
  ];
}

const FIVE_MINUTES = 5 * 60 * 1000;

export class FakeApi {
  user: Person | undefined;
  tasks: Task[] = startingTasks();
  now: string = MONDAY;
  readonly requests: Request[] = [];
  private readonly seen = new Map<string, { status: number; json: unknown }>();

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
      const reply = (status: number, json: unknown, headers?: Record<string, string>) =>
        route.fulfill({ status, json, headers });

      if (method === 'GET' && path === '/api/me') {
        if (!this.user) return route.fulfill({ status: 401 });
        return reply(200, {
          personId: this.user.personId,
          email: this.user.email,
          displayName: this.user.displayName,
          // Round 052: the account speaks the language of the browser, as before the account locale won.
          locale: (await route.request().headerValue('accept-language'))
            ?.toLowerCase()
            .startsWith('it')
            ? 'it'
            : 'en',
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
        return reply(200, clone(this.tasks.filter((t) => mine.has(t.familyId))));
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

      const nudge = /^\/api\/families\/([^/]+)\/tasks\/([^/]+)\/nudge$/.exec(path);
      if (nudge && method === 'POST') {
        const family = this.mine(user, nudge[1]);
        const found = family
          ? this.tasks.find((t) => t.id === nudge[2] && t.familyId === family.id)
          : undefined;
        if (!family || !found) return reply(404, { error: 'not_found' });
        const body = (request.postDataJSON() ?? {}) as { mutationId?: string };
        if (!body.mutationId) return reply(400, { error: 'invalid_request' });
        const replay = this.seen.get(body.mutationId);
        if (replay) return reply(replay.status, replay.json);
        if (this.roleOf(user, family) !== 'MANAGER') return reply(403, { error: 'forbidden' });
        if (found.status !== 'OPEN') return reply(409, { error: 'not_open' });
        if (!found.assigneePersonId) return reply(409, { error: 'not_assigned' });
        if (found.lastNudgedAt) {
          const wait = Date.parse(found.lastNudgedAt) + FIVE_MINUTES - Date.parse(this.now);
          if (wait > 0) {
            return reply(
              429,
              { error: 'nudge_too_soon' },
              { 'Retry-After': String(Math.ceil(wait / 1000)) },
            );
          }
        }
        found.lastNudgedAt = this.now;
        found.version += 1;
        found.updatedAt = this.now;
        const answer = { status: 200, json: clone(found) };
        this.seen.set(body.mutationId, answer);
        return reply(answer.status, answer.json);
      }
      return reply(404, { error: 'not_found' });
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
