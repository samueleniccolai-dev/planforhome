/// <reference types="node" />
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { FakeApi, GIULIA as SHOPPER, LISTA, LISTA_ID } from './giro-019-fake-api';
import { GIULIA, LocaleApi, PRINCIPALE, ZAINO } from './giro-052-fake-api';

// Round 056, T16 part 2 (docs/lab/giri/056-piano.md, A0–A7): the V8 states of every screen. While
// one answer of the API is held there is a `status` «Caricamento…» (LoadingState of the kit, its
// spinner hidden from assistive technologies); when the held answer fails (500 or the network
// drops) the error `alert` of the screen replaces it, never a blank page; /me without families
// explains why; `/` is made of the kit and follows the dark theme. Each case names the endpoint
// that is held or fails: a failing `GET /api/me` still means «no session» (out of scope). Fake
// APIs of round 052 (families, tasks, me) and 019 (shopping list items); demo data invented.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const DARK_BG = 'rgb(17, 20, 24)'; // darkColors.bg #111418
const DARK_TEXT = 'rgb(232, 236, 241)'; // darkColors.text #E8ECF1
const LIGHT_BG = 'rgb(243, 245, 247)'; // colors.bg #F3F5F7
const LIGHT_TEXT = 'rgb(20, 24, 29)'; // colors.text #14181D

const IT = {
  loading: 'Caricamento…',
  familiesError: 'Impossibile caricare le famiglie. Riprova.',
  familyError: 'Impossibile caricare la famiglia. Riprova.',
  tasksError: 'Impossibile caricare i task. Riprova.',
  listError: 'Qualcosa non ha funzionato. Riprova.',
  meFamiliesError: 'Impossibile caricare le tue famiglie. Riprova.',
  noFamiliesTitle: 'Non fai ancora parte di nessuna famiglia',
  noFamiliesHint: 'Chiedi a chi gestisce la famiglia di aggiungerti.',
  greeting: 'Ciao, Giulia',
  signOut: 'Esci',
  switchFamily: 'Cambia famiglia',
  home: 'Benvenuto in planforhome',
  signIn: 'Accedi',
};

type Answer = 'pass' | 'error' | 'abort';
type Release = (answer?: Answer) => void;

/**
 * Holds every `GET` whose path is `path` until the test releases it; then each held and later
 * request passes to the fake API, gets a 500 or loses the network (`internetdisconnected`).
 * Registered after the fake API, so it is asked first (Playwright: the last route wins).
 */
async function hold(page: Page, path: string): Promise<Release> {
  let open!: (answer: Answer) => void;
  const decided = new Promise<Answer>((done) => (open = done));
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const answer = await decided;
      if (answer === 'pass') return route.fallback();
      if (answer === 'abort') return route.abort('internetdisconnected');
      return route.fulfill({ status: 500, json: { error: 'internal' } });
    },
  );
  return (answer = 'pass') => open(answer);
}

type Case = {
  name: string;
  path: string;
  /** Shopping list: fake API of round 019; the others: round 052. */
  shopping?: boolean;
  /** The endpoint held (A2) and failing (A3, A4). */
  held: string;
  /** The heading level 1 of the loaded screen. */
  title: string;
  /** Whether the title is already there while `held` is held (/me: the greeting stays). */
  titleWhileHeld: boolean;
  /** Something that proves the data arrived. */
  content: (page: Page) => Locator;
  /** The error shown when `held` fails, and its role. */
  error: string;
  errorRole: 'alert' | 'status';
};

const TASKS_OF_PRINCIPALE = `/api/families/${PRINCIPALE}/tasks`;
const ITEMS = `/api/families/${PRINCIPALE}/tasks/${LISTA_ID}/items`;

