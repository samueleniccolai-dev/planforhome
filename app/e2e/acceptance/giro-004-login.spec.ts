import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';

// Round 004, T3: sign in and sign out on the web. In CI Playwright runs on `expo serve` without a
// server, so the API is faked in the browser (`page.route('**/api/**')`) with a state that changes
// with the requests it receives. Elements are found by role and accessible name; the texts are
// the ones decided in the plan. Demo user: Giulia (invented).

const SCREENSHOTS = 'e2e-screenshots';

const GIULIA = {
  email: 'giulia@example.com',
  password: 'Lanterna-Blu-42',
  personId: '0192a3b4-0000-7000-8000-000000000004',
  displayName: 'Giulia',
};
const CSRF = 'csrf-finto-giro004';
const EXPIRES_AT = '2031-02-05T08:00:00Z';

type Texts = {
  locale: string;
  signInLink: string;
  title: string;
  submit: string;
  invalid: string;
  tooMany: string;
  error: string;
  greeting: string;
  signOut: string;
  screenshot: string;
};

const cases: Texts[] = [
  {
    locale: 'it-IT',
    signInLink: 'Accedi',
    title: 'Accedi a planforhome',
    submit: 'Accedi',
    invalid: 'Email o password non corretti.',
    tooMany: 'Troppi tentativi. Riprova fra qualche minuto.',
    error: 'Accesso non riuscito. Riprova.',
    greeting: 'Ciao, Giulia',
    signOut: 'Esci',
    screenshot: 'login-it.png',
  },
  {
    locale: 'en-US',
    signInLink: 'Sign in',
    title: 'Sign in to planforhome',
    submit: 'Sign in',
    invalid: 'Wrong email or password.',
    tooMany: 'Too many attempts. Try again in a few minutes.',
    error: 'Sign-in failed. Try again.',
    greeting: 'Hi, Giulia',
    signOut: 'Sign out',
    screenshot: 'login-en.png',
  },
];

type LoginAnswer = 'credentials' | 401 | 429 | 500;

/** The fake API: a session that opens on the right login and closes on logout. */
class FakeApi {
  signedIn = false;
  loginAnswer: LoginAnswer = 'credentials';
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
        if (this.loginAnswer === 429) {
          return route.fulfill({
            status: 429,
            headers: { 'Retry-After': '900' },
            json: { error: 'too_many_attempts' },
          });
        }
        if (this.loginAnswer === 500) {
          return route.fulfill({ status: 500, json: { error: 'internal' } });
        }
        const body = request.postDataJSON() as { email?: string; password?: string };
        const right = body.email === GIULIA.email && body.password === GIULIA.password;
        if (this.loginAnswer === 401 || !right) {
          return route.fulfill({ status: 401, json: { error: 'invalid_credentials' } });
        }
        await this.openSession();
        return route.fulfill({
          status: 200,
          json: { expiresAt: EXPIRES_AT, personId: GIULIA.personId },
        });
      }
      if (method === 'GET' && path === '/api/me') {
        if (!this.signedIn) return route.fulfill({ status: 401 });
        return route.fulfill({
          status: 200,
          json: {
            personId: GIULIA.personId,
            email: GIULIA.email,
            displayName: GIULIA.displayName,
            locale: 'it',
          },
        });
      }
      if (method === 'POST' && path === '/api/auth/refresh') {
        if (!this.signedIn) return route.fulfill({ status: 401 });
        return route.fulfill({ status: 200, json: { expiresAt: EXPIRES_AT } });
      }
      if (method === 'POST' && path === '/api/auth/logout') {
        if (!this.signedIn) return route.fulfill({ status: 401 });
        this.signedIn = false;
        await this.context.clearCookies();
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ status: 404, json: { error: 'not_found' } });
    });
  }

  /** What a real web login leaves in the browser: the session, and pfh_csrf readable by JS. */
  async openSession(): Promise<void> {
    this.signedIn = true;
    await this.context.addCookies([
      { name: 'pfh_csrf', value: CSRF, domain: 'localhost', path: '/', sameSite: 'Lax' },
    ]);
  }

  calls(method: string, path: string): Request[] {
    return this.requests.filter((r) => r.method() === method && new URL(r.url()).pathname === path);
  }
}

