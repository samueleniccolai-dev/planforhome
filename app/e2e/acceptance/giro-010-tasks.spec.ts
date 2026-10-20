import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Request,
} from '@playwright/test';

// Round 010, T5 part 2 (app side): the tasks of a family and of all my families on the web. As in
// rounds 004 and 007 the API is faked in the browser (`page.route('**/api/**')`); it keeps a
// session and a task state and answers like the server of round 008: 201 for a new task, 200 for
// a replayed mutationId, 404 on a family the caller is not in, 409 `already_taken`. Knobs script
// the answers the server decides (403, 409, 404) and the network errors. The browser runs in
// Asia/Tokyo, neither Rome nor New York: a date shown in the device zone is wrong. Elements are
// found by role and accessible name; the texts are the ones decided in the plan. Demo data
// (invented): Appendix A of the SPEC, with the ids of round 007.

const SCREENSHOTS = 'e2e-screenshots';
const CSRF = 'csrf-finto-giro010';
const EXPIRES_AT = '2031-02-05T08:00:00Z';
const UPDATED_AT = '2026-10-20T08:00:00Z';
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PRINCIPALE = '0192a3b4-0000-7000-8000-0000000000f1';
const MAMMA = '0192a3b4-0000-7000-8000-0000000000f2';
const BABBO = '0192a3b4-0000-7000-8000-0000000000f3';

type Person = { personId: string; displayName: string; email?: string };

const GIULIA: Person = {
  personId: '0192a3b4-0000-7000-8000-000000000004',
  displayName: 'Giulia',
  email: 'giulia@example.com',
};
const LUCA: Person = {
  personId: '0192a3b4-0000-7000-8000-000000000005',
  displayName: 'Luca',
  email: 'luca@example.com',
};
const MARCO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a1', displayName: 'Marco' };
const LEO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a2', displayName: 'Leo' };
const SOFIA: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a3', displayName: 'Sofia' };
const ANNA: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a4', displayName: 'Anna' };
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

// Mamma is in New York only here, to prove that each task is shown in the zone of its family.
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

type Task = {
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
  version: number;
  updatedAt: string;
};

const ZAINO = 'Preparare lo zaino';
const LUNCH = 'Prenotare il pranzo di Natale';
const GIFTS = 'Comprare i regali';
const ID_CARD = "Rinnovare la carta d'identità di Franco";

const ZAINO_ID = '0192a3b4-0000-7000-8000-0000000000b1';
const LUNCH_ID = '0192a3b4-0000-7000-8000-0000000000b2';
const GIFTS_ID = '0192a3b4-0000-7000-8000-0000000000b3';
const ID_CARD_ID = '0192a3b4-0000-7000-8000-0000000000b4';

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
    version: 1,
    updatedAt: UPDATED_AT,
    ...fields,
  };
}

/** The tasks of the fake server; «Preparare lo zaino» only where a test needs it already there. */
function startingTasks(withZaino: boolean): Task[] {
  const tasks = [
    task(LUNCH_ID, MAMMA, LUNCH, {
      createdBy: ANNA.personId,
      criticality: 'HIGH',
      dueKind: 'DATE',
      due: '2026-12-20',
    }),
    task(GIFTS_ID, MAMMA, GIFTS, {
      createdBy: ANNA.personId,
      assigneePersonId: GIULIA.personId,
      dueKind: 'DATETIME',
      due: '2026-11-01T16:00:00Z', // the day New York leaves daylight saving time
    }),
    task(ID_CARD_ID, BABBO, ID_CARD, {
      createdBy: ROSA.personId,
      dueKind: 'DATE',
      due: '2026-11-13',
    }),
  ];
  if (withZaino) {
    tasks.unshift(
      task(ZAINO_ID, PRINCIPALE, ZAINO, {
        createdBy: GIULIA.personId,
        dueKind: 'DATETIME',
        due: '2026-11-03T17:30:00Z',
      }),
    );
  }
  return tasks;
}

