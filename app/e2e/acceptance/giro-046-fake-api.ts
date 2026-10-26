import type { BrowserContext, Page, Request } from '@playwright/test';

// Round 046, T13 part 1 (docs/lab/giri/046-piano.md): the fake API of «All my families» with the
// demo data of the plan. It lives in the browser (`page.route('**/api/**')`) and answers like the
// server: `done`, `reopen`, `take`, `PUT …/assignee` change the task and raise the version; a
// replayed `mutationId` gets the same answer; `done` on a recurring task creates the next
// occurrence; P7 and P6 are checked for a MEMBER. Knobs script the answers the server decides (403,
// 404, 409) and slow or lost answers. Demo data invented (SPEC Appendix A, ids of round 007).

export const CSRF = 'csrf-finto-giro046';
const EXPIRES_AT = '2031-02-05T08:00:00Z';
const UPDATED_AT = '2026-10-20T08:00:00Z';
export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Tuesday 3 November 2026, 04:00 in Rome, Monday 2 November 22:00 in New York. */
export const NOW = '2026-11-03T03:00:00Z';

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
export const PAOLO: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a6',
  displayName: 'Paolo',
};
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
type Rule = { type: 'WEEKLY'; days: string[] };

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
  recurrence: Rule | null;
  seriesId: string | null;
  template: 'NONE';
  lastNudgedAt: string | null;
};

export const ZAINO = 'Preparare lo zaino';
export const FOTO = 'Portare le foto alla nonna';
export const LIBRI = 'Restituire i libri';
export const MENSA = 'Pagare la mensa';
export const CARTA = 'Mettere fuori la carta';
export const REGALO = 'Comprare il regalo per Anna';
export const PRANZO = 'Prenotare il pranzo di Natale';
export const SPESA = 'Lista della spesa';
export const BICI = 'Riparare la bici di Sofia';
export const DIVANO = 'Spostare il divano';
export const DOCUMENTO = "Rinnovare la carta d'identità di Franco";

export const ZAINO_ID = '0192a3b4-0000-7000-8000-000000046c01';
export const FOTO_ID = '0192a3b4-0000-7000-8000-000000046c02';
export const LIBRI_ID = '0192a3b4-0000-7000-8000-000000046c03';
export const MENSA_ID = '0192a3b4-0000-7000-8000-000000046c04';
export const CARTA_ID = '0192a3b4-0000-7000-8000-000000046c05';
export const REGALO_ID = '0192a3b4-0000-7000-8000-000000046c06';
export const PRANZO_ID = '0192a3b4-0000-7000-8000-000000046c07';
export const SPESA_ID = '0192a3b4-0000-7000-8000-000000046c08';
export const BICI_ID = '0192a3b4-0000-7000-8000-000000046c09';
export const DIVANO_ID = '0192a3b4-0000-7000-8000-000000046c0a';
export const DOCUMENTO_ID = '0192a3b4-0000-7000-8000-000000046c0b';
/** The id the fake server gives to the next occurrence of «Mettere fuori la carta». */
export const CARTA_NEXT_ID = '0192a3b4-0000-7000-8000-000000046c15';

/** The order of the plan: section by section, as the list must show them. */
export const SECTIONS_IT = ['In ritardo', 'Oggi', 'Prossimi', 'Senza scadenza', 'Chiusi'];
export const SECTIONS_EN = ['Overdue', 'Today', 'Upcoming', 'No due date', 'Closed'];
export const EXPECTED: string[][] = [
  [ZAINO],
  [FOTO, LIBRI, MENSA, CARTA],
  [REGALO, PRANZO],
  [SPESA],
  [BICI, DIVANO],
];

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

const date = (due: string) => ({ dueKind: 'DATE' as const, due });
const at = (due: string) => ({ dueKind: 'DATETIME' as const, due });

