import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';

import { GIULIA, LocaleApi, OLIVER, PRINCIPALE, type Person } from './giro-052-fake-api';

// Round 052, T15 part 1 (docs/lab/giri/052-piano.md, L1–L6): on the web the language of the
// account (`locale` of GET /api/me) wins after the login; before it, and again after «Esci», the
// browser decides (SPEC §2.2.9). The browser and the account speak different languages on
// purpose. `<html lang>` follows the language on screen. Elements are found by role and accessible
// name; the texts are the ones of the dictionaries and of the plan.

const IT = {
  loginTitle: 'Accedi a planforhome',
  submit: 'Accedi',
  families: 'Scegli una famiglia',
  greeting: (name: string) => `Ciao, ${name}`,
  signOut: 'Esci',
  accountLanguage: "Lingua dell'account: Italiano",
  people: 'Persone',
  manager: 'Gestore',
  newTask: 'Nuovo task',
  due: 'Scadenza',
  friday30: 'venerdì 30 ottobre 2026',
};

const EN = {
  loginTitle: 'Sign in to planforhome',
  submit: 'Sign in',
  families: 'Choose a family',
  greeting: (name: string) => `Hi, ${name}`,
  signOut: 'Sign out',
  accountLanguage: 'Account language: English',
};

let api: LocaleApi;

async function setUp(page: Page, context: BrowserContext): Promise<void> {
  api = new LocaleApi(page, context);
  await api.install();
}

function heading(page: Page, name: string) {
  return page.getByRole('heading', { level: 1, name, exact: true });
}