const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : 1);
const byPerson = (a: Member, b: Member) =>
  a.person.displayName === b.person.displayName
    ? a.person.personId < b.person.personId
      ? -1
      : 1
    : a.person.displayName < b.person.displayName
      ? -1
      : 1;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** An answer the test decides for the next write (assign or take), instead of the fake server. */
type Scripted = 'abort' | { status: number; json?: unknown; effect?: () => void };

type Texts = {
  locale: string;
  lang: string;
  people: string;
  notFound: string;
  tasks: string;
  newTitle: string;
  add: string;
  familyTasks: string;
  noTasks: string;
  queue: string;
  assigned: (name: string) => string;
  normal: string;
  high: string;
  due: (date: string) => string;
  dueWord: string;
  take: string;
  assign: string;
  assignTo: (name: string) => string;
  requeue: string;
  forbidden: string;
  taken: (name: string) => string;
  failed: string;
  tasksError: string;
  allFamilies: string;
  allTasks: string;
};

const cases: Texts[] = [
  {
    locale: 'it-IT',
    lang: 'it',
    people: 'Persone',
    notFound: 'Famiglia non trovata.',
    tasks: 'Task',
    newTitle: 'Titolo del nuovo task',
    add: 'Aggiungi task',
    familyTasks: 'Task della famiglia',
    noTasks: 'Nessun task.',
    queue: 'In coda',
    assigned: (name) => `Assegnato a ${name}`,
    normal: 'Criticità: normale',
    high: 'Criticità: alta',
    due: (date) => `Scadenza: ${date}`,
    dueWord: 'Scadenza',
    take: 'Prendo io',
    assign: 'Assegna',
    assignTo: (name) => `Assegna a ${name}`,
    requeue: 'Rimetti in coda',
    forbidden: 'Non hai il permesso di farlo.',
    taken: (name) => `Già preso da ${name}.`,
    failed: 'Qualcosa non ha funzionato. Riprova.',
    tasksError: 'Impossibile caricare i task. Riprova.',
    allFamilies: 'Tutte le mie famiglie',
    allTasks: 'Task di tutte le mie famiglie',
  },
  {
    locale: 'en-US',
    lang: 'en',
    people: 'People',
    notFound: 'Family not found.',
    tasks: 'Tasks',
    newTitle: 'New task title',
    add: 'Add task',
    familyTasks: 'Family tasks',
    noTasks: 'No tasks.',
    queue: 'In queue',
    assigned: (name) => `Assigned to ${name}`,
    normal: 'Criticality: normal',
    high: 'Criticality: high',
    due: (date) => `Due: ${date}`,
    dueWord: 'Due',
    take: "I'll take it",
    assign: 'Assign',
    assignTo: (name) => `Assign to ${name}`,
    requeue: 'Put back in queue',
    forbidden: "You're not allowed to do that.",
    taken: (name) => `Already taken by ${name}.`,
    failed: 'Something went wrong. Try again.',
    tasksError: "Couldn't load the tasks. Try again.",
    allFamilies: 'All my families',
    allTasks: 'Tasks of all my families',
  },
];

/** The fake API: a session for Giulia or Luca, a task state, knobs for errors and slow answers. */
class FakeApi {
  user: Person | undefined;
  tasks: Task[];
  readonly membersStatus = new Map<string, number>();
  readonly tasksStatus = new Map<string, number>();
  createDelayMs = 0;
  /** Next creations: 'fail' = lost before the server; 'saveThenFail' = saved, answer lost. */
  readonly createScript: ('fail' | 'saveThenFail')[] = [];
  readonly writeScript: Scripted[] = [];
  readonly requests: Request[] = [];
  private readonly seen = new Map<string, string>(); // mutationId -> task id