/** Shuffled on purpose: the order on screen must come from the client, not from the server. */
function startingTasks(): Task[] {
  const g = GIULIA.personId;
  return [
    task(DIVANO_ID, MAMMA, DIVANO, { createdBy: ANNA.personId, status: 'CANCELLED', version: 2 }),
    task(SPESA_ID, PRINCIPALE, SPESA, { createdBy: MARCO.personId }),
    task(CARTA_ID, PRINCIPALE, CARTA, {
      createdBy: MARCO.personId,
      assigneePersonId: MARCO.personId,
      recurrence: { type: 'WEEKLY', days: ['TUESDAY'] },
      seriesId: CARTA_ID,
      ...date('2026-11-03'),
    }),
    task(PRANZO_ID, MAMMA, PRANZO, {
      createdBy: ANNA.personId,
      criticality: 'HIGH',
      ...date('2026-12-20'),
    }),
    task(LIBRI_ID, MAMMA, LIBRI, {
      createdBy: ANNA.personId,
      assigneePersonId: g,
      criticality: 'LOW',
      ...date('2026-11-02'),
    }),
    task(DOCUMENTO_ID, BABBO, DOCUMENTO, { createdBy: ROSA.personId, ...date('2026-11-13') }),
    task(MENSA_ID, PRINCIPALE, MENSA, {
      createdBy: MARCO.personId,
      assigneePersonId: g,
      ...at('2026-11-03T16:00:00Z'),
    }),
    task(BICI_ID, PRINCIPALE, BICI, {
      createdBy: MARCO.personId,
      assigneePersonId: g,
      status: 'DONE',
      completedBy: g,
      version: 2,
      ...date('2026-11-01'),
    }),
    task(REGALO_ID, MAMMA, REGALO, {
      createdBy: PIETRO.personId,
      assigneePersonId: g,
      ...date('2026-11-03'),
    }),
    task(ZAINO_ID, PRINCIPALE, ZAINO, {
      createdBy: g,
      assigneePersonId: LEO.personId,
      ...at('2026-11-02T17:30:00Z'),
    }),
    task(FOTO_ID, MAMMA, FOTO, {
      createdBy: ANNA.personId,
      assigneePersonId: g,
      criticality: 'HIGH',
      ...date('2026-11-02'),
    }),
  ];
}

const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : 1);
const byPerson = (a: Member, b: Member) => (a.person.displayName < b.person.displayName ? -1 : 1);
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** An answer the test decides for the next write, instead of the fake server. */
export type Scripted = 'abort' | { status: number; json?: unknown; effect?: () => void };

const ACTIONS = { done: 'DONE', reopen: 'OPEN' } as const;

