/// <reference types="node" />
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  ANNA,
  FakeApi,
  GIULIA,
  LISTA_ID,
  MAMMA,
  NONNA,
  NONNA_ID,
  PRINCIPALE,
  SABATO_ID,
  type Person,
} from './giro-019-fake-api';

// Round 053, T15 part 2 (docs/lab/giri/053-piano.md, S1, D1–D7, V1): the shopping list made of
// the kit. Checked and struck items are told apart not only by colour (a drawn tick, a line
// through), every target is at least 48 px, «Nuova voce» has a visible label. The fake API of
// round 019 is used as it is. Elements are found by role and accessible name.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const IT = {
  toGet: 'Da prendere',
  checked: 'Spuntate',
  removed: 'Voci tolte',
  newItem: 'Nuova voce',
  empty: 'Nessuna voce.',
};

let api: FakeApi;

async function open(
  page: Page,
  context: BrowserContext,
  who: Person,
  family: string,
  task: string,
  fs?: number,
): Promise<void> {
  api = new FakeApi(page, context);
  await api.install();
  await api.openSession(who);
  await page.goto(`/list?family=${family}&task=${task}${fs ? `&fs=${fs}` : ''}`);
}

async function nonna(page: Page, context: BrowserContext, fs?: number): Promise<Locator> {
  await open(page, context, ANNA, MAMMA, NONNA_ID, fs);
  const title = page.getByRole('heading', { level: 1, name: NONNA, exact: true });
  await expect(title).toBeVisible();
  if (fs) await expect.poll(() => fontSize(title)).toBe(24 * fs);
  return title;
}

function list(page: Page, name: string): Locator {
  return page.getByRole('list', { name, exact: true });
}

function section(page: Page, name: string): Locator {
  return page.getByRole('heading', { level: 2, name, exact: true });
}

function checkbox(scope: Page | Locator, name: string): Locator {
  return scope.getByRole('checkbox', { name, exact: true });
}

function itemsPath(id: string): string {
  return `/api/families/${MAMMA}/tasks/${NONNA_ID}/items/${id}/checked`;
}

/** Font size of the element that holds the first text node. */
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

/** Whether the element, or an ancestor up to `stopRole`, draws a line through the text. */
async function struck(locator: Locator, stopRole: string): Promise<boolean> {
  return locator.evaluate((el, stop) => {
    for (let a: Element | null = el; a; a = a.parentElement) {
      if (getComputedStyle(a).textDecorationLine.includes('line-through')) return true;
      if (a.getAttribute('role') === stop) break;
    }
    return false;
  }, stopRole);
}

/** Visible descendants with an area: the drawn tick is one more element inside the box. */
async function drawnParts(locator: Locator): Promise<number> {
  return locator.evaluate(
    (root) =>
      Array.from(root.querySelectorAll('*')).filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width * r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      }).length,
  );
}

/** Same measure as rounds 046, 047 and 052: text out of the viewport or cut by an ancestor. */
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

function source(...parts: string[]): string {
  return readFileSync(join(APP, ...parts), 'utf8');
}

