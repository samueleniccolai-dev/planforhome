/// <reference types="node" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Round 044, T12 (docs/lab/giri/044-piano.md): the foundations of the UI kit. Tokens in one file
// (A1, A2), the gallery at /gallery with every component in every state (A3, A4), the test font
// multiplier `?fs=` only in the gallery (A5, A6), preview screenshots (A7), the login screen made
// only of the kit (A8), the gallery gate on a non-local host (A9). Elements are found by role and
// accessible name; the texts are the invented demo data of the plan. In CI Playwright runs on the
// production bundle served on localhost, without a server: the API is faked in the browser.

const APP = resolve(__dirname, '..', '..');
const REPO = resolve(APP, '..');
const SCREENSHOTS = 'e2e-screenshots';
const TOKENS = join(APP, 'src', 'ui', 'tokens.ts');
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

type Gallery = {
  locale: string;
  title: string;
  sections: string[];
  samples: Record<'title' | 'section' | 'body' | 'bodyStrong' | 'meta' | 'caption', string>;
  long: string;
  active: string[];
  disabled: string[];
  probe: string;
  pressedOnce: string;
  pressedTwice: string;
  emptyField: string;
  errorField: string;
  errorValue: string;
  error: string;
  notices: string[];
};

function samples(sentence: string): Gallery['samples'] {
  return {
    title: `title · ${sentence}`,
    section: `section · ${sentence}`,
    body: `body · ${sentence}`,
    bodyStrong: `bodyStrong · ${sentence}`,
    meta: `meta · ${sentence}`,
    caption: `caption · ${sentence}`,
  };
}

const IT: Gallery = {
  locale: 'it-IT',
  title: 'Galleria del kit',
  sections: ['Testo', 'Bottoni', 'Campi', 'Avvisi'],
  samples: samples('Prenotare il pranzo di Natale'),
  long: "Rinnovare la carta d'identità di Franco prima della scadenza fra dieci giorni",
  active: ['Aggiungi', 'Prendi', 'Elimina', 'Annulla'],
  disabled: [
    'Aggiungi (disattivato)',
    'Prendi (disattivato)',
    'Elimina (disattivato)',
    'Annulla (disattivato)',
  ],
  probe: 'Prova il bottone',
  pressedOnce: 'Premuto 1 volta',
  pressedTwice: 'Premuto 2 volte',
  emptyField: 'Titolo del task',
  errorField: 'Email',
  errorValue: 'nonna.rosa@example',
  error: 'Indirizzo email non valido.',
  notices: [
    'Già preso da Giulia.',
    'Accesso non riuscito. Riprova.',
    'Fatto: Mettere fuori la carta.',
  ],
};

const EN: Gallery = {
  locale: 'en-US',
  title: 'Kit gallery',
  sections: ['Text', 'Buttons', 'Fields', 'Notices'],
  samples: samples('Book the Christmas lunch'),
  long: "Renew Franco's identity card before it expires in ten days",
  active: ['Add', 'Take', 'Delete', 'Cancel'],
  disabled: ['Add (disabled)', 'Take (disabled)', 'Delete (disabled)', 'Cancel (disabled)'],
  probe: 'Try the button',
  pressedOnce: 'Pressed 1 time',
  pressedTwice: 'Pressed 2 times',
  emptyField: 'Task title',
  errorField: 'Email',
  errorValue: 'nonna.rosa@example',
  error: 'Invalid email address.',
  notices: ['Already taken by Giulia.', 'Sign-in failed. Try again.', 'Done: Put the paper out.'],
};

type TextStyle = { fontSize: number; lineHeight: number; fontWeight: number; color: string };

/** The computed style of the element that holds the first text node inside the locator. */
async function textStyle(locator: Locator): Promise<TextStyle> {
  return locator.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let holder: Element = root;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent?.trim() && node.parentElement) {
        holder = node.parentElement;
        break;
      }
    }
    const style = getComputedStyle(holder);
    return {
      fontSize: parseFloat(style.fontSize),
      lineHeight: parseFloat(style.lineHeight),
      fontWeight: Number(style.fontWeight),
      color: style.color,
    };
  });
}

