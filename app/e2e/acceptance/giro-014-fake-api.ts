import type { BrowserContext, Page, Request } from '@playwright/test';

// Round 014, T6 part 2 (app side): the fake API of the recurring tasks. It lives in the browser
// (`page.route('**/api/**')`) and answers like the server after round 014:
// - POST …/tasks keeps `dueKind`, `due`, `recurrence`; a recurring task is the first of its series;
// - `done` and `cancel` on a recurring OPEN task create the next occurrence (same series, title,
//   assignee, creator), only if the series has no later due yet (decision 46);
// - `end-series` checks P10 (manager of the family or creator of the series) and cancels every
//   OPEN occurrence of the series in the family (choice (a) of the plan).
// The date of the next occurrence is computed with the fake clock `now`, never with the clock of
// Node: the tests set it to the same instant as the clock of the browser. Only DATE rules are
// computed exactly; a DATETIME moves by whole days (no test closes a DATETIME occurrence).
// Demo data (invented): Appendix A, ids of round 011 for the people.

export const CSRF = 'csrf-finto-giro014';
const EXPIRES_AT = '2031-02-05T08:00:00Z';
const UPDATED_AT = '2031-01-05T08:00:00Z';
export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Monday 6 January 2031, 08:00Z: the clock of the creation tests. */
export const MONDAY = '2031-01-06T08:00:00Z';
/** Thursday 9 January 2031, 10:00Z: the clock of the tests on «Next» and on the actions. */
export const THURSDAY = '2031-01-09T10:00:00Z';

export const PRINCIPALE = '0192a3b4-0000-7000-8000-0000000000f1';
export const MAMMA = '0192a3b4-0000-7000-8000-0000000000f2';
/** Famiglia Zio (America/New_York): Giulia manages it, it has no tasks. */
export const ZIO = '0192a3b4-0000-7000-8000-0000000000f4';

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
const PIETRO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a5', displayName: 'Pietro' };

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
    timeZone: 'America/New_York',
    members: [account(ANNA, 'MANAGER'), account(PIETRO, 'MANAGER'), account(GIULIA, 'MEMBER')],
  },
  {
    id: ZIO,
    name: 'Famiglia Zio',
    timeZone: 'America/New_York',
    members: [account(GIULIA, 'MANAGER')],
  },
];

export type Status = 'OPEN' | 'DONE' | 'CANCELLED';
export type Day =
  'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type Rule =
  | { type: 'DAILY'; time?: string }
  | { type: 'EVERY_N_DAYS'; interval: number; time?: string }
  | { type: 'WEEKLY'; days: Day[]; time?: string }
  | { type: 'MONTHLY'; dayOfMonth: number; time?: string };

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
};

// Famiglia Principale (Europe/Rome).
export const CARTA = 'Mettere fuori la carta';
export const AFFITTO = "Pagare l'affitto";
export const GATTO = 'Dare la medicina al gatto';
export const PIANTE = 'Annaffiare le piante';
export const PANE = 'Comprare il pane';
export const CANE = 'Portare fuori il cane';
// Famiglia Mamma (America/New_York): Giulia is a member.
export const FRIGO = 'Pulire il frigo';

export const CARTA_ID = '0192a3b4-0000-7000-8000-000000001401';
export const AFFITTO_ID = '0192a3b4-0000-7000-8000-000000001402';
export const GATTO_ID = '0192a3b4-0000-7000-8000-000000001403';
export const PIANTE_ID = '0192a3b4-0000-7000-8000-000000001404';
export const PANE_ID = '0192a3b4-0000-7000-8000-000000001405';
export const CANE_ID = '0192a3b4-0000-7000-8000-000000001406';
export const CANE_NEXT_ID = '0192a3b4-0000-7000-8000-000000001407';
export const FRIGO_ID = '0192a3b4-0000-7000-8000-000000001408';

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

const date = (due: string) => ({ dueKind: 'DATE' as const, due });
const first = (id: string, recurrence: Rule) => ({ recurrence, seriesId: id });