  constructor(
    private readonly page: Page,
    private readonly context: BrowserContext,
    withZaino: boolean,
  ) {
    this.tasks = startingTasks(withZaino);
  }

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
        return route.fulfill({
          status: 200,
          json: this.tasks.filter((t) => mine.has(t.familyId)),
        });
      }

      const members = /^\/api\/families\/([^/]+)\/members$/.exec(path);
      if (method === 'GET' && members) {
        const forced = this.membersStatus.get(members[1]);
        if (forced) return route.fulfill({ status: forced, json: { error: 'forced' } });
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
        const forced = this.tasksStatus.get(tasks[1]);
        if (forced) return route.fulfill({ status: forced, json: { error: 'forced' } });
        if (!this.mine(user, tasks[1])) {
          return route.fulfill({ status: 404, json: { error: 'not_found' } });
        }
        return route.fulfill({
          status: 200,
          json: this.tasks.filter((t) => t.familyId === tasks[1]),
        });
      }
      if (tasks && method === 'POST') {
        if (this.createDelayMs > 0) await sleep(this.createDelayMs);
        const family = this.mine(user, tasks[1]);
        if (!family) return route.fulfill({ status: 404, json: { error: 'not_found' } });
        const step = this.createScript.shift();
        if (step === 'fail') return route.abort('failed');
        const body = request.postDataJSON() as { id: string; mutationId: string; title: string };
        const replayed = this.seen.get(body.mutationId);
        if (replayed) {
          return route.fulfill({ status: 200, json: this.tasks.find((t) => t.id === replayed) });
        }
        const created = task(body.id, family.id, body.title, { createdBy: user.personId });
        this.tasks.push(created);
        this.seen.set(body.mutationId, created.id);
        if (step === 'saveThenFail') return route.abort('failed');
        return route.fulfill({ status: 201, json: created });
      }

      const write = /^\/api\/families\/([^/]+)\/tasks\/([^/]+)\/(assignee|take)$/.exec(path);
      if (write && (method === 'PUT' || method === 'POST')) {
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
        const body = request.postDataJSON() as { assigneePersonId?: string | null };
        found.assigneePersonId = write[3] === 'take' ? user.personId : body.assigneePersonId!;
        found.version += 1;
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

  setTask(id: string, assignee: Person): void {
    const found = this.tasks.find((t) => t.id === id)!;
    found.assigneePersonId = assignee.personId;
    found.version += 1;
  }
}

function familyTasks(page: Page, c: Texts): Locator {
  return page.getByRole('list', { name: c.familyTasks, exact: true });
}

