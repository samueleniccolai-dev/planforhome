import type { BrowserContext, Page, Request } from '@playwright/test';

// Round 011, T5 part 3 (app side): the fake API shared by the two specs of the round. As in round
// 010 it lives in the browser (`page.route('**/api/**')`) and answers like the server of round
// 011: `done`, `reopen`, `cancel` change the status and raise the version; `/api/me` gives the
// personId (the filter «Assigned to me» needs it). Knobs script the answers the server decides
// (403, 409) and slow or lost answers. Demo data (invented): Appendix A with the ids of round 007.
// Famiglia Mamma is in New York here, to prove that «Due soon» counts days in the zone of the
// family of each task.

export const CSRF = 'csrf-finto-giro011';
const EXPIRES_AT = '2031-02-05T08:00:00Z';
const UPDATED_AT = '2026-10-20T08:00:00Z';
export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The instant the browser clock is fixed at in the filter tests: Monday 2 November 2026. */
export const NOW = '2026-11-02T10:00:00Z';

export const PRINCIPALE = '0192a3b4-0000-7000-8000-0000000000f1';
export const MAMMA = '0192a3b4-0000-7000-8000-0000000000f2';
export const BABBO = '0192a3b4-0000-7000-8000-0000000000f3';

export type Person = { personId: string; displayName: string; email?: string };

export const GIULIA: Person = {
  personId: '0192a3b4-0000-7000-8000-000000000004',
  displayName: 'Giulia',
  email: 'giulia@example.com',
};
export const LUCA: Person = {
  personId: '0192a3b4-0000-7000-8000-000000000005',
  displayName: 'Luca',
  email: 'luca@example.com',
};
export const MARCO: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a1',
  displayName: 'Marco',
};
export const LEO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a2', displayName: 'Leo' };
const SOFIA: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a3', displayName: 'Sofia' };
export const ANNA: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a4',
  displayName: 'Anna',
};
const PIETRO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a5', displayName: 'Pietro' };
const PAOLO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a6', displayName: 'Paolo' };
const DAVIDE: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a7', displayName: 'Davide' };
const ROSA: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a8', displayName: 'Rosa' };
const FRANCO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a9', displayName: 'Franco' };

type Role = 'MANAGER' | 'MEMBER';
type Member = { person: Person; role: Role; hasAccount: boolean; referentPersonId: string | null };
type Family = { id: string; name: string; timeZone: string; members: Member[] };

const account = (person: Person, role: Role): Member => ({
  person,
  role,
  hasAccount: true,
  referentPersonId: null,
});
const resource = (person: Person, referent: Person): Member => ({
  person,
  role: 'MEMBER',
  hasAccount: false,
  referentPersonId: referent.personId,
});

const FAMILIES: Family[] = [
  {
    id: PRINCIPALE,
    name: 'Famiglia Principale',
    timeZone: 'Europe/Rome',
    members: [
      account(MARCO, 'MANAGER'),
      account(GIULIA, 'MANAGER'),
      resource(LEO, GIULIA),
      resource(SOFIA, MARCO),
    ],
  },
  {
    id: MAMMA,
    name: 'Famiglia Mamma',
    timeZone: 'America/New_York',
    members: [
      account(ANNA, 'MANAGER'),
      account(PIETRO, 'MANAGER'),
      account(GIULIA, 'MEMBER'),
      account(LUCA, 'MEMBER'),
      account(PAOLO, 'MEMBER'),
      account(DAVIDE, 'MEMBER'),
    ],
  },
  {
    id: BABBO,
    name: 'Famiglia Babbo',
    timeZone: 'Europe/Rome',
    members: [account(ROSA, 'MANAGER'), account(FRANCO, 'MANAGER'), account(MARCO, 'MEMBER')],
  },
];

export type Status = 'OPEN' | 'DONE' | 'CANCELLED';