async function openGallery(page: Page, g: Gallery, query = ''): Promise<void> {
  await page.goto(`/gallery${query}`);
  await expect(page).toHaveURL(/\/gallery/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(g.title);
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== '__tests__' && name !== 'node_modules') out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

/** The hex values of DESIGN §3.1, read from the document itself. */
function designColors(): string[] {
  const design = readFileSync(join(REPO, 'docs', 'DESIGN.md'), 'utf8');
  const start = design.indexOf('### 3.1');
  const end = design.indexOf('### 3.2');
  const section = design.slice(start, end);
  return [...new Set((section.match(HEX) ?? []).map((h) => h.toLowerCase()))];
}

test.describe('tokens (A1, A2)', () => {
  test('A1 tokens.ts holds every colour of DESIGN §3.1, Okabe-Ito included', () => {
    const colors = designColors();
    expect(colors).toHaveLength(24);
    expect(colors).toContain('#000000');
    expect(existsSync(TOKENS), 'app/src/ui/tokens.ts exists').toBe(true);
    const tokens = readFileSync(TOKENS, 'utf8').toLowerCase();
    const missing = colors.filter((c) => !tokens.includes(c));
    expect(missing).toEqual([]);
  });

  test('A2 no colour literal in app/app and app/src outside tokens.ts', () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles(join(APP, 'app')), ...sourceFiles(join(APP, 'src'))]) {
      if (file === TOKENS) continue;
      const found = readFileSync(file, 'utf8').match(HEX);
      if (found) offenders.push(`${relative(APP, file)}: ${found.join(' ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

for (const g of [IT, EN]) {
  test.describe(`gallery in ${g.locale} (A3)`, () => {
    test.use({ locale: g.locale });

    test('A3 headings, buttons, fields and notices by role and name', async ({ page }) => {
      await openGallery(page, g);

      const sections = page.getByRole('heading', { level: 2 });
      await expect(sections).toHaveText(g.sections);

      for (const sample of Object.values(g.samples)) {
        await expect(page.getByText(sample, { exact: true })).toBeVisible();
      }
      await expect(page.getByText(g.long, { exact: true })).toBeVisible();

      await expect(page.getByRole('button')).toHaveCount(9);
      for (const name of g.active) {
        const button = page.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
        await expect(button).not.toHaveAttribute('aria-disabled', 'true');
      }
      for (const name of g.disabled) {
        const button = page.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute('aria-disabled', 'true');
      }

      const probe = page.getByRole('button', { name: g.probe, exact: true });
      await probe.click();
      await expect(page.getByText(g.pressedOnce, { exact: true })).toBeVisible();

      // The field error is not an alert: only the three notices are.
      await expect(page.getByRole('alert')).toHaveText(g.notices);

      await expect(page.getByRole('textbox')).toHaveCount(2);
      const empty = page.getByLabel(g.emptyField, { exact: true });
      await expect(empty).toBeVisible();
      await expect(empty).not.toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByText(g.emptyField, { exact: true })).toBeVisible();

      const wrong = page.getByLabel(g.errorField, { exact: true });
      await expect(wrong).toBeVisible();
      await expect(wrong).toHaveValue(g.errorValue);
      await expect(wrong).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByText(g.errorField, { exact: true })).toBeVisible();
      await expect(page.getByText(g.error, { exact: true })).toBeVisible();
    });
  });
}

test.describe('gallery tokens (A4)', () => {
  test.use({ locale: 'it-IT' });

  test('A4 typography, colours and touch sizes follow the tokens', async ({ page }) => {
    await openGallery(page, IT);
    const s = IT.samples;
    const expected: [string, number, number, number][] = [
      [s.title, 24, 30, 700],
      [s.section, 14, 18, 700],
      [s.body, 18, 25, 400],
      [s.bodyStrong, 18, 25, 600],
      [s.meta, 16, 21, 400],
      [s.caption, 14, 19, 400],
    ];
    for (const [text, size, line, weight] of expected) {
      const { fontSize, lineHeight, fontWeight } = await textStyle(
        page.getByText(text, { exact: true }),
      );
      expect({ text, fontSize, lineHeight, fontWeight }).toEqual({
        text,
        fontSize: size,
        lineHeight: line,
        fontWeight: weight,
      });
    }
    // color.text #14181D on the body sample.
    expect((await textStyle(page.getByText(s.body, { exact: true }))).color).toBe(
      'rgb(20, 24, 29)',
    );

    // Primary: color.accent #1849A9 with onAccent #FFFFFF, at least 56 high, label at least 18.
    const primary = page.getByRole('button', { name: 'Aggiungi', exact: true });
    expect(await primary.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgb(24, 73, 169)',
    );
    const label = await textStyle(primary);
    expect(label.color).toBe('rgb(255, 255, 255)');
    expect(label.fontSize).toBeGreaterThanOrEqual(18);
    expect((await primary.boundingBox())!.height).toBeGreaterThanOrEqual(56);

    // Every other button at least 48 high; buttons stacked with at least 8 between them.
    const boxes: { name: string; y: number; bottom: number; height: number }[] = [];
    for (const name of [...IT.active, ...IT.disabled, IT.probe]) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.height, `${name} height`).toBeGreaterThanOrEqual(48);
      boxes.push({ name, y: box.y, bottom: box.y + box.height, height: box.height });
    }
    boxes.sort((a, b) => a.y - b.y);
    for (let i = 1; i < boxes.length; i++) {
      const gap = boxes[i].y - boxes[i - 1].bottom;
      expect(gap, `gap between ${boxes[i - 1].name} and ${boxes[i].name}`).toBeGreaterThanOrEqual(
        8,
      );
    }
  });
});

/** Text that sticks out of the viewport, or is cut by an ancestor that hides overflow. */
async function cutTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > width + 1) {
      problems.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${width}`);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('input, textarea, script, style, noscript')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < -1 || r.right > width + 1) problems.push(`outside the viewport: ${text}`);
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        const box = a.getBoundingClientRect();
        const scrollsX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
        const scrollsY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
        if (scrollsX && a.scrollWidth > a.clientWidth + 1) {
          problems.push(`horizontal scroll around: ${text}`);
          break;
        }
        const clipX = cs.overflowX !== 'visible' && !scrollsX;
        const clipY = cs.overflowY !== 'visible' && !scrollsY;
        if (
          (clipX && (r.left < box.left - 1 || r.right > box.right + 1)) ||
          (clipY && (r.top < box.top - 1 || r.bottom > box.bottom + 1))
        ) {
          problems.push(`cut: ${text}`);
          break;
        }
      }
    }
    return problems;
  });
}

