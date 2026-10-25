/// <reference types="node" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Round 046, T13 part 1 (docs/lab/giri/046-piano.md, B10): the list kit in the gallery at
// /gallery?set=list, at 390 and 1280 px, with the test font multiplier `?fs=` of round 044. Local
// actions only (no network). /gallery without `set` stays the gallery of round 044.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';
const TITLE = 'Galleria del kit — lista';
const LONG = "Rinnovare la carta d'identità di Franco prima della scadenza fra dieci giorni";

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

/** Same measure as A5 of round 044: text out of the viewport or cut by a clipping ancestor. */
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

async function openList(page: Page, fs: number): Promise<void> {
  await page.goto(`/gallery?set=list&fs=${fs}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TITLE);
  const long = page.getByText(LONG, { exact: true }).first();
  // The prerendered page has fs=1; after hydration the query applies.
  await expect.poll(() => fontSize(long)).toBe(18 * fs);
}

test.describe('list kit in the gallery (B10)', () => {
  test.use({ locale: 'it-IT' });

  for (const width of [390, 1280]) {
    for (const fs of [1, 2]) {
      test(`B10 /gallery?set=list at ${width}px, fs ${fs}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await openList(page, fs);

        // The components of T13 are there.
        await expect(page.getByRole('tablist', { name: 'Filtro', exact: true })).toBeVisible();
        for (const name of ['Marco', 'Giulia', 'Leo', 'Sofia']) {
          await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
        }
        await expect(page.getByText('Famiglia Principale', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Alta', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('Annullato', { exact: true }).first()).toBeVisible();

        expect(await cutTexts(page)).toEqual([]);

        const boxes = page.getByRole('checkbox');
        expect(await boxes.count()).toBeGreaterThan(0);
        for (const box of await boxes.all()) {
          const r = (await box.boundingBox())!;
          expect(r.width).toBeGreaterThanOrEqual(48);
          expect(r.height).toBeGreaterThanOrEqual(48);
        }
        const take = page.getByRole('button', { name: 'Prendi', exact: true }).first();
        await expect(take).toBeVisible();
        expect((await take.boundingBox())!.height).toBeGreaterThanOrEqual(56);

        const path = `${SCREENSHOTS}/tasks-list-${width}-fs${fs}.png`;
        await page.screenshot({ path, fullPage: true });
        expect(statSync(join(APP, path)).size).toBeGreaterThan(0);

        // The checkbox still works: local done, the notice with «Annulla».
        const open = page.getByRole('checkbox', { checked: false }).first();
        await open.click();
        const notice = page.getByRole('alert').filter({ hasText: 'Fatto:' });
        await expect(notice.getByRole('button', { name: 'Annulla', exact: true })).toBeVisible();

        // /gallery without `set` stays the gallery of round 044: no component of T13.
        await page.goto('/gallery');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Galleria del kit');
        await expect(page.getByRole('heading', { level: 2 })).toHaveText([
          'Testo',
          'Bottoni',
          'Campi',
          'Avvisi',
        ]);
        await expect(page.getByRole('checkbox')).toHaveCount(0);
        await expect(page.getByRole('tablist')).toHaveCount(0);
      });
    }
  }
});