function button(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

async function signIn(page: Page, who: Person, submit: string): Promise<void> {
  await page.getByLabel('Email', { exact: true }).fill(who.email!);
  await page.getByLabel('Password', { exact: true }).fill(who.password!);
  await expect(button(page, submit)).toBeVisible();
  await button(page, submit).click();
}

/** Console errors and page errors about hydration (React production codes included). */
function watchHydration(page: Page): string[] {
  const problems: string[] = [];
  const bad = /hydrat|#418|#423|#425/i;
  page.on('console', (message) => {
    if ((message.type() === 'error' || message.type() === 'warning') && bad.test(message.text())) {
      problems.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (bad.test(error.message)) problems.push(error.message);
  });
  return problems;
}

test.describe('giro 052 — account language on an English browser (Giulia, it)', () => {
  test.use({ locale: 'en-US', timezoneId: 'Europe/Rome' });

  test('L1 before the login the browser, after it the account: /families, /me, /family and the date field in Italian', async ({
    page,
    context,
  }) => {
    const hydration = watchHydration(page);
    await setUp(page, context);
    await page.goto('/login');
    await expect(heading(page, EN.loginTitle)).toBeVisible();
    await expect(button(page, EN.submit)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await signIn(page, GIULIA, EN.submit);
    await expect(page).toHaveURL(/\/families$/);
    await expect(heading(page, IT.families)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');

    await page.goto('/me');
    await expect(heading(page, IT.greeting('Giulia'))).toBeVisible();
    await expect(button(page, IT.signOut)).toBeVisible();
    await expect(page.getByText(IT.accountLanguage, { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');

    await page.goto(`/family?id=${PRINCIPALE}`);
    await expect(heading(page, 'Famiglia Principale')).toBeVisible();
    await expect(page.getByRole('heading', { name: IT.people, exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');

    // The web date field writes the chosen day in the language of the account.
    await expect(button(page, IT.newTask)).toBeVisible();
    await button(page, IT.newTask).click();
    const dialog = page.getByRole('dialog', { name: IT.newTask, exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: IT.due, exact: true }).fill('2026-10-30');
    await expect(dialog.getByText(IT.friday30, { exact: true })).toBeVisible();

    expect(hydration).toEqual([]);
  });

  test('L2 reload of /family with a valid session: still Italian, without passing through /me', async ({
    page,
    context,
  }) => {
    await setUp(page, context);
    await api.openSession(GIULIA);
    await page.goto(`/family?id=${PRINCIPALE}`);
    await expect(heading(page, 'Famiglia Principale')).toBeVisible();
    await expect(page.getByRole('heading', { name: IT.people, exact: true })).toBeVisible();
    await expect(page.getByText(IT.manager, { exact: true })).toBeVisible();

    await page.reload();
    await expect(heading(page, 'Famiglia Principale')).toBeVisible();
    await expect(page.getByRole('heading', { name: IT.people, exact: true })).toBeVisible();
    await expect(page.getByText(IT.manager, { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    expect(new URL(page.url()).pathname).toBe('/family');
  });

  test('L3 «Esci» goes back to the language of the browser: /login in English', async ({
    page,
    context,
  }) => {
    await setUp(page, context);
    await api.openSession(GIULIA);
    await page.goto('/me');
    await expect(heading(page, IT.greeting('Giulia'))).toBeVisible();
    await expect(button(page, IT.signOut)).toBeVisible();
    await button(page, IT.signOut).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(heading(page, EN.loginTitle)).toBeVisible();
    await expect(button(page, EN.submit)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(api.calls('POST', '/api/auth/logout')).toHaveLength(1);
  });

  test('L6 guard: GET /api/me fails right after a good login, the login still navigates', async ({
    page,
    context,
  }) => {
    await setUp(page, context);
    await page.route('**/api/me', async (route) => {
      if (route.request().method() === 'GET' && api.user) {
        return route.fulfill({ status: 500, json: { error: 'internal' } });
      }
      return route.fallback();
    });
    await page.goto('/login');
    await expect(heading(page, EN.loginTitle)).toBeVisible();
    await signIn(page, GIULIA, EN.submit);
    await expect(page).toHaveURL(/\/families$/);
    await expect(heading(page, EN.families)).toBeVisible();
  });
});

test.describe('giro 052 — account language on an Italian browser (Oliver, en)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('L4 /login in Italian; after the login /me in English', async ({ page, context }) => {
    await setUp(page, context);
    await page.goto('/login');
    await expect(heading(page, IT.loginTitle)).toBeVisible();
    await expect(button(page, IT.submit)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');

    await signIn(page, OLIVER, IT.submit);
    // Oliver belongs to no family: the landing is /me.
    await expect(page).toHaveURL(/\/me$/);
    await expect(heading(page, EN.greeting('Oliver'))).toBeVisible();
    await expect(button(page, EN.signOut)).toBeVisible();
    await expect(page.getByText(EN.accountLanguage, { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('L5 late answer: the GET /api/me of the start arrives after «Sign out» and does not bring English back', async ({
    page,
    context,
  }) => {
    await setUp(page, context);
    // A session is already there: the GET /api/me sent at the start will answer Oliver (en).
    await api.openSession(OLIVER);
    api.holdFirstMe();
    await page.goto('/login');
    await expect(heading(page, IT.loginTitle)).toBeVisible();
    await expect.poll(() => api.calls('GET', '/api/me').length).toBe(1);
    const held: Request = api.calls('GET', '/api/me')[0];

    await signIn(page, OLIVER, IT.submit);
    await expect(page).toHaveURL(/\/me$/);
    await expect(heading(page, EN.greeting('Oliver'))).toBeVisible();
    await expect(button(page, EN.signOut)).toBeVisible();
    await button(page, EN.signOut).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(heading(page, IT.loginTitle)).toBeVisible();

    const late = page.waitForResponse((response) => response.request() === held);
    api.releaseMe();
    const answer = await late;
    expect(answer.status()).toBe(200);

    await expect(heading(page, IT.loginTitle)).toBeVisible();
    await expect(button(page, IT.submit)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    // Still Italian a moment later: nothing applies the late answer afterwards.
    await page.waitForTimeout(300);
    await expect(heading(page, IT.loginTitle)).toBeVisible();
  });
});
