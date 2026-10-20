import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';

// Round 007, T4 (app side): choosing and switching family on the web. As in round 004 the API is
// faked in the browser (`page.route('**/api/**')`); it keeps a session and answers like the
// server: families ordered by name, members by display name then id, 404 on the members of a
// family the caller is not in. Elements are found by role and accessible name; the texts are the
// ones decided in the plan. Demo data (invented): Appendix A of the SPEC.

const SCREENSHOTS = 'e2e-screenshots';
const PASSWORD = 'Lanterna-Blu-42';
const CSRF = 'csrf-finto-giro007';
const EXPIRES_AT = '2031-02-05T08:00:00Z';

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
type Member = {
  person: Person;
  role: Role;
  hasAccount: boolean;
  referentPersonId: string | null;
};
type Family = { id: string; name: string; timeZone: string; members: Member[] };

const account = (person: Person, role: Role): Member => ({
  person,
  role,
  hasAccount: true,
  referentPersonId: null,
});
// A resource is a MEMBER without an account, with a referent (MembershipService, FamilyRepository).
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
    timeZone: 'Europe/Rome',
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

type Texts = {
  locale: string;
  submit: string;
  greeting: (name: string) => string;
  familiesTitle: string;
  familiesError: string;
  familyError: string;
  switchFamily: string;
  people: string;
  notFound: string;
  manager: string;
  member: string;
  resource: string;
  lang: string;
};

const cases: Texts[] = [
  {
    locale: 'it-IT',
    submit: 'Accedi',
    greeting: (name) => `Ciao, ${name}`,
    familiesTitle: 'Scegli una famiglia',
    familiesError: 'Impossibile caricare le famiglie. Riprova.',
    familyError: 'Impossibile caricare la famiglia. Riprova.',
    switchFamily: 'Cambia famiglia',
    people: 'Persone',
    notFound: 'Famiglia non trovata.',
    manager: 'Gestore',
    member: 'Membro',
    resource: 'Senza account',
    lang: 'it',
  },
  {
    locale: 'en-US',
    submit: 'Sign in',
    greeting: (name) => `Hi, ${name}`,
    familiesTitle: 'Choose a family',
    familiesError: "Couldn't load your families. Try again.",
    familyError: "Couldn't load this family. Try again.",
    switchFamily: 'Switch family',
    people: 'People',
    notFound: 'Family not found.',
    manager: 'Manager',
    member: 'Member',
    resource: 'No account',
    lang: 'en',
  },
];

/** The fake API: a session for Giulia or Luca, with knobs for errors and slow answers. */
class FakeApi {
  user: Person | undefined;
  familiesStatus = 200;
  familiesDelayMs = 0;
  readonly membersStatus = new Map<string, number>();
  readonly requests: Request[] = [];

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

      if (method === 'POST' && path === '/api/auth/login') {
        const body = request.postDataJSON() as { email?: string; password?: string };
        const who = [GIULIA, LUCA].find((p) => p.email === body.email);
        if (!who || body.password !== PASSWORD) {
          return route.fulfill({ status: 401, json: { error: 'invalid_credentials' } });
        }
        await this.openSession(who);
        return route.fulfill({
          status: 200,
          json: { expiresAt: EXPIRES_AT, personId: who.personId },
        });
      }
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
      if (method === 'POST' && path === '/api/auth/logout') {
        if (!this.user) return route.fulfill({ status: 401 });
        this.user = undefined;
        await this.context.clearCookies();
        return route.fulfill({ status: 204 });
      }
      if (method === 'GET' && path === '/api/families') {
        if (this.familiesDelayMs > 0) await sleep(this.familiesDelayMs);
        if (!this.user) return route.fulfill({ status: 401 });
        if (this.familiesStatus !== 200) {
          return route.fulfill({ status: this.familiesStatus, json: { error: 'internal' } });
        }
        const mine = this.familiesOf(this.user).sort(byName);
        return route.fulfill({
          status: 200,
          json: mine.map((f) => ({
            id: f.id,
            name: f.name,
            timeZone: f.timeZone,
            role: f.members.find((m) => m.person.personId === this.user!.personId)!.role,
          })),
        });
      }
      const members = /^\/api\/families\/([^/]+)\/members$/.exec(path);
      if (method === 'GET' && members) {
        if (!this.user) return route.fulfill({ status: 401 });
        const forced = this.membersStatus.get(members[1]);
        if (forced) return route.fulfill({ status: forced, json: { error: 'forced' } });
        const family = this.familiesOf(this.user).find((f) => f.id === members[1]);
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
      return route.fulfill({ status: 404, json: { error: 'not_found' } });
    });
  }

  familiesOf(person: Person): Family[] {
    return FAMILIES.filter((f) => f.members.some((m) => m.person.personId === person.personId));
  }

  /** What a real web login leaves in the browser: the session, and pfh_csrf readable by JS. */
  async openSession(person: Person): Promise<void> {
    this.user = person;
    await this.context.addCookies([
      { name: 'pfh_csrf', value: CSRF, domain: 'localhost', path: '/', sameSite: 'Lax' },
    ]);
  }

  calls(method: string, path: string): Request[] {
    return this.requests.filter((r) => r.method() === method && new URL(r.url()).pathname === path);
  }

  membersCalls(): Request[] {
    return this.requests.filter((r) =>
      /^\/api\/families\/.+\/members$/.test(new URL(r.url()).pathname),
    );
  }
}