export type Task = {
  id: string;
  familyId: string;
  familyTimeZone: string;
  title: string;
  notes: string | null;
  dueKind: 'DATE' | 'DATETIME' | null;
  due: string | null;
  criticality: 'LOW' | 'NORMAL' | 'HIGH';
  status: Status;
  assigneePersonId: string | null;
  createdBy: string;
  completedBy: string | null;
  version: number;
  updatedAt: string;
};

// Famiglia Principale (Europe/Rome).
export const ZAINO = 'Preparare lo zaino';
export const REGALO = 'Comprare il regalo per Sofia';
export const CANTINA = 'Riordinare la cantina';
export const DIVANO = 'Spostare il divano';
export const MENSA = 'Pagare la mensa';
export const FOTO = 'Ritirare le foto';
export const LIBRI = 'Restituire i libri';
export const BUS = "Rinnovare l'abbonamento del bus";
// Famiglia Mamma (America/New_York here).
export const PRANZO = 'Prenotare il pranzo di Natale';
export const REGALI = 'Comprare i regali';
// Famiglia Babbo: Giulia is not in it.
export const CARTA = "Rinnovare la carta d'identità di Franco";

export const ZAINO_ID = '0192a3b4-0000-7000-8000-0000000000c1';
export const REGALO_ID = '0192a3b4-0000-7000-8000-0000000000c2';
export const CANTINA_ID = '0192a3b4-0000-7000-8000-0000000000c3';
export const DIVANO_ID = '0192a3b4-0000-7000-8000-0000000000c4';
const MENSA_ID = '0192a3b4-0000-7000-8000-0000000000c5';
const FOTO_ID = '0192a3b4-0000-7000-8000-0000000000c6';
const LIBRI_ID = '0192a3b4-0000-7000-8000-0000000000c7';
const BUS_ID = '0192a3b4-0000-7000-8000-0000000000c8';
const PRANZO_ID = '0192a3b4-0000-7000-8000-0000000000c9';
const REGALI_ID = '0192a3b4-0000-7000-8000-0000000000ca';
const CARTA_ID = '0192a3b4-0000-7000-8000-0000000000cb';

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
    ...fields,
  };
}

const date = (due: string) => ({ dueKind: 'DATE' as const, due });

/**
 * With the clock at {@link NOW}, today is 2 November in Rome and in New York, and «Due soon» goes
 * up to 9 November included. The comment says in which filters each task is.
 */
function startingTasks(): Task[] {
  const g = GIULIA.personId;
  return [
    // all, due soon (assigned to Leo, Giulia's resource: not «assigned to me»)
    task(ZAINO_ID, PRINCIPALE, ZAINO, {
      createdBy: g,
      assigneePersonId: LEO.personId,
      ...date('2026-11-04'),
    }),
    // all, assigned to me, due soon
    task(REGALO_ID, PRINCIPALE, REGALO, {
      createdBy: MARCO.personId,
      assigneePersonId: g,
      ...date('2026-11-05'),
    }),
    // all only: done
    task(CANTINA_ID, PRINCIPALE, CANTINA, {
      createdBy: g,
      assigneePersonId: g,
      status: 'DONE',
      completedBy: g,
      version: 2,
      ...date('2026-11-03'),
    }),
    // all only: cancelled, in the queue
    task(DIVANO_ID, PRINCIPALE, DIVANO, {
      createdBy: MARCO.personId,
      status: 'CANCELLED',
      version: 2,
      ...date('2026-11-03'),
    }),
    // all, in queue, due soon
    task(MENSA_ID, PRINCIPALE, MENSA, { createdBy: MARCO.personId, ...date('2026-11-06') }),
    // all, due soon: exactly 7 days
    task(FOTO_ID, PRINCIPALE, FOTO, {
      createdBy: MARCO.personId,
      assigneePersonId: MARCO.personId,
      ...date('2026-11-09'),
    }),
    // all, due soon: overdue
    task(LIBRI_ID, PRINCIPALE, LIBRI, {
      createdBy: MARCO.personId,
      assigneePersonId: MARCO.personId,
      ...date('2026-10-30'),
    }),
    // all only: 8 days
    task(BUS_ID, PRINCIPALE, BUS, {
      createdBy: MARCO.personId,
      assigneePersonId: MARCO.personId,
      ...date('2026-11-10'),
    }),
    // all, in queue
    task(PRANZO_ID, MAMMA, PRANZO, {
      createdBy: ANNA.personId,
      criticality: 'HIGH',
      ...date('2026-12-20'),
    }),
    // all, assigned to me, due soon: 9 November at 22:00 in New York (already the 10th in Rome
    // and in Tokyo)
    task(REGALI_ID, MAMMA, REGALI, {
      createdBy: ANNA.personId,
      assigneePersonId: g,
      dueKind: 'DATETIME',
      due: '2026-11-10T03:00:00Z',
    }),
    task(CARTA_ID, BABBO, CARTA, { createdBy: ROSA.personId, ...date('2026-11-04') }),
  ];
}