test.describe('font multiplier in the gallery (A5)', () => {
  test.use({ locale: 'it-IT', viewport: { width: 390, height: 844 } });

  test('A5 ?fs=2 doubles the text, nothing overflows or is cut, the button still works', async ({
    page,
  }) => {
    await openGallery(page, IT, '?fs=2');
    const body = page.getByText(IT.samples.body, { exact: true });
    // The prerendered page has fs=1; after hydration the query applies.
    await expect.poll(async () => (await textStyle(body)).fontSize).toBe(36);
    expect((await textStyle(body)).lineHeight).toBe(50);
    expect((await textStyle(page.getByText(IT.samples.title, { exact: true }))).fontSize).toBe(48);

    expect(await cutTexts(page)).toEqual([]);
    await expect(page.getByText(IT.long, { exact: true })).toBeVisible();

    expect(
      (await page.getByRole('button', { name: 'Aggiungi', exact: true }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(56);

    const probe = page.getByRole('button', { name: IT.probe, exact: true });
    await probe.click();
    await expect(page.getByText(IT.pressedOnce, { exact: true })).toBeVisible();
    await probe.click();
    await expect(page.getByText(IT.pressedTwice, { exact: true })).toBeVisible();
  });

  test('A5 ?fs=1.5 gives 27px, a value not allowed falls back to 18px', async ({ page }) => {
    await openGallery(page, IT, '?fs=1.5');
    const body = page.getByText(IT.samples.body, { exact: true });
    await expect.poll(async () => (await textStyle(body)).fontSize).toBe(27);

    await openGallery(page, IT, '?fs=3');
    // Give the client a chance to apply a wrong value before checking it did not.
    await page.waitForTimeout(500);
    expect((await textStyle(page.getByText(IT.samples.body, { exact: true }))).fontSize).toBe(18);
  });
});

/** The fake API for /login: no session, and the login answers 401 when released. */
async function fakeApi(page: Page): Promise<{ logins: () => number; release: () => void }> {
  let logins = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((done) => (release = done));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST' && path === '/api/auth/login') {
      logins++;
      await gate;
      return route.fulfill({ status: 401, json: { error: 'invalid_credentials' } });
    }
    return route.fulfill({ status: 401, json: { error: 'unauthenticated' } });
  });
  return { logins: () => logins, release: () => release() };
}