function familyUrl(id: string): RegExp {
  return new RegExp(`/family\\?id=${id}$`);
}

async function signIn(page: Page, c: Texts, who: Person): Promise<void> {
  await page.goto('/login');
  const submit = page.getByRole('button', { name: c.submit, exact: true });
  await expect(submit).toBeEnabled();
  await page.getByLabel('Email', { exact: true }).fill(who.email!);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await submit.click();
}

/** The people list of the family screen, in the order of the server, with their role label. */
async function expectPeople(page: Page, c: Texts, people: [string, string][]): Promise<void> {
  await expect(page.getByRole('heading', { level: 2, name: c.people, exact: true })).toBeVisible();
  const items = page.getByRole('list').getByRole('listitem');
  await expect(items).toHaveCount(people.length);
  const labels = [c.manager, c.member, c.resource];
  for (const [i, [name, label]] of people.entries()) {
    const item = items.nth(i);
    await expect(item).toContainText(name);
    await expect(item).toContainText(label);
    for (const other of labels.filter((l) => l !== label)) {
      await expect(item).not.toContainText(other);
    }
  }
}

function mammaPeople(c: Texts): [string, string][] {
  return [
    ['Anna', c.manager],
    ['Davide', c.member],
    ['Giulia', c.member],
    ['Luca', c.member],
    ['Paolo', c.member],
    ['Pietro', c.manager],
  ];
}

function principalePeople(c: Texts): [string, string][] {
  return [
    ['Giulia', c.manager],
    ['Leo', c.resource],
    ['Marco', c.manager],
    ['Sofia', c.resource],
  ];
}

async function expectMamma(page: Page, c: Texts): Promise<void> {
  await expect(page).toHaveURL(familyUrl(MAMMA));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Mamma');
  await expectPeople(page, c, mammaPeople(c));
}

async function expectNotFound(page: Page, c: Texts): Promise<void> {
  await expect(page.getByRole('alert')).toHaveText(c.notFound);
  for (const hidden of [
    'Famiglia Babbo',
    'Famiglia Principale',
    'Famiglia Mamma',
    'Rosa',
    'Franco',
    'Marco',
  ]) {
    await expect(page.getByText(hidden)).toHaveCount(0);
  }
}

async function chooseFamilies(page: Page, c: Texts): Promise<void> {
  await expect(page).toHaveURL(/\/families$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.familiesTitle);
  const links = page.getByRole('link', { name: /^Famiglia / });
  await expect(links).toHaveText(['Famiglia Mamma', 'Famiglia Principale']);
  await expect(page.getByText('Famiglia Babbo')).toHaveCount(0);
}

test('the static family page carries no warning before the session is known', () => {
  const html = resolve(test.info().project.testDir, '..', 'dist', 'family.html');
  expect(existsSync(html), `${html} must be exported by expo export`).toBe(true);
  const body = readFileSync(html, 'utf8');
  for (const text of [
    'Famiglia non trovata.',
    'Family not found.',
    'Impossibile caricare',
    "Couldn't load",
  ]) {
    expect(body).not.toContain(text);
  }
});

