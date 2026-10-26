/// <reference types="node" />
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { GIULIA, LocaleApi, PRINCIPALE, ZAINO } from './giro-052-fake-api';

// Round 055, T16 part 1 (docs/lab/giri/055-piano.md, A0–A5): the dark theme. The theme follows
// the system (`prefers-color-scheme`), live; every visible text keeps at least 4.5:1 on its
// background, measured on the DOM; the document says `color-scheme: light dark`; screenshots of
// the five main screens in light and dark, mobile and desktop. Fake API and demo data of round 052
// (invented). The browser is Italian and so is Giulia. Elements are found by role and name.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const DARK_BG = 'rgb(17, 20, 24)'; // darkColors.bg #111418
const DARK_TEXT = 'rgb(232, 236, 241)'; // darkColors.text #E8ECF1
const LIGHT_BG = 'rgb(243, 245, 247)'; // colors.bg #F3F5F7

type Screen = {
  name: string;
  path: string;
  title: string;
  signedIn: boolean;
  /** Something that proves the screen shows its data, not an empty or error state. */
  content?: (page: Page) => Locator;
};

const SCREENS: Screen[] = [
  { name: 'login', path: '/login', title: 'Accedi a planforhome', signedIn: false },
  {
    name: 'families',
    path: '/families',
    title: 'Scegli una famiglia',
    signedIn: true,
    content: (page) => page.getByRole('link', { name: 'Famiglia Mamma', exact: true }),
  },
  {
    name: 'family',
    path: `/family?id=${PRINCIPALE}`,
    title: 'Famiglia Principale',
    signedIn: true,
    content: (page) =>
      page.getByRole('listitem').filter({ has: page.getByText('Marco', { exact: true }) }),
  },
  {
    name: 'tasks',
    path: '/tasks',
    title: 'Tutte le mie famiglie',
    signedIn: true,
    content: (page) => page.getByText(ZAINO, { exact: true }).first(),
  },
  { name: 'me', path: '/me', title: 'Ciao, Giulia', signedIn: true },
];

const GALLERIES: Screen[] = [
  { name: 'gallery', path: '/gallery', title: 'Galleria del kit', signedIn: false },
  {
    name: 'gallery-form',
    path: '/gallery?set=form',
    title: 'Galleria del kit — form',
    signedIn: false,
  },
];

async function open(page: Page, context: BrowserContext, screen: Screen): Promise<Locator> {
  const api = new LocaleApi(page, context);
  await api.install();
  if (screen.signedIn) await api.openSession(GIULIA);
  await page.goto(screen.path);
  const heading = page.getByRole('heading', { level: 1, name: screen.title, exact: true });
  // Waiting for the heading by role waits for the hydration (the export is prerendered).
  await expect(heading).toBeVisible();
  if (screen.content) await expect(screen.content(page), `${screen.name} content`).toBeVisible();
  return heading;
}

/**
 * The container of `Screen` around the title: the first ancestor of the heading with a non
 * transparent background. Its colour, the colour of the heading and whether it fills the viewport
 * (the container of `Screen` is `flex: 1`, a card is not).
 */
async function screenContainer(
  heading: Locator,
): Promise<{ bg: string; text: string; fills: boolean; tag: string }> {
  return heading.evaluate((h) => {
    const text = getComputedStyle(h).color;
    for (let a: Element | null = h.parentElement; a; a = a.parentElement) {
      if (a === document.body || a === document.documentElement) break;
      const bg = getComputedStyle(a).backgroundColor;
      const transparent = bg === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(bg);
      if (transparent) continue;
      const r = a.getBoundingClientRect();
      const fills =
        r.width >= document.documentElement.clientWidth - 1 && r.height >= window.innerHeight - 1;
      return { bg, text, fills, tag: a.tagName };
    }
    return { bg: 'none below body', text, fills: false, tag: '' };
  });
}