const CASES: Case[] = [
  {
    name: 'families',
    path: '/families',
    held: '/api/families',
    title: 'Scegli una famiglia',
    titleWhileHeld: false,
    content: (page) => page.getByRole('link', { name: 'Famiglia Mamma', exact: true }),
    error: IT.familiesError,
    errorRole: 'alert',
  },
  {
    name: 'family',
    path: `/family?id=${PRINCIPALE}`,
    held: '/api/families',
    title: 'Famiglia Principale',
    titleWhileHeld: false,
    content: (page) =>
      page.getByRole('listitem').filter({ has: page.getByText('Marco', { exact: true }) }),
    error: IT.familyError,
    errorRole: 'alert',
  },
  {
    name: 'family-tasks',
    path: `/family?id=${PRINCIPALE}`,
    held: TASKS_OF_PRINCIPALE,
    title: 'Famiglia Principale',
    titleWhileHeld: true,
    content: (page) => page.getByText(ZAINO, { exact: true }).first(),
    error: IT.tasksError,
    // TasksSection shows its load error as a polite notice (unchanged in this round).
    errorRole: 'status',
  },
  {
    name: 'tasks',
    path: '/tasks',
    held: '/api/tasks',
    title: 'Tutte le mie famiglie',
    titleWhileHeld: false,
    content: (page) => page.getByText(ZAINO, { exact: true }).first(),
    error: IT.tasksError,
    errorRole: 'alert',
  },
  {
    name: 'me',
    path: '/me',
    held: '/api/families',
    title: IT.greeting,
    titleWhileHeld: true,
    content: (page) => page.getByRole('link', { name: IT.switchFamily, exact: true }),
    error: IT.meFamiliesError,
    errorRole: 'alert',
  },
  {
    name: 'list',
    path: `/list?family=${PRINCIPALE}&task=${LISTA_ID}`,
    shopping: true,
    held: ITEMS,
    title: LISTA,
    titleWhileHeld: false,
    content: (page) => page.getByText('Latte', { exact: true }).first(),
    error: IT.listError,
    errorRole: 'alert',
  },
];

const byName = (name: string) => CASES.find((c) => c.name === name)!;

async function signIn(page: Page, context: BrowserContext, shopping?: boolean): Promise<void> {
  if (shopping) {
    const api = new FakeApi(page, context);
    await api.install();
    await api.openSession(SHOPPER);
  } else {
    const api = new LocaleApi(page, context);
    await api.install();
    await api.openSession(GIULIA);
  }
}

/** Opens the screen with `held` held; returns the release. */
async function openHeld(page: Page, context: BrowserContext, c: Case): Promise<Release> {
  await signIn(page, context, c.shopping);
  const release = await hold(page, c.held);
  await page.goto(c.path);
  return release;
}

const loading = (page: Page) => page.getByRole('status', { name: IT.loading, exact: true });
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { level: 1, name, exact: true });

/** The empty /me: `GET /api/families` answers `[]` (Giulia in no family, for this test only). */
async function openEmptyMe(page: Page, context: BrowserContext): Promise<void> {
  await signIn(page, context);
  await page.route(
    (url) => url.pathname === '/api/families',
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, json: [] })
        : route.fallback(),
  );
  await page.goto('/me');
}

/**
 * The first ancestor of `el` with a non transparent background: its colour, the colour of `el`
 * and whether it fills the viewport (the container of `Screen` does).
 */
async function container(el: Locator): Promise<{ bg: string; text: string; fills: boolean }> {
  return el.evaluate((h) => {
    const text = getComputedStyle(h).color;
    for (let a: Element | null = h.parentElement; a; a = a.parentElement) {
      if (a === document.body || a === document.documentElement) break;
      const bg = getComputedStyle(a).backgroundColor;
      if (bg === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(bg)) continue;
      const r = a.getBoundingClientRect();
      const fills =
        r.width >= document.documentElement.clientWidth - 1 && r.height >= window.innerHeight - 1;
      return { bg, text, fills };
    }
    return { bg: 'none below body', text, fills: false };
  });
}

/** Every visible text under 4.5:1 on its background (same measure as round 055). */
async function lowContrastTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parse = (value: string): Rgba | null => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) return null;
      const p = m[1]
        .split(/[,\s/]+/)
        .filter(Boolean)
        .map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const over = (top: Rgba, below: Rgba): Rgba => {
      const a = top[3];
      return [
        top[0] * a + below[0] * (1 - a),
        top[1] * a + below[1] * (1 - a),
        top[2] * a + below[2] * (1 - a),
        1,
      ];
    };
    const luminance = (c: Rgba): number => {
      const ch = c.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const background = (el: Element): Rgba => {
      const layers: Rgba[] = [];
      for (let a: Element | null = el; a; a = a.parentElement) {
        const c = parse(getComputedStyle(a).backgroundColor);
        if (!c || c[3] === 0) continue;
        layers.push(c);
        if (c[3] === 1) break;
      }
      let result: Rgba = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i--) result = over(layers[i], result);
      return result;
    };
    const problems: string[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el || seen.has(el)) continue;
      if (el.closest('script, style, noscript, [aria-hidden="true"]')) continue;
      if (el.closest('[aria-disabled="true"], :disabled')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      seen.add(el);
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = background(el);
      const l1 = luminance(over(fg, bg));
      const l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 4.5) problems.push(`${ratio.toFixed(2)}:1 «${text.slice(0, 60)}» ${cs.color}`);
    }
    return problems;
  });
}