function startingTasks(): Task[] {
  const g = GIULIA.personId;
  const m = MARCO.personId;
  return [
    task(CARTA_ID, PRINCIPALE, CARTA, {
      createdBy: m,
      assigneePersonId: m,
      ...date('2031-01-07'),
      ...first(CARTA_ID, { type: 'WEEKLY', days: ['TUESDAY'] }),
    }),
    task(AFFITTO_ID, PRINCIPALE, AFFITTO, {
      createdBy: g,
      ...date('2031-01-31'),
      ...first(AFFITTO_ID, { type: 'MONTHLY', dayOfMonth: 31 }),
    }),
    task(GATTO_ID, PRINCIPALE, GATTO, {
      createdBy: g,
      assigneePersonId: g,
      dueKind: 'DATETIME',
      due: '2031-03-29T06:00:00Z',
      ...first(GATTO_ID, { type: 'DAILY', time: '07:00' }),
    }),
    task(PIANTE_ID, PRINCIPALE, PIANTE, {
      createdBy: g,
      assigneePersonId: g,
      ...date('2031-01-07'),
      ...first(PIANTE_ID, { type: 'EVERY_N_DAYS', interval: 3 }),
    }),
    task(PANE_ID, PRINCIPALE, PANE, { createdBy: g, assigneePersonId: g, ...date('2031-01-08') }),
    // Done on the 7th, then reopened: the next occurrence of the 8th is already there.
    task(CANE_ID, PRINCIPALE, CANE, {
      createdBy: m,
      assigneePersonId: m,
      version: 3,
      ...date('2031-01-07'),
      ...first(CANE_ID, { type: 'DAILY' }),
    }),
    task(CANE_NEXT_ID, PRINCIPALE, CANE, {
      createdBy: m,
      assigneePersonId: m,
      ...date('2031-01-08'),
      recurrence: { type: 'DAILY' },
      seriesId: CANE_ID,
    }),
    task(FRIGO_ID, MAMMA, FRIGO, {
      createdBy: ANNA.personId,
      assigneePersonId: g,
      ...date('2031-01-07'),
      ...first(FRIGO_ID, { type: 'WEEKLY', days: ['TUESDAY', 'FRIDAY'] }),
    }),
  ];
}

// ---------------------------------------------------------------- dates of the fake server