test.describe('the multiplier stays in the gallery (A6)', () => {
  test.use({ locale: 'it-IT' });

  test('A6 /login?fs=2 keeps the token sizes', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/login?fs=2');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText('Accedi a planforhome');
    await page.waitForTimeout(500);
    expect((await textStyle(title)).fontSize).toBe(24);
    const email = page.getByLabel('Email', { exact: true });
    expect(await email.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(18);
  });
});

test.describe('gallery screenshots (A7)', () => {
  test.use({ locale: 'it-IT' });

  for (const width of [390, 1280]) {
    for (const fs of [1, 2]) {
      test(`A7 gallery at ${width}px, fs ${fs}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await openGallery(page, IT, `?fs=${fs}`);
        const body = page.getByText(IT.samples.body, { exact: true });
        await expect.poll(async () => (await textStyle(body)).fontSize).toBe(18 * fs);
        const path = `${SCREENSHOTS}/gallery-${width}-fs${fs}.png`;
        await page.screenshot({ path, fullPage: true });
        expect(statSync(join(APP, path)).size).toBeGreaterThan(0);
      });
    }
  }
});

test.describe('login made of the kit (A8)', () => {
  test.use({ locale: 'it-IT' });

  test('A8 login.tsx imports nothing from react-native and has no StyleSheet', () => {
    const source = readFileSync(join(APP, 'app', 'login.tsx'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]react-native['"]/);
    expect(source).not.toMatch(/StyleSheet/);
  });

  test('A8 /login: visible labels, «Accedi» at least 56 high, busy, then the 401 alert', async ({
    page,
  }) => {
    const api = await fakeApi(page);
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accedi a planforhome');

    // Visible labels above the fields, and the fields still found by label.
    await expect(page.getByText('Email', { exact: true })).toBeVisible();
    await expect(page.getByText('Password', { exact: true })).toBeVisible();
    const email = page.getByLabel('Email', { exact: true });
    const password = page.getByLabel('Password', { exact: true });
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    const submit = page.getByRole('button', { name: 'Accedi', exact: true });
    expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    expect((await textStyle(submit)).fontSize).toBeGreaterThanOrEqual(18);

    await email.fill('giulia@example.com');
    await password.fill('Sbagliata-Del-Tutto-9');
    await submit.click();
    // While the login is pending the button is disabled: no second login.
    await expect(submit).toBeDisabled();
    api.release();

    await expect(page.getByRole('alert')).toHaveText('Email o password non corretti.');
    await expect(submit).toBeEnabled();
    expect(api.logins()).toBe(1);
  });
});

test.describe('gallery gate (A9)', () => {
  test.use({ locale: 'en-US' });

  test('A9 the static HTML of /gallery holds no gallery content', async ({ request }) => {
    const response = await request.get('/gallery');
    expect(response.status()).toBe(200);
    const html = await response.text();
    for (const text of [EN.title, IT.title, EN.probe, IT.probe]) {
      expect(html, `prerendered HTML contains «${text}»`).not.toContain(text);
    }
  });

  test('A9 on 127.0.0.1 the gallery opens', async ({ page }) => {
    await page.goto('http://127.0.0.1:8081/gallery');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(EN.title);
  });

  test('A9 on a host that is not local /gallery goes back to /', async ({ page }) => {
    // 127.0.0.2 reaches the same local server, but it is neither localhost nor 127.0.0.1.
    await page.goto('http://127.0.0.2:8081/gallery');
    await expect(page).toHaveURL('http://127.0.0.2:8081/');
    await expect(page.getByRole('heading', { name: EN.title })).toHaveCount(0);
  });
});