test.describe('giro 053 — the shopping list made of the kit (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('S1 ShoppingList and /list use the kit only; ListRow exists without literal colours', () => {
    const listRow = join(APP, 'src', 'ui', 'ListRow.tsx');
    expect(existsSync(listRow), 'src/ui/ListRow.tsx exists').toBe(true);
    expect(source('src', 'ui', 'ListRow.tsx')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const parts of [
      ['src', 'shopping', 'ShoppingList.tsx'],
      ['app', 'list.tsx'],
    ]) {
      const file = parts.join('/');
      const text = source(...parts);
      expect(text, file).not.toMatch(/StyleSheet/);
      expect(text, file).not.toMatch(/\bstyle=/);
      expect(text, file).not.toMatch(/from\s+['"]@\/ui\/tokens['"]/);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      const native = /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/.exec(text);
      const names = native ? native[1].split(',').map((n) => n.trim()) : [];
      for (const banned of ['Text', 'Pressable', 'ScrollView', 'TextInput']) {
        expect(names, `${file} imports ${banned} from react-native`).not.toContain(banned);
      }
    }
  });

  test('D1 Anna: three visible section titles (heading 2) and three lists with the same names', async ({
    page,
    context,
  }) => {
    await nonna(page, context);
    for (const name of [IT.toGet, IT.checked, IT.removed]) {
      await expect(section(page, name), name).toBeVisible();
      await expect(list(page, name), name).toBeVisible();
    }
  });

  test('D1 Giulia on her list: only «Da prendere», no title for empty sections', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA, PRINCIPALE, LISTA_ID);
    await expect(section(page, IT.toGet)).toBeVisible();
    await expect(checkbox(list(page, IT.toGet), 'Latte')).toBeVisible();
    await expect(page.getByRole('heading', { name: IT.checked, exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: IT.removed, exact: true })).toHaveCount(0);
  });

  test('D1 Giulia on «Spesa del sabato»: «Da prendere» says «Nessuna voce.», «Spuntate» has Pane', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA, MAMMA, SABATO_ID);
    await expect(section(page, IT.toGet)).toBeVisible();
    await expect(list(page, IT.toGet).getByText(IT.empty, { exact: true })).toBeVisible();
    await expect(section(page, IT.checked)).toBeVisible();
    await expect(checkbox(list(page, IT.checked), 'Pane')).toBeVisible();
    await expect(page.getByRole('heading', { name: IT.removed, exact: true })).toHaveCount(0);
  });

  test('D2 a checked item shows a drawn tick, not only a colour', async ({ page, context }) => {
    await nonna(page, context);
    const zucchero = checkbox(list(page, IT.checked), 'Zucchero');
    await expect(zucchero).toHaveAttribute('aria-checked', 'true');
    const uova = checkbox(list(page, IT.toGet), 'Uova');
    const farina = checkbox(list(page, IT.toGet), 'Farina');
    await expect(uova).toHaveAttribute('aria-checked', 'false');
    await expect(farina).toHaveAttribute('aria-checked', 'false');
    const ticked = await drawnParts(zucchero);
    const plain = await drawnParts(uova);
    expect(ticked, `parts drawn in «Zucchero» (${ticked}) vs «Uova» (${plain})`).toBeGreaterThan(
      plain,
    );
  });

  test('D3 a struck item has a line through, a smaller «tolta da Luca» and its two buttons', async ({
    page,
    context,
  }) => {
    await nonna(page, context);
    const removed = list(page, IT.removed);
    const sale = removed.getByText('Sale', { exact: true });
    await expect(sale).toBeVisible();
    expect(await struck(sale, 'listitem'), '«Sale» has line-through').toBe(true);
    const by = removed.getByText('tolta da Luca', { exact: true });
    await expect(by).toBeVisible();
    expect(await fontSize(by), '«tolta da Luca» is meta, smaller than «Sale»').toBeLessThan(
      await fontSize(sale),
    );
    await expect(
      removed.getByRole('button', { name: 'Ripristina «Sale»', exact: true }),
    ).toBeVisible();
    await expect(removed.getByRole('button', { name: 'Togli «Sale»', exact: true })).toBeVisible();
    // Measured inside the checkbox: the disabled buttons of the row are struck by the kit.
    const uova = checkbox(list(page, IT.toGet), 'Uova').getByText('Uova', { exact: true });
    await expect(uova).toBeVisible();
    expect(await struck(uova, 'checkbox'), '«Uova» has no line-through').toBe(false);
  });

  for (const fs of [1, 2]) {
    test(`D4 at font scale ${fs}: every checkbox and button at least 48 px; buttons of a row 8 px apart`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await nonna(page, context, fs);
      const targets = [
        ...(await page.getByRole('checkbox').all()),
        ...(await page.getByRole('button').all()),
      ];
      expect(targets.length).toBeGreaterThanOrEqual(10);
      for (const target of targets) {
        const name = await target.getAttribute('aria-label');
        const box = await target.boundingBox();
        expect(box, `${name} has a box`).not.toBeNull();
        expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(48);
      }
      const names = ['Togli «Uova»', 'Sposta su «Uova»', 'Sposta giù «Uova»'];
      const boxes = [];
      for (const name of names) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        expect(box, name).not.toBeNull();
        boxes.push(box!);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
          const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
          const pair = `${names[i]} / ${names[j]}`;
          expect(dx >= 0 || dy >= 0, `${pair} do not overlap`).toBe(true);
          expect(Math.max(dx, dy), `${pair} gap`).toBeGreaterThanOrEqual(8);
        }
      }
    });
  }

  test('D5 «Nuova voce» has a visible label above the field; Enter adds once and keeps the focus', async ({
    page,
    context,
  }) => {
    await nonna(page, context);
    const label = page.getByText(IT.newItem, { exact: true });
    const field = page.getByRole('textbox', { name: IT.newItem, exact: true });
    await expect(label).toBeVisible();
    await expect(field).toBeVisible();
    const l = (await label.boundingBox())!;
    const f = (await field.boundingBox())!;
    expect(l.y + l.height, 'the label is above the field').toBeLessThanOrEqual(f.y + 1);

    await field.fill('Burro');
    await field.press('Enter');
    await expect(checkbox(list(page, IT.toGet), 'Burro')).toBeVisible();
    const posts = api.calls('POST', `/api/families/${MAMMA}/tasks/${NONNA_ID}/items`);
    expect(posts).toHaveLength(1);
    expect(posts[0].postDataJSON()).toMatchObject({ text: 'Burro' });
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
  });

  test('D6 a click on the text «Uova» checks it: one PUT checked:true, «Uova» in «Spuntate»', async ({
    page,
    context,
  }) => {
    await nonna(page, context);
    const id = api.itemOf(NONNA_ID, 'Uova').id;
    const text = checkbox(list(page, IT.toGet), 'Uova').getByText('Uova', { exact: true });
    await expect(text).toBeVisible();
    await text.click();
    await expect(checkbox(list(page, IT.checked), 'Uova')).toHaveAttribute('aria-checked', 'true');
    const puts = api.calls('PUT', itemsPath(id));
    expect(puts).toHaveLength(1);
    expect(puts[0].postDataJSON()).toMatchObject({ checked: true });
  });

  test('D7 a double click on «Uova»: at most two PUT, all checked:true, «Uova» once in «Spuntate»', async ({
    page,
    context,
  }) => {
    await nonna(page, context);
    const id = api.itemOf(NONNA_ID, 'Uova').id;
    const text = checkbox(list(page, IT.toGet), 'Uova').getByText('Uova', { exact: true });
    await expect(text).toBeVisible();
    await text.dblclick();
    await expect(checkbox(list(page, IT.checked), 'Uova')).toBeVisible();
    // Let a late second write land before counting.
    await page.waitForTimeout(500);
    const puts = api.calls('PUT', itemsPath(id));
    expect(puts.length).toBeGreaterThanOrEqual(1);
    expect(puts.length).toBeLessThanOrEqual(2);
    for (const put of puts) expect(put.postDataJSON()).toMatchObject({ checked: true });
    await expect(checkbox(list(page, IT.checked), 'Uova')).toHaveCount(1);
    await expect(checkbox(list(page, IT.toGet), 'Uova')).toHaveCount(0);
    expect(api.itemOf(NONNA_ID, 'Uova').checked).toBe(true);
  });

  for (const width of [390, 1280]) {
    for (const fs of [1, 2]) {
      test(`V1 /list at ${width}px, font scale ${fs}: title scaled, nothing cut, screenshot`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        const title = await nonna(page, context, fs);
        // type.title is 24 px; the prerendered page has fs=1, the query applies after hydration.
        await expect.poll(() => fontSize(title)).toBe(24 * fs);
        await expect(checkbox(page, 'Zucchero')).toBeVisible();
        expect(await cutTexts(page)).toEqual([]);
        const file = `${SCREENSHOTS}/t15-list-${width}-fs${fs}.png`;
        await page.screenshot({ path: file, fullPage: true });
        expect(statSync(join(APP, file)).size).toBeGreaterThan(0);
      });
    }
  }
});