for (const c of cases) {
  test.describe(`device language ${c.locale}`, () => {
    test.use({ locale: c.locale });

    let api: FakeApi;
    test.beforeEach(async ({ page, context }) => {
      api = new FakeApi(page, context);
      await api.install();
    });

    test('Luca, with one family, goes straight into Famiglia Mamma', async ({ page }) => {
      const seen: string[] = [];
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) seen.push(frame.url());
      });

      await signIn(page, c, LUCA);
      await expectMamma(page, c);
      await expect(page.getByRole('link', { name: c.switchFamily, exact: true })).toHaveCount(0);
      await expect(page.getByText(c.familiesTitle)).toHaveCount(0);
      expect(seen.filter((url) => /\/families(\?|$)/.test(url))).toEqual([]);
      await page.screenshot({
        path: `${SCREENSHOTS}/family-luca-${c.lang}.png`,
        fullPage: true,
      });
    });

    test('Luca opening /families lands on his family, and back does not show the choice', async ({
      page,
    }) => {
      await api.openSession(LUCA);
      await page.goto('/');
      await page.goto('/families');
      await expectMamma(page, c);
      await page.goBack();
      await expect(page).not.toHaveURL(/\/families(\?|$)/);
    });

    test('Luca has no family switch on /me either', async ({ page }) => {
      await api.openSession(LUCA);
      await page.goto('/me');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.greeting('Luca'));
      await page.waitForTimeout(1000);
      await expect(page.getByRole('link', { name: c.switchFamily, exact: true })).toHaveCount(0);
    });

    test('Giulia, with two families, chooses one', async ({ page }) => {
      await signIn(page, c, GIULIA);
      await chooseFamilies(page, c);
      await page.screenshot({
        path: `${SCREENSHOTS}/families-giulia-${c.lang}.png`,
        fullPage: true,
      });
      await page.getByRole('link', { name: 'Famiglia Mamma', exact: true }).click();
      await expectMamma(page, c);
    });

    test('a double click on sign in sends one login and waits for the families', async ({
      page,
    }) => {
      api.familiesDelayMs = 2000;
      await page.goto('/login');
      const submit = page.getByRole('button', { name: c.submit, exact: true });
      await expect(submit).toBeEnabled();
      await page.getByLabel('Email', { exact: true }).fill(GIULIA.email!);
      await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
      await submit.click();
      await expect.poll(() => api.calls('GET', '/api/families').length).toBeGreaterThanOrEqual(1);
      // The login has answered, the families have not: the button must still be busy.
      await expect(submit).toBeDisabled();
      await submit.click({ force: true });
      await chooseFamilies(page, c);
      expect(api.calls('POST', '/api/auth/login')).toHaveLength(1);
    });

    test('Giulia switches family from the family screen', async ({ page }) => {
      await api.openSession(GIULIA);
      await page.goto(`/family?id=${PRINCIPALE}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
      await expectPeople(page, c, principalePeople(c));

      await page.getByRole('link', { name: c.switchFamily, exact: true }).click();
      await chooseFamilies(page, c);
      await page.getByRole('link', { name: 'Famiglia Mamma', exact: true }).click();
      await expectMamma(page, c);
    });

    test('Giulia switches family from /me, without an extra refresh', async ({ page }) => {
      await api.openSession(GIULIA);
      await page.goto('/me');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.greeting('Giulia'));
      const link = page.getByRole('link', { name: c.switchFamily, exact: true });
      await expect(link).toBeVisible();
      // Leave time to a second, unwanted refresh (the round 004 rule: exactly one on /me).
      await page.waitForTimeout(1500);
      expect(api.calls('POST', '/api/auth/refresh')).toHaveLength(1);

      await link.click();
      await chooseFamilies(page, c);
      await page.getByRole('link', { name: 'Famiglia Mamma', exact: true }).click();
      await expectMamma(page, c);
    });

    test('a family of others is not found, and its members are never asked', async ({ page }) => {
      await api.openSession(GIULIA);
      await page.goto(`/family?id=${BABBO}`);
      await expectNotFound(page, c);
      expect(api.calls('GET', `/api/families/${BABBO}/members`)).toHaveLength(0);
    });

    test('a malformed id is not found, and no members are asked', async ({ page }) => {
      await api.openSession(GIULIA);
      await page.goto('/family?id=abc');
      await expectNotFound(page, c);
      expect(api.membersCalls()).toHaveLength(0);
    });

    test('a missing id is not found, and no members are asked', async ({ page }) => {
      await api.openSession(GIULIA);
      await page.goto('/family');
      await expectNotFound(page, c);
      expect(api.membersCalls()).toHaveLength(0);
    });

    test('members answering 404 mean the family is not found', async ({ page }) => {
      api.membersStatus.set(MAMMA, 404);
      await api.openSession(GIULIA);
      await page.goto(`/family?id=${MAMMA}`);
      await expectNotFound(page, c);
    });

    test('members answering 500 show the loading error, not "not found"', async ({ page }) => {
      api.membersStatus.set(MAMMA, 500);
      await api.openSession(GIULIA);
      await page.goto(`/family?id=${MAMMA}`);
      await expect(page.getByRole('alert')).toHaveText(c.familyError);
      await expect(page.getByText(c.notFound)).toHaveCount(0);
    });

    test('families answering 500 on /family show the loading error, not "not found"', async ({
      page,
    }) => {
      api.familiesStatus = 500;
      await api.openSession(GIULIA);
      await page.goto(`/family?id=${MAMMA}`);
      await expect(page.getByRole('alert')).toHaveText(c.familyError);
      await expect(page.getByText(c.notFound)).toHaveCount(0);
      expect(api.membersCalls()).toHaveLength(0);
    });

    test('while the families load, /family shows no warning', async ({ page }) => {
      api.familiesDelayMs = 1500;
      await api.openSession(GIULIA);
      await page.goto(`/family?id=${MAMMA}`);
      await page.waitForTimeout(700);
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expectMamma(page, c);
    });

    test('without a session /families and /family go to /login', async ({ page }) => {
      for (const path of ['/families', `/family?id=${MAMMA}`, '/family?id=abc']) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/login$/);
      }
      expect(api.membersCalls()).toHaveLength(0);
    });

    test('families failing after a good login fall back to /me', async ({ page }) => {
      api.familiesStatus = 500;
      await signIn(page, c, GIULIA);
      await expect(page).toHaveURL(/\/me$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.greeting('Giulia'));
    });

    test('/families failing shows its warning', async ({ page }) => {
      api.familiesStatus = 500;
      await api.openSession(GIULIA);
      await page.goto('/families');
      await expect(page.getByRole('alert')).toHaveText(c.familiesError);
    });
  });
}