/** The list item of one task, found by its exact title. */
function item(list: Locator, title: string): Locator {
  return list.getByRole('listitem').filter({ has: list.page().getByText(title, { exact: true }) });
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

async function openFamily(page: Page, c: Texts, familyId: string, name: string): Promise<void> {
  await page.goto(`/family?id=${familyId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.getByRole('heading', { level: 2, name: c.tasks, exact: true })).toBeVisible();
}

function createBodies(api: FakeApi, familyId: string): Record<string, unknown>[] {
  return api
    .calls('POST', `/api/families/${familyId}/tasks`)
    .map((r) => r.postDataJSON() as Record<string, unknown>);
}

test('the static tasks page carries no warning before the session is known', () => {
  const html = resolve(test.info().project.testDir, '..', 'dist', 'tasks.html');
  expect(existsSync(html), `${html} must be exported by expo export`).toBe(true);
  const body = readFileSync(html, 'utf8');
  for (const text of [
    'Impossibile caricare',
    "Couldn't load",
    'Qualcosa non ha funzionato',
    'Something went wrong',
    'Non hai il permesso',
    'not allowed',
    'Famiglia non trovata.',
    'Family not found.',
  ]) {
    expect(body).not.toContain(text);
  }
});

for (const c of cases) {
  test.describe(`device language ${c.locale}, device zone Asia/Tokyo`, () => {
    test.use({ locale: c.locale, timezoneId: 'Asia/Tokyo' });

    let api: FakeApi;
    const start = async (page: Page, context: BrowserContext, who: Person, withZaino = false) => {
      api = new FakeApi(page, context, withZaino);
      await api.install();
      await api.openSession(who);
    };

    // ------------------------------------------------------------ creating

    test('Giulia creates a task with its title only, in two actions', async ({ page, context }) => {
      await start(page, context, GIULIA);
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      const list = familyTasks(page, c);
      await expect(page.getByText(c.noTasks, { exact: true })).toBeVisible();
      await expect(list.getByRole('listitem')).toHaveCount(0);

      const field = page.getByLabel(c.newTitle, { exact: true });
      const add = button(page, c.add);
      await expect(add).toBeDisabled();
      await field.fill('   ');
      await expect(add).toBeDisabled();

      await field.fill(ZAINO); // action 1
      await add.click(); // action 2

      const created = item(list, ZAINO);
      await expect(created).toHaveCount(1);
      await expect(created).toContainText(c.queue);
      await expect(created).toContainText(c.normal);
      await expect(created).not.toContainText(c.dueWord);
      await expect(field).toHaveValue('');
      await expect(page.getByText(c.noTasks, { exact: true })).toHaveCount(0);

      const posts = api.calls('POST', `/api/families/${PRINCIPALE}/tasks`);
      expect(posts).toHaveLength(1);
      const body = posts[0].postDataJSON() as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['id', 'mutationId', 'title']);
      expect(body.title).toBe(ZAINO);
      expect(body.id).toMatch(UUID_V7);
      expect(body.mutationId).toMatch(UUID_V7);
      expect(body.id).not.toBe(body.mutationId);
      expect(posts[0].headers()['x-csrf-token']).toBe(CSRF);
      await page.screenshot({ path: `${SCREENSHOTS}/tasks-family-${c.lang}.png`, fullPage: true });
    });

    test('a double click on a slow creation sends one request', async ({ page, context }) => {
      await start(page, context, GIULIA);
      api.createDelayMs = 500;
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      await page.getByLabel(c.newTitle, { exact: true }).fill(ZAINO);
      await button(page, c.add).dblclick();
      await expect(item(familyTasks(page, c), ZAINO)).toHaveCount(1);
      await page.waitForTimeout(1000);
      expect(api.calls('POST', `/api/families/${PRINCIPALE}/tasks`)).toHaveLength(1);
      await expect(item(familyTasks(page, c), ZAINO)).toHaveCount(1);
    });

    test('after a network error the same creation is sent again with the same ids', async ({
      page,
      context,
    }) => {
      await start(page, context, GIULIA);
      api.createScript.push('fail');
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      const field = page.getByLabel(c.newTitle, { exact: true });
      await field.fill(ZAINO);
      await button(page, c.add).click();
      await expect(page.getByRole('alert')).toHaveText(c.failed);
      await expect(field).toHaveValue(ZAINO);
      await expect(item(familyTasks(page, c), ZAINO)).toHaveCount(0);

      await button(page, c.add).click();
      await expect(item(familyTasks(page, c), ZAINO)).toHaveCount(1);
      await expect(field).toHaveValue('');
      const [first, second] = createBodies(api, PRINCIPALE);
      expect(second).toEqual(first);
    });

    test('a creation saved whose answer was lost is replayed: 200, shown once', async ({
      page,
      context,
    }) => {
      await start(page, context, GIULIA);
      api.createScript.push('saveThenFail');
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      const field = page.getByLabel(c.newTitle, { exact: true });
      await field.fill(ZAINO);
      await button(page, c.add).click();
      await expect(page.getByRole('alert')).toHaveText(c.failed);

      await button(page, c.add).click(); // the fake server answers 200 to the replay
      await expect(field).toHaveValue('');
      await expect(item(familyTasks(page, c), ZAINO)).toHaveCount(1);
      await expect(page.getByRole('alert')).toHaveCount(0);
      const bodies = createBodies(api, PRINCIPALE);
      expect(bodies).toHaveLength(2);
      expect(bodies[1]).toEqual(bodies[0]);
    });

    test('a title changed after a failure is a new task, with new ids', async ({
      page,
      context,
    }) => {
      const other = `${ZAINO} di Leo`;
      await start(page, context, GIULIA);
      api.createScript.push('fail');
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      const field = page.getByLabel(c.newTitle, { exact: true });
      await field.fill(ZAINO);
      await button(page, c.add).click();
      await expect(page.getByRole('alert')).toHaveText(c.failed);

      await field.fill(other);
      await button(page, c.add).click();
      await expect(item(familyTasks(page, c), other)).toHaveCount(1);
      const [first, second] = createBodies(api, PRINCIPALE);
      expect(second.title).toBe(other);
      expect(second.id).not.toBe(first.id);
      expect(second.mutationId).not.toBe(first.mutationId);
    });

    // ------------------------------------------------------------ assigning

    test('Giulia assigns a task to Leo, then puts it back in the queue', async ({
      page,
      context,
    }) => {
      await start(page, context, GIULIA, true);
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      const zaino = item(familyTasks(page, c), ZAINO);
      await expect(zaino).toContainText(c.queue);

      await button(zaino, c.assign).click();
      for (const name of ['Giulia', 'Leo', 'Marco', 'Sofia']) {
        await expect(button(zaino, c.assignTo(name))).toBeVisible();
      }
      await button(zaino, c.assignTo('Leo')).click();
      await expect(zaino).toContainText(c.assigned('Leo'));
      await expect(zaino).not.toContainText(c.queue);

      await button(zaino, c.assign).click();
      await button(zaino, c.requeue).click();
      await expect(zaino).toContainText(c.queue);
      await expect(zaino).not.toContainText(c.assigned('Leo'));

      const puts = api
        .calls('PUT', `/api/families/${PRINCIPALE}/tasks/${ZAINO_ID}/assignee`)
        .map((r) => r.postDataJSON() as Record<string, unknown>);
      expect(puts).toHaveLength(2);
      expect(Object.keys(puts[0]).sort()).toEqual(['assigneePersonId', 'mutationId']);
      expect(puts[0].assigneePersonId).toBe(LEO.personId);
      expect(puts[1].assigneePersonId).toBeNull();
      expect(puts[0].mutationId).toMatch(UUID_V7);
      expect(puts[1].mutationId).toMatch(UUID_V7);
      expect(puts[1].mutationId).not.toBe(puts[0].mutationId);
    });

    test('an assignment lost on the network and retried as is keeps its mutationId', async ({
      page,
      context,
    }) => {
      await start(page, context, GIULIA, true);
      api.writeScript.push('abort');
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      const zaino = item(familyTasks(page, c), ZAINO);
      await button(zaino, c.assign).click();
      await button(zaino, c.assignTo('Leo')).click();
      await expect(page.getByRole('alert')).toHaveText(c.failed);
      await expect(zaino).toContainText(c.queue);

      if ((await button(zaino, c.assignTo('Leo')).count()) === 0) {
        await button(zaino, c.assign).click();
      }
      await button(zaino, c.assignTo('Leo')).click();
      await expect(zaino).toContainText(c.assigned('Leo'));
      const puts = api
        .calls('PUT', `/api/families/${PRINCIPALE}/tasks/${ZAINO_ID}/assignee`)
        .map((r) => r.postDataJSON() as Record<string, unknown>);
      expect(puts).toHaveLength(2);
      expect(puts[1]).toEqual(puts[0]);
    });

    test('an assignment lost on the network, then changed to Marco, has a new mutationId', async ({
      page,
      context,
    }) => {
      await start(page, context, GIULIA, true);
      api.writeScript.push('abort');
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      const zaino = item(familyTasks(page, c), ZAINO);
      await button(zaino, c.assign).click();
      await button(zaino, c.assignTo('Leo')).click();
      await expect(page.getByRole('alert')).toHaveText(c.failed);

      if ((await button(zaino, c.assignTo('Marco')).count()) === 0) {
        await button(zaino, c.assign).click();
      }
      await button(zaino, c.assignTo('Marco')).click();
      await expect(zaino).toContainText(c.assigned('Marco'));
      const puts = api
        .calls('PUT', `/api/families/${PRINCIPALE}/tasks/${ZAINO_ID}/assignee`)
        .map((r) => r.postDataJSON() as Record<string, unknown>);
      expect(puts).toHaveLength(2);
      expect(puts[0].assigneePersonId).toBe(LEO.personId);
      expect(puts[1].assigneePersonId).toBe(MARCO.personId);
      expect(puts[1].mutationId).not.toBe(puts[0].mutationId);
    });

    test('the server decides: Luca asks to assign Davide and is refused', async ({
      page,
      context,
    }) => {
      await start(page, context, LUCA);
      api.writeScript.push({ status: 403, json: { error: 'forbidden' } });
      await openFamily(page, c, MAMMA, 'Famiglia Mamma');
      const lunch = item(familyTasks(page, c), LUNCH);
      await expect(lunch).toContainText(c.queue);

      await button(lunch, c.assign).click();
      await button(lunch, c.assignTo('Davide')).click();
      await expect(page.getByRole('alert')).toHaveText(c.forbidden);
      await expect(lunch).toContainText(c.queue);
      await expect(lunch).not.toContainText(c.assigned('Davide'));
      const puts = api.calls('PUT', `/api/families/${MAMMA}/tasks/${LUNCH_ID}/assignee`);
      expect(puts).toHaveLength(1);
      expect((puts[0].postDataJSON() as Record<string, unknown>).assigneePersonId).toBe(
        DAVIDE.personId,
      );
    });

    // ------------------------------------------------------------ the queue

    test('Giulia takes a task from the queue', async ({ page, context }) => {
      await start(page, context, GIULIA);
      await openFamily(page, c, MAMMA, 'Famiglia Mamma');
      const lunch = item(familyTasks(page, c), LUNCH);
      await expect(lunch).toContainText(c.queue);
      await expect(lunch).toContainText(c.high);
      await expect(lunch).toContainText(c.due('20/12/2026'));
      // Already assigned: nothing to take.
      await expect(button(item(familyTasks(page, c), GIFTS), c.take)).toHaveCount(0);

      await button(lunch, c.take).click();
      await expect(lunch).toContainText(c.assigned('Giulia'));
      await expect(button(lunch, c.take)).toHaveCount(0);
      const takes = api.calls('POST', `/api/families/${MAMMA}/tasks/${LUNCH_ID}/take`);
      expect(takes).toHaveLength(1);
      const body = takes[0].postDataJSON() as Record<string, unknown>;
      expect(Object.keys(body)).toEqual(['mutationId']);
      expect(body.mutationId).toMatch(UUID_V7);
      expect(takes[0].headers()['x-csrf-token']).toBe(CSRF);
    });

    test('a task someone else took first shows who has it', async ({ page, context }) => {
      await start(page, context, GIULIA);
      api.writeScript.push({
        status: 409,
        json: {
          error: 'already_taken',
          assigneePersonId: PAOLO.personId,
          assigneeName: 'Paolo',
        },
        effect: () => api.setTask(LUNCH_ID, PAOLO),
      });
      await openFamily(page, c, MAMMA, 'Famiglia Mamma');
      const lunch = item(familyTasks(page, c), LUNCH);
      await button(lunch, c.take).click();
      await expect(page.getByRole('alert')).toHaveText(c.taken('Paolo'));
      await expect(lunch).toContainText(c.assigned('Paolo'));
      await expect(lunch).not.toContainText(c.queue);
    });

    test('a write answering 404 reloads once; a second 404 means the family is not found', async ({
      page,
      context,
    }) => {
      await start(page, context, GIULIA);
      api.writeScript.push({
        status: 404,
        json: { error: 'not_found' },
        effect: () => {
          api.tasksStatus.set(MAMMA, 404);
          api.membersStatus.set(MAMMA, 404);
        },
      });
      await openFamily(page, c, MAMMA, 'Famiglia Mamma');
      await button(item(familyTasks(page, c), LUNCH), c.take).click();
      await expect(page.getByRole('alert')).toHaveText(c.notFound);
      await expect(page.getByText(LUNCH, { exact: true })).toHaveCount(0);
      await page.waitForTimeout(1500);
      expect(api.calls('GET', `/api/families/${MAMMA}/tasks`)).toHaveLength(2);
    });

    // ------------------------------------------------------------ loading

    test('tasks failing to load stay inside the Tasks section', async ({ page, context }) => {
      await start(page, context, GIULIA);
      api.tasksStatus.set(PRINCIPALE, 500);
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      await expect(page.getByText(c.tasksError, { exact: true })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByText(c.noTasks, { exact: true })).toHaveCount(0);
      // The people are still there, and they are the only list items of the page.
      await expect(page.getByRole('heading', { level: 2, name: c.people })).toBeVisible();
      await expect(page.getByRole('listitem')).toHaveCount(4);
      await expect(page.getByText('Sofia', { exact: true })).toBeVisible();
    });

    // ------------------------------------------------------------ all my families

    test('Giulia sees the tasks of all her families, each in the zone of its family', async ({
      page,
      context,
    }) => {
      await start(page, context, GIULIA, true);
      await openFamily(page, c, PRINCIPALE, 'Famiglia Principale');
      const link = page.getByRole('link', { name: c.allFamilies, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/tasks$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.allFamilies);

      const list = page.getByRole('list', { name: c.allTasks, exact: true });
      await expect(list.getByRole('listitem')).toHaveCount(3);

      const zaino = item(list, ZAINO);
      await expect(zaino).toContainText('Famiglia Principale');
      await expect(zaino).toContainText(c.queue);
      await expect(zaino).toContainText(c.normal);
      await expect(zaino).toContainText(c.due('03/11/2026 18:30')); // Rome, CET

      const gifts = item(list, GIFTS);
      await expect(gifts).toContainText('Famiglia Mamma');
      await expect(gifts).toContainText(c.assigned('Giulia'));
      await expect(gifts).toContainText(c.due('01/11/2026 11:00')); // New York, back to EST

      const lunch = item(list, LUNCH);
      await expect(lunch).toContainText('Famiglia Mamma');
      await expect(lunch).toContainText(c.queue);
      await expect(lunch).toContainText(c.high);
      await expect(lunch).toContainText(c.due('20/12/2026'));

      await expect(page.getByText(ID_CARD)).toHaveCount(0);
      await expect(page.getByText('Famiglia Babbo')).toHaveCount(0);
      expect(api.requests.filter((r) => r.url().includes(BABBO))).toHaveLength(0);
      expect(api.calls('GET', '/api/tasks')).toHaveLength(1);
      await page.screenshot({ path: `${SCREENSHOTS}/tasks-all-${c.lang}.png`, fullPage: true });
    });

    test('the choice of families links to all my families too', async ({ page, context }) => {
      await start(page, context, GIULIA, true);
      await page.goto('/families');
      const link = page.getByRole('link', { name: c.allFamilies, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/tasks$/);
      await expect(
        page.getByRole('list', { name: c.allTasks, exact: true }).getByRole('listitem'),
      ).toHaveCount(3);
    });

    test('members of one family failing: all my families shows its loading error', async ({
      page,
      context,
    }) => {
      await start(page, context, GIULIA, true);
      api.membersStatus.set(MAMMA, 500);
      await page.goto('/tasks');
      await expect(page.getByRole('alert')).toHaveText(c.tasksError);
      await expect(page.getByRole('listitem')).toHaveCount(0);
    });

    test('without a session /tasks goes to /login', async ({ page, context }) => {
      api = new FakeApi(page, context, true);
      await api.install();
      await page.goto('/tasks');
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByText(LUNCH)).toHaveCount(0);
    });
  });
}