const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : 1);
const byPerson = (a: Member, b: Member) => (a.person.displayName < b.person.displayName ? -1 : 1);

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** An answer the test decides for the next status write, instead of the fake server. */
export type Scripted = 'abort' | { status: number; json?: unknown; effect?: () => void };

const ACTIONS = { done: 'DONE', reopen: 'OPEN', cancel: 'CANCELLED' } as const;

export class FakeApi {
  user: Person | undefined;
  tasks: Task[] = startingTasks();
  writeDelayMs = 0;
  readonly writeScript: Scripted[] = [];
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
            // Round 052: the account speaks the language of the browser, as before the account locale won.
            locale: (await route.request().headerValue('accept-language'))
              ?.toLowerCase()
              .startsWith('it')
              ? 'it'
              : 'en',
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
            .sort(byName)
            .map((f) => ({
              id: f.id,
              name: f.name,
              timeZone: f.timeZone,
              role: f.members.find((m) => m.person.personId === user.personId)!.role,
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
          json: [...family.members].sort(byPerson).map((m) => ({
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
          json: this.tasks.filter((t) => t.familyId === tasks[1]),
        });
      }

      const write = /^\/api\/families\/([^/]+)\/tasks\/([^/]+)\/(done|reopen|cancel)$/.exec(path);
      if (write && method === 'POST') {
        if (this.writeDelayMs > 0) await sleep(this.writeDelayMs);
        const scripted = this.writeScript.shift();
        if (scripted === 'abort') return route.abort('failed');
        if (scripted) {
          scripted.effect?.();
          return route.fulfill({ status: scripted.status, json: scripted.json ?? {} });
        }
        const found = this.mine(user, write[1])
          ? this.tasks.find((t) => t.id === write[2] && t.familyId === write[1])
          : undefined;
        if (!found) return route.fulfill({ status: 404, json: { error: 'not_found' } });
        const body = request.postDataJSON() as { mutationId: string };
        if (this.seen.get(body.mutationId) === found.id) {
          return route.fulfill({ status: 200, json: found });
        }
        const action = write[3] as keyof typeof ACTIONS;
        const wanted = action === 'reopen' ? 'DONE' : 'OPEN';
        if (found.status !== wanted) {
          const error = action === 'reopen' ? 'not_done' : 'not_open';
          return route.fulfill({ status: 409, json: { error } });
        }
        found.status = ACTIONS[action];
        found.completedBy = action === 'done' ? user.personId : null;
        found.version += 1;
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

  async openSession(person: Person): Promise<void> {
    this.user = person;
    await this.context.addCookies([
      { name: 'pfh_csrf', value: CSRF, domain: 'localhost', path: '/', sameSite: 'Lax' },
    ]);
  }

  calls(method: string, path: string): Request[] {
    return this.requests.filter((r) => r.method() === method && new URL(r.url()).pathname === path);
  }

  /** Changes a task behind the client's back, as another person would. */
  setStatus(id: string, status: Status, by: Person | null): void {
    const found = this.tasks.find((t) => t.id === id)!;
    found.status = status;
    found.completedBy = status === 'DONE' && by ? by.personId : null;
    found.version += 1;
  }
}
