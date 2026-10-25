/// <reference types="node" />
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { GIULIA, LocaleApi, MAMMA, PRINCIPALE } from './giro-052-fake-api';

// Round 052, T15 part 1 (docs/lab/giri/052-piano.md, S1, P1–P3, G1, V1): /families, /me and
// /family made of the kit, and the new `LinkRow` of the kit (a real `<a href>` at least 48 px
// high). The browser is Italian and so is Giulia. Elements are found by role and accessible name;
// the texts are the ones of the dictionaries and of the plan.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const IT = {
  families: 'Scegli una famiglia',
  all: 'Tutte le mie famiglie',
  greeting: 'Ciao, Giulia',
  signOut: 'Esci',
  people: 'Persone',
  manager: 'Gestore',
  member: 'Membro',
  resource: 'Senza account',
};

/** The gallery entry of LinkRow (`/gallery?set=form`), English browser, decided in the plan. */
const GALLERY_LINK =
  'Go to every family you belong to, including the ones shared with the grandparents';

let api: LocaleApi;

async function signedIn(page: Page, context: BrowserContext, path: string): Promise<void> {
  api = new LocaleApi(page, context);
  await api.install();
  await api.openSession(GIULIA);
  await page.goto(path);
}

function link(page: Page, name: string): Locator {
  return page.getByRole('link', { name, exact: true });
}

/** Height of the element and whether it is an `<a>` with an href (the DOM, not the wrapper). */
async function anchorBox(
  target: Locator,
): Promise<{ tag: string; href: string | null; h: number }> {
  return target.evaluate((el) => ({
    tag: el.tagName,
    href: el.getAttribute('href'),
    h: el.getBoundingClientRect().height,
  }));
}

/** Same measure as rounds 046 and 047: text out of the viewport or cut by a clipping ancestor. */
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

async function fontSize(locator: Locator): Promise<number> {
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
    return parseFloat(getComputedStyle(holder).fontSize);
  });
}

function source(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), 'utf8');
}

test.describe('giro 052 — screens made of the kit (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('S1 /family, /families and /me use the kit only; LinkRow has no literal colour', () => {
    const linkRow = join(APP, 'src', 'ui', 'LinkRow.tsx');
    expect(existsSync(linkRow), 'src/ui/LinkRow.tsx exists').toBe(true);
    expect(source('src', 'ui', 'LinkRow.tsx')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const file of ['family.tsx', 'families.tsx', 'me.tsx']) {
      const text = source('app', file);
      expect(text, file).not.toMatch(/StyleSheet/);
      expect(text, file).not.toMatch(/\bstyle=/);
      expect(text, file).not.toMatch(/from\s+['"]@\/ui\/tokens['"]/);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      const native = /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/.exec(text);
      const names = native ? native[1].split(',').map((n) => n.trim()) : [];
      for (const banned of ['Text', 'Pressable', 'ScrollView']) {
        expect(names, `${file} imports ${banned} from react-native`).not.toContain(banned);
      }
    }
  });

  test('P1 /family: one listitem per person with initials, name and the written role', async ({
    page,
    context,
  }) => {
    await signedIn(page, context, `/family?id=${PRINCIPALE}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Famiglia Principale' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: IT.people, exact: true })).toBeVisible();
    for (const [name, initial, role] of [
      ['Giulia', 'G', IT.manager],
      ['Marco', 'M', IT.member],
      ['Leo', 'L', IT.resource],
    ]) {
      const item = page
        .getByRole('listitem')
        .filter({ has: page.getByText(name, { exact: true }) })
        .filter({ has: page.getByText(role, { exact: true }) });
      await expect(item, name).toHaveCount(1);
      await expect(item.getByText(initial, { exact: true }), `${name} initials`).toBeVisible();
    }
  });

  for (const fs of [1, 2]) {
    test(`P2 /families at font scale ${fs}: three links, each an <a href> at least 48 px high`, async ({
      page,
      context,
    }) => {
      await signedIn(page, context, `/families?fs=${fs}`);
      await expect(page.getByRole('heading', { level: 1, name: IT.families })).toBeVisible();
      for (const name of ['Famiglia Principale', 'Famiglia Mamma', IT.all]) {
        await expect(link(page, name), name).toBeVisible();
        const box = await anchorBox(link(page, name));
        expect(box.tag, name).toBe('A');
        expect(box.href, name).toBeTruthy();
        expect(box.h, name).toBeGreaterThanOrEqual(48);
      }
      await link(page, 'Famiglia Mamma').click();
      await expect(page).toHaveURL(new RegExp(`/family\\?id=${MAMMA}`));
      await expect(page.getByRole('heading', { level: 1, name: 'Famiglia Mamma' })).toBeVisible();
    });

    test(`P3 /me at font scale ${fs}: «Esci» is a button at least 48 px high`, async ({
      page,
      context,
    }) => {
      await signedIn(page, context, `/me?fs=${fs}`);
      const out = page.getByRole('button', { name: IT.signOut, exact: true });
      await expect(out).toBeVisible();
      expect((await out.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    });
  }

  for (const [screen, path, title] of [
    ['families', '/families', IT.families],
    ['me', '/me', IT.greeting],
    ['family', `/family?id=${PRINCIPALE}`, 'Famiglia Principale'],
  ] as const) {
    for (const width of [390, 1280]) {
      for (const fs of [1, 2]) {
        test(`V1 ${screen} at ${width}px, font scale ${fs}: title scaled, nothing cut, screenshot`, async ({
          page,
          context,
        }) => {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
          const sep = path.includes('?') ? '&' : '?';
          await signedIn(page, context, `${path}${sep}fs=${fs}`);
          const heading = page.getByRole('heading', { level: 1, name: title, exact: true });
          await expect(heading).toBeVisible();
          // type.title is 24 px; the prerendered page has fs=1, the query applies after hydration.
          await expect.poll(() => fontSize(heading)).toBe(24 * fs);
          expect(await cutTexts(page)).toEqual([]);
          const file = `${SCREENSHOTS}/t15-${screen}-${width}-fs${fs}.png`;
          await page.screenshot({ path: file, fullPage: true });
          expect(statSync(join(APP, file)).size).toBeGreaterThan(0);
        });
      }
    }
  }
});

test.describe('giro 052 — LinkRow in the gallery (en)', () => {
  test.use({ locale: 'en-US' });

  test('G1 /gallery?set=form: the long LinkRow is one <a href> at least 48 px high, whole text visible', async ({
    page,
    context,
  }) => {
    api = new LocaleApi(page, context);
    await api.install();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/gallery?set=form');
    const row = link(page, GALLERY_LINK);
    await expect(row).toBeVisible();
    const box = await anchorBox(row);
    expect(box.tag).toBe('A');
    expect(box.href).toBeTruthy();
    expect(box.h).toBeGreaterThanOrEqual(48);
    expect(await cutTexts(page)).toEqual([]);
  });
});