async function shoot(page: Page, file: string): Promise<void> {
  await page.screenshot({ path: `${SCREENSHOTS}/${file}`, fullPage: true });
  expect(statSync(join(APP, SCREENSHOTS, file)).size).toBeGreaterThan(0);
}

test.describe('giro 056 — screen states (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  for (const scheme of ['light', 'dark'] as const) {
    test(`A0 / in ${scheme}: made of the kit, follows the theme, «Accedi» leads to /login`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      const title = heading(page, IT.home);
      await expect(title).toBeVisible();
      const [bg, text] = scheme === 'dark' ? [DARK_BG, DARK_TEXT] : [LIGHT_BG, LIGHT_TEXT];
      await expect.poll(async () => (await container(title)).bg).toBe(bg);
      const box = await container(title);
      expect(box.text, 'title colour').toBe(text);
      expect(box.fills, 'the container fills the viewport').toBe(true);
      if (scheme === 'dark') expect(await lowContrastTexts(page)).toEqual([]);
      await shoot(page, `t16-home-${scheme}.png`);
      await page.getByRole('link', { name: IT.signIn, exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test('A1 /gallery: LoadingState is a status named by its text, the spinner hidden', async ({
    page,
  }) => {
    await page.goto('/gallery');
    const status = loading(page);
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status.getByText(IT.loading, { exact: true })).toBeVisible();
    // react-native-web renders ActivityIndicator as role=progressbar: it must be hidden.
    const spinner = status.locator('[role="progressbar"]');
    await expect(spinner).toHaveCount(1);
    await expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  test('A1 LoadingState on Android: live region polite, spinner no-hide-descendants', () => {
    const file = join(APP, 'src', 'ui', 'LoadingState.tsx');
    expect(existsSync(file), 'app/src/ui/LoadingState.tsx').toBe(true);
    const code = existsSync(file) ? readFileSync(file, 'utf8') : '';
    expect(code).toContain('ActivityIndicator');
    expect(code).toMatch(/accessibilityLiveRegion[=:]\s*["'{]*polite/);
    expect(code).toMatch(/importantForAccessibility[=:]\s*["'{]*no-hide-descendants/);
  });

  for (const c of CASES) {
    test(`A2 ${c.name}: «Caricamento…» while ${c.held} is held, then the data`, async ({
      page,
      context,
    }) => {
      const release = await openHeld(page, context, c);
      await expect(loading(page)).toBeVisible();
      await expect(loading(page)).toHaveCount(1);
      if (c.titleWhileHeld) await expect(heading(page, c.title)).toBeVisible();
      else await expect(heading(page, c.title)).toHaveCount(0);
      release('pass');
      await expect(heading(page, c.title)).toBeVisible();
      await expect(c.content(page)).toBeVisible();
      await expect(loading(page)).toHaveCount(0);
    });
  }

  test('A2 me: while /api/me is held there is «Caricamento…», not a blank page', async ({
    page,
    context,
  }) => {
    await signIn(page, context);
    const release = await hold(page, '/api/me');
    await page.goto('/me');
    await expect(loading(page)).toBeVisible();
    await expect(heading(page, IT.greeting)).toHaveCount(0);
    release('pass');
    await expect(heading(page, IT.greeting)).toBeVisible();
    await expect(loading(page)).toHaveCount(0);
  });

  test('A2 me: while /api/families is held the greeting and «Esci» stay, no switch yet', async ({
    page,
    context,
  }) => {
    const release = await openHeld(page, context, byName('me'));
    await expect(loading(page)).toBeVisible();
    await expect(heading(page, IT.greeting)).toBeVisible();
    await expect(page.getByRole('button', { name: IT.signOut, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: IT.switchFamily, exact: true })).toHaveCount(0);
    release('pass');
    await expect(page.getByRole('link', { name: IT.switchFamily, exact: true })).toBeVisible();
    await expect(loading(page)).toHaveCount(0);
  });

  for (const c of CASES) {
    test(`A3 ${c.name}: ${c.held} held then 500, the error replaces «Caricamento…»`, async ({
      page,
      context,
    }) => {
      const release = await openHeld(page, context, c);
      await expect(loading(page)).toBeVisible();
      release('error');
      await expect(page.getByRole(c.errorRole).filter({ hasText: c.error })).toBeVisible();
      await expect(loading(page)).toHaveCount(0);
      if (c.name === 'me') {
        await expect(heading(page, IT.greeting)).toBeVisible();
        await expect(page.getByRole('button', { name: IT.signOut, exact: true })).toBeVisible();
      }
      if (c.name === 'tasks') await expect(page).toHaveURL(/\/tasks$/);
    });
  }

  for (const c of [byName('tasks'), byName('families')]) {
    test(`A4 ${c.name}: the network drops on ${c.held}, the same error, never blank`, async ({
      page,
      context,
    }) => {
      const release = await openHeld(page, context, c);
      await expect(loading(page)).toBeVisible();
      release('abort');
      await expect(page.getByRole('alert').filter({ hasText: c.error })).toBeVisible();
      await expect(loading(page)).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`${c.path.replace('?', '\\?')}$`));
    });
  }

  test('A5 /me without families: the empty state explains, «Esci» stays, no switch', async ({
    page,
    context,
  }) => {
    await openEmptyMe(page, context);
    await expect(heading(page, IT.greeting)).toBeVisible();
    await expect(page.getByText(IT.noFamiliesTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(IT.noFamiliesHint, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: IT.signOut, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: IT.switchFamily, exact: true })).toHaveCount(0);
    await expect(loading(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('concurrency /family: only the tasks held, one status and the title; released, none', async ({
    page,
    context,
  }) => {
    const release = await openHeld(page, context, byName('family-tasks'));
    await expect(heading(page, 'Famiglia Principale')).toBeVisible();
    await expect(loading(page)).toHaveCount(1);
    release('pass');
    await expect(page.getByText(ZAINO, { exact: true }).first()).toBeVisible();
    await expect(loading(page)).toHaveCount(0);
  });

  // A6 (dark contrast) and A7 (screenshots): every state, mobile, light and dark.
  for (const scheme of ['light', 'dark'] as const) {
    for (const c of CASES.filter((x) => x.name !== 'family-tasks')) {
      for (const state of ['loading', 'error'] as const) {
        test(`A6/A7 ${c.name} ${state} in ${scheme}`, async ({ page, context }) => {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.emulateMedia({ colorScheme: scheme });
          const release = await openHeld(page, context, c);
          await expect(loading(page)).toBeVisible();
          if (state === 'error') release('error');
          const shown =
            state === 'loading'
              ? loading(page)
              : page.getByRole(c.errorRole).filter({ hasText: c.error });
          await expect(shown).toBeVisible();
          const bg = scheme === 'dark' ? DARK_BG : LIGHT_BG;
          await expect
            .poll(async () => {
              // The screen background behind the state (the first ancestor that fills the page).
              return shown.evaluate((el) => {
                for (let a: Element | null = el; a; a = a.parentElement) {
                  if (a === document.body) break;
                  const r = a.getBoundingClientRect();
                  const bgc = getComputedStyle(a).backgroundColor;
                  const clear = bgc === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(bgc);
                  if (r.height >= window.innerHeight - 1 && !clear) return bgc;
                }
                return 'none';
              });
            })
            .toBe(bg);
          if (scheme === 'dark') expect(await lowContrastTexts(page)).toEqual([]);
          await shoot(page, `t16-state-${c.name}-${state}-${scheme}.png`);
          release('pass');
        });
      }
    }
    test(`A6/A7 me empty in ${scheme}`, async ({ page, context }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: scheme });
      await openEmptyMe(page, context);
      const empty = page.getByText(IT.noFamiliesTitle, { exact: true });
      await expect(empty).toBeVisible();
      const title = heading(page, IT.greeting);
      const bg = scheme === 'dark' ? DARK_BG : LIGHT_BG;
      await expect.poll(async () => (await container(title)).bg).toBe(bg);
      if (scheme === 'dark') expect(await lowContrastTexts(page)).toEqual([]);
      await shoot(page, `t16-state-me-empty-${scheme}.png`);
    });
  }
});

test.describe('giro 056 — screen states (en)', () => {
  test.use({ locale: 'en-US', timezoneId: 'Europe/London' });

  test('A1 /gallery in English: the status is named «Loading…»', async ({ page }) => {
    await page.goto('/gallery');
    await expect(page.getByRole('status', { name: 'Loading…', exact: true })).toBeVisible();
  });
});