async function loginPage(page: Page, c: Texts): Promise<void> {
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.title);
}

async function fillAndSubmit(page: Page, c: Texts, password: string): Promise<void> {
  const email = page.getByLabel('Email', { exact: true });
  const pass = page.getByLabel('Password', { exact: true });
  const submit = page.getByRole('button', { name: c.submit, exact: true });
  await expect(email).toBeVisible();
  await expect(pass).toBeVisible();
  await expect(submit).toBeEnabled();
  await email.fill(GIULIA.email);
  await pass.fill(password);
  await submit.click();
}

for (const c of cases) {
  test.describe(`device language ${c.locale}`, () => {
    test.use({ locale: c.locale });

    let api: FakeApi;
    test.beforeEach(async ({ page, context }) => {
      api = new FakeApi(page, context);
      await api.install();
    });

    test('the home page links to the login page', async ({ page }) => {
      await page.goto('/');
      const link = page.getByRole('link', { name: c.signInLink, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await loginPage(page, c);
      await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: c.submit, exact: true })).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOTS}/${c.screenshot}`, fullPage: true });
    });

    test('the right credentials lead to /me with the greeting', async ({ page }) => {
      await page.goto('/login');
      await loginPage(page, c);
      await fillAndSubmit(page, c, GIULIA.password);

      await expect(page).toHaveURL(/\/me$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.greeting);
      await expect(page.getByRole('button', { name: c.signOut, exact: true })).toBeVisible();

      const logins = api.calls('POST', '/api/auth/login');
      expect(logins).toHaveLength(1);
      expect(logins[0].postDataJSON()).toEqual({
        email: GIULIA.email,
        password: GIULIA.password,
        client: 'web',
      });
    });

    test('wrong credentials show the warning and stay on /login', async ({ page }) => {
      api.loginAnswer = 401;
      await page.goto('/login');
      await loginPage(page, c);
      await fillAndSubmit(page, c, 'Sbagliata-Del-Tutto-9');
      await expect(page.getByRole('alert')).toHaveText(c.invalid);
      await expect(page).toHaveURL(/\/login$/);
    });

    test('too many attempts show their own warning', async ({ page }) => {
      api.loginAnswer = 429;
      await page.goto('/login');
      await loginPage(page, c);
      await fillAndSubmit(page, c, GIULIA.password);
      await expect(page.getByRole('alert')).toHaveText(c.tooMany);
      await expect(page).toHaveURL(/\/login$/);
    });

    test('a server error shows the generic warning', async ({ page }) => {
      api.loginAnswer = 500;
      await page.goto('/login');
      await loginPage(page, c);
      await fillAndSubmit(page, c, GIULIA.password);
      await expect(page.getByRole('alert')).toHaveText(c.error);
      await expect(page).toHaveURL(/\/login$/);
    });

    test('sign out sends the CSRF header and goes back to /login', async ({ page }) => {
      await api.openSession();
      await page.goto('/me');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.greeting);

      const signOut = page.getByRole('button', { name: c.signOut, exact: true });
      await expect(signOut).toBeVisible();
      await signOut.click();
      await loginPage(page, c);

      const logouts = api.calls('POST', '/api/auth/logout');
      expect(logouts).toHaveLength(1);
      expect(await logouts[0].headerValue('x-csrf-token')).toBe(CSRF);
      expect(api.signedIn).toBe(false);

      await page.goto('/me');
      await loginPage(page, c);
    });

    test('/me without a session goes to /login', async ({ page }) => {
      await page.goto('/me');
      await loginPage(page, c);
      expect(api.calls('GET', '/api/me').length).toBeGreaterThanOrEqual(1);
    });

    test('opening /me with a session renews it exactly once', async ({ page }) => {
      await api.openSession();
      await page.goto('/me');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.greeting);
      // Leave time to a second, unwanted call.
      await page.waitForTimeout(1500);

      const refreshes = api.calls('POST', '/api/auth/refresh');
      expect(refreshes).toHaveLength(1);
      expect(await refreshes[0].headerValue('x-csrf-token')).toBe(CSRF);
    });
  });
}