/**
 * Every visible text whose colour has less than 4.5:1 on the background behind it: the first non
 * transparent backgrounds going up the ancestors, composed with their alpha over white if nothing
 * opaque is found. Disabled controls (`aria-disabled`, `disabled`) are exempt (WCAG 1.4.3,
 * inactive components); their opacity 0.45 is not measured. Inputs: the text nodes only.
 */
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

function source(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), 'utf8');
}

test.describe('giro 055 — dark theme (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('A0 expo-system-ui is a dependency and a config plugin of app.json', () => {
    const pkg = JSON.parse(source('package.json')) as { dependencies?: Record<string, string> };
    expect(Object.keys(pkg.dependencies ?? {}), 'package.json dependencies').toContain(
      'expo-system-ui',
    );
    const config = JSON.parse(source('app.json')) as {
      expo: { userInterfaceStyle?: string; plugins?: (string | [string, unknown])[] };
    };
    expect(config.expo.userInterfaceStyle).toBe('automatic');
    const plugins = (config.expo.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
    expect(plugins, 'app.json plugins').toContain('expo-system-ui');
  });

  for (const screen of SCREENS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`A1 ${screen.name} in ${scheme}: the container of Screen and the title follow the system`, async ({
        page,
        context,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        const heading = await open(page, context, screen);
        const want = scheme === 'dark' ? DARK_BG : LIGHT_BG;
        await expect.poll(async () => (await screenContainer(heading)).bg).toBe(want);
        const box = await screenContainer(heading);
        expect(box.fills, `${screen.name}: the container fills the viewport`).toBe(true);
        if (scheme === 'dark') expect(box.text, `${screen.name} title`).toBe(DARK_TEXT);
      });
    }
  }

  test('A2 /families: light to dark without reloading, the theme follows the system live', async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const families = SCREENS.find((s) => s.name === 'families')!;
    const heading = await open(page, context, families);
    await expect.poll(async () => (await screenContainer(heading)).bg).toBe(LIGHT_BG);
    let reloaded = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) reloaded = true;
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(async () => (await screenContainer(heading)).bg).toBe(DARK_BG);
    expect((await screenContainer(heading)).text).toBe(DARK_TEXT);
    expect(reloaded, 'no navigation').toBe(false);
  });

  for (const screen of [...SCREENS, ...GALLERIES]) {
    test(`A3 ${screen.name} in dark: every visible text has at least 4.5:1 on its background`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: 'dark' });
      const heading = await open(page, context, screen);
      // Measured once the dark theme is applied, not on the prerendered light page.
      await expect.poll(async () => (await screenContainer(heading)).text).toBe(DARK_TEXT);
      expect(await lowContrastTexts(page)).toEqual([]);
    });
  }

  test('A4 the document says color-scheme light dark, in the export and after hydration', async ({
    page,
    context,
  }) => {
    const served = await (await page.request.get('/families')).text();
    expect(served).toMatch(/<meta[^>]+name="color-scheme"[^>]+content="light dark"/);
    await open(
      page,
      context,
      SCREENS.find((s) => s.name === 'login')!,
    );
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      'content',
      'light dark',
    );
  });

  for (const screen of SCREENS) {
    for (const scheme of ['light', 'dark'] as const) {
      for (const [viewport, width, height] of [
        ['mobile', 390, 844],
        ['desktop', 1280, 800],
      ] as const) {
        test(`A5 screenshot ${screen.name} ${scheme} ${viewport}`, async ({ page, context }) => {
          await page.setViewportSize({ width, height });
          await page.emulateMedia({ colorScheme: scheme });
          const heading = await open(page, context, screen);
          const want = scheme === 'dark' ? DARK_BG : LIGHT_BG;
          await expect.poll(async () => (await screenContainer(heading)).bg).toBe(want);
          const file = `${SCREENSHOTS}/t16-${screen.name}-${scheme}-${viewport}.png`;
          await page.screenshot({ path: file, fullPage: true });
          expect(statSync(join(APP, file)).size).toBeGreaterThan(0);
        });
      }
    }
  }
});