export class FakeApi {
  user: Person | undefined;
  tasks: Task[] = startingTasks();
  writeDelayMs = 0;
  readonly writeScript: Scripted[] = [];
  readonly requests: Request[] = [];
  private readonly seen = new Map<string, Task>(); // mutationId -> answer

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
              role: this.roleIn(f, user),
            })),
        });
      }
      if (method === 'GET' && path === '/api/tasks') {
        const mine = new Set(this.familiesOf(user).map((f) => f.id));
        return route.fulfill({ status: 200, json: this.tasks.filter((t) => mine.has(t.familyId)) });
      }
      if (method === 'GET' && path === '/api/me/devices') {
        return route.fulfill({ status: 200, json: [] });
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

      const list = /^\/api\/families\/([^/]+)\/tasks$/.exec(path);
      if (list && method === 'GET') {
        if (!this.mine(user, list[1]))
          return route.fulfill({ status: 404, json: { error: 'not_found' } });
        return route.fulfill({
          status: 200,
          json: this.tasks.filter((t) => t.familyId === list[1]),
        });
      }

      const write = /^\/api\/families\/([^/]+)\/tasks\/([^/]+)\/(done|reopen|take|assignee)$/.exec(
        path,
      );
      if (write && (method === 'POST' || method === 'PUT')) {
        if (this.writeDelayMs > 0) await sleep(this.writeDelayMs);
        const scripted = this.writeScript.shift();
        if (scripted === 'abort') return route.abort('failed');
        if (scripted) {
          scripted.effect?.();
          return route.fulfill({ status: scripted.status, json: scripted.json ?? {} });
        }
        const family = this.mine(user, write[1]);
        const found = family
          ? this.tasks.find((t) => t.id === write[2] && t.familyId === write[1])
          : undefined;
        if (!family || !found) return route.fulfill({ status: 404, json: { error: 'not_found' } });
        const body = request.postDataJSON() as {
          mutationId: string;
          assigneePersonId?: string | null;
        };
        const replay = this.seen.get(body.mutationId);
        if (replay) return route.fulfill({ status: 200, json: replay });

        const action = write[3];
        const manager = this.roleIn(family, user) === 'MANAGER';
        const own = found.assigneePersonId === user.personId;
        if (action === 'take') {
          if (found.status !== 'OPEN')
            return route.fulfill({ status: 409, json: { error: 'not_open' } });
          if (found.assigneePersonId) {
            const name = this.nameOf(found.assigneePersonId);
            return route.fulfill({
              status: 409,
              json: {
                error: 'already_taken',
                assigneePersonId: found.assigneePersonId,
                assigneeName: name,
              },
            });
          }
          found.assigneePersonId = user.personId;
        } else if (action === 'assignee') {
          // Only «back in the queue» is used here (P6: a member only for a task of their own).
          if (body.assigneePersonId !== null || (!manager && !own)) {
            return route.fulfill({ status: 403, json: { error: 'forbidden' } });
          }
          if (found.status !== 'OPEN')
            return route.fulfill({ status: 409, json: { error: 'not_open' } });
          found.assigneePersonId = null;
        } else {
          const verb = action as keyof typeof ACTIONS;
          // P7: a member marks done only a task assigned to them or to one of their resources.
          const referent = family.members.some(
            (m) =>
              m.person.personId === found.assigneePersonId && m.referentPersonId === user.personId,
          );
          if (!manager && !own && !referent) {
            return route.fulfill({ status: 403, json: { error: 'forbidden' } });
          }
          const wanted = verb === 'reopen' ? 'DONE' : 'OPEN';
          if (found.status !== wanted) {
            return route.fulfill({
              status: 409,
              json: { error: verb === 'reopen' ? 'not_done' : 'not_open' },
            });
          }
          found.status = ACTIONS[verb];
          found.completedBy = verb === 'done' ? user.personId : null;
          // The server reopens only the occurrence that was done; the next one stays.
          if (verb === 'done') this.nextOccurrence(found);
        }
        found.version += 1;
        const answer = { ...found };
        this.seen.set(body.mutationId, answer);
        return route.fulfill({ status: 200, json: answer });
      }
      return route.fulfill({ status: 404, json: { error: 'not_found' } });
    });
  }

  /** Done on «Mettere fuori la carta» (every Tuesday) creates the occurrence of 10 November. */
  private nextOccurrence(closed: Task): void {
    if (closed.id !== CARTA_ID || this.tasks.some((t) => t.id === CARTA_NEXT_ID)) return;
    this.tasks.push({
      ...closed,
      id: CARTA_NEXT_ID,
      status: 'OPEN',
      completedBy: null,
      version: 1,
      due: '2026-11-10',
    });
  }

  familiesOf(person: Person): Family[] {
    return FAMILIES.filter((f) => f.members.some((m) => m.person.personId === person.personId));
  }

  mine(person: Person, familyId: string): Family | undefined {
    return this.familiesOf(person).find((f) => f.id === familyId);
  }

  private roleIn(family: Family, person: Person): Role {
    return family.members.find((m) => m.person.personId === person.personId)!.role;
  }

  private nameOf(personId: string): string {
    for (const f of FAMILIES) {
      const m = f.members.find((x) => x.person.personId === personId);
      if (m) return m.person.displayName;
    }
    return '?';
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

  find(id: string): Task {
    return this.tasks.find((t) => t.id === id)!;
  }

  /** Changes a task behind the client's back, as another person would. */
  change(id: string, fields: Partial<Task>): void {
    const found = this.find(id);
    Object.assign(found, fields);
    found.version += 1;
  }

  remove(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }
}

export const taskPath = (familyId: string, taskId: string, action: string) =>
  `/api/families/${familyId}/tasks/${taskId}/${action}`;