const DAYS: Day[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** `yyyy-mm-dd` of an instant in a zone (en-CA formats the date that way). */
function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

function plusDays(day: string, n: number): string {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
}

function step(day: string, rule: Rule): string {
  switch (rule.type) {
    case 'DAILY':
      return plusDays(day, 1);
    case 'EVERY_N_DAYS':
      return plusDays(day, rule.interval);
    case 'WEEKLY': {
      let next = plusDays(day, 1);
      while (!rule.days.includes(DAYS[new Date(`${next}T00:00:00Z`).getUTCDay()])) {
        next = plusDays(next, 1);
      }
      return next;
    }
    case 'MONTHLY': {
      const [y, mo] = day.split('-').map(Number);
      const year = mo === 12 ? y + 1 : y;
      const month = mo === 12 ? 1 : mo + 1;
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const d = Math.min(rule.dayOfMonth, last);
      return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** An answer the test decides for the next write, instead of the fake server. */
export type Scripted = 'abort' | { status: number; json?: unknown; effect?: () => void };

const ACTIONS = { done: 'DONE', reopen: 'OPEN', cancel: 'CANCELLED' } as const;

export class FakeApi {
  user: Person | undefined;
  tasks: Task[] = startingTasks();
  /** The clock of the fake server: set it to the clock of the browser. */
  now: string = MONDAY;
  readDelayMs = 0;
  readonly writeScript: Scripted[] = [];
  readonly createScript: Scripted[] = [];
  readonly requests: Request[] = [];
  private readonly seen = new Map<string, string>(); // mutationId -> task id
  private nextIds = 0;

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
        const snapshot = JSON.parse(
          JSON.stringify(this.tasks.filter((t) => t.familyId === tasks[1])),
        ) as Task[];
        if (this.readDelayMs > 0) await sleep(this.readDelayMs);
        return route.fulfill({ status: 200, json: snapshot });
      }
      if (tasks && method === 'POST') {
        const family = this.mine(user, tasks[1]);
        if (!family) return route.fulfill({ status: 404, json: { error: 'not_found' } });
        const scripted = this.createScript.shift();
        if (scripted === 'abort') return route.abort('failed');
        if (scripted) {
          scripted.effect?.();
          return route.fulfill({ status: scripted.status, json: scripted.json ?? {} });
        }
        const body = request.postDataJSON() as {
          id: string;
          mutationId: string;
          title: string;
          dueKind?: 'DATE' | 'DATETIME' | null;
          due?: string | null;
          recurrence?: Rule | null;
        };
        const replayed = this.seen.get(body.mutationId);
        if (replayed) {
          return route.fulfill({ status: 200, json: this.tasks.find((t) => t.id === replayed) });
        }
        if (body.recurrence && !body.due) {
          return route.fulfill({ status: 400, json: { error: 'recurrence_needs_due' } });
        }
        let recurrence: Rule | null = body.recurrence ?? null;
        if (recurrence && body.dueKind === 'DATETIME' && body.due) {
          const at = new Date(body.due);
          const hm = new Intl.DateTimeFormat('en-GB', {
            timeZone: family.timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(at);
          recurrence = { ...recurrence, time: hm };
        }
        const created = task(body.id, family.id, body.title, {
          createdBy: user.personId,
          dueKind: body.dueKind ?? null,
          due: body.due ?? null,
          recurrence,
          seriesId: recurrence ? body.id : null,
        });
        this.tasks.push(created);
        this.seen.set(body.mutationId, created.id);
        return route.fulfill({ status: 201, json: created });
      }

      const write =
        /^\/api\/families\/([^/]+)\/tasks\/([^/]+)\/(done|reopen|cancel|end-series)$/.exec(path);
      if (write && method === 'POST') {
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
        const body = request.postDataJSON() as { mutationId: string };
        if (this.seen.get(body.mutationId) === found.id) {
          return route.fulfill({ status: 200, json: found });
        }
        const action = write[3];
        if (action === 'end-series') {
          if (!found.seriesId)
            return route.fulfill({ status: 409, json: { error: 'not_recurring' } });
          if (found.status !== 'OPEN')
            return route.fulfill({ status: 409, json: { error: 'not_open' } });
          if (this.roleOf(user, family) !== 'MANAGER' && found.createdBy !== user.personId) {
            return route.fulfill({ status: 403, json: { error: 'forbidden' } });
          }
          for (const t of this.tasks) {
            if (t.familyId === family.id && t.seriesId === found.seriesId && t.status === 'OPEN') {
              t.status = 'CANCELLED';
              t.version += 1;
              t.updatedAt = this.now;
            }
          }
          this.seen.set(body.mutationId, found.id);
          return route.fulfill({ status: 200, json: found });
        }
        const key = action as keyof typeof ACTIONS;
        const wanted = key === 'reopen' ? 'DONE' : 'OPEN';
        if (found.status !== wanted) {
          const error = key === 'reopen' ? 'not_done' : 'not_open';
          return route.fulfill({ status: 409, json: { error } });
        }
        found.status = ACTIONS[key];
        found.completedBy = key === 'done' ? user.personId : null;
        found.version += 1;
        found.updatedAt = this.now;
        this.seen.set(body.mutationId, found.id);
        if (key !== 'reopen') this.nextOccurrence(found, family);
        return route.fulfill({ status: 200, json: found });
      }
      return route.fulfill({ status: 404, json: { error: 'not_found' } });
    });
  }

  /** Decision 46: the next occurrence, unless the series already has a later due. */
  private nextOccurrence(closed: Task, family: Family): void {
    if (!closed.recurrence || !closed.seriesId || !closed.due || !closed.dueKind) return;
    const later = this.tasks.some(
      (t) =>
        t.familyId === family.id &&
        t.seriesId === closed.seriesId &&
        t.due !== null &&
        new Date(t.due).getTime() > new Date(closed.due!).getTime(),
    );
    if (later) return;
    const now = new Date(this.now);
    const today = localDate(now, family.timeZone);
    let due: string;
    if (closed.dueKind === 'DATE') {
      let day = step(closed.due, closed.recurrence);
      while (day < today) day = step(day, closed.recurrence);
      due = day;
    } else {
      // Whole days only: enough for the fake, no test closes a DATETIME occurrence.
      const from = localDate(new Date(closed.due), family.timeZone);
      let day = step(from, closed.recurrence);
      const shift = (d: string) =>
        new Date(
          new Date(closed.due!).getTime() +
            (new Date(`${d}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()),
        );
      while (shift(day).getTime() <= now.getTime()) day = step(day, closed.recurrence);
      due = shift(day).toISOString().replace('.000Z', 'Z');
    }
    this.nextIds += 1;
    this.tasks.push(
      task(
        `0192a3b4-0000-7000-8000-0000000015${String(this.nextIds).padStart(2, '0')}`,
        family.id,
        closed.title,
        {
          createdBy: closed.createdBy,
          assigneePersonId: closed.assigneePersonId,
          criticality: closed.criticality,
          dueKind: closed.dueKind,
          due,
          recurrence: closed.recurrence,
          seriesId: closed.seriesId,
          updatedAt: this.now,
        },
      ),
    );
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
