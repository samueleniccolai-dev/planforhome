/// <reference types="node" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Round 050, T14 part 2 (docs/lab/giri/050-piano.md, G1): the `ConfirmDialog` of the kit in the
// gallery at /gallery?set=form, at 390 and 1280 px, with the test font multiplier `?fs=` of round
// 044. A modal dialog named by its title, the consequence always written and used as the accessible
// description of the destructive button, the initial focus on the least destructive button, Esc
// and the cancel button close it and give the focus back. Local actions only (no network).

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const K = {
  title: 'Galleria del kit — form',
  remind: 'Ricordamelo la sera prima',
  open: 'Apri la conferma',
  dialog: 'Togliere la gita dal calendario?',
  consequence: 'La gita sparisce per tutta la famiglia.',
  confirm: 'Togli la gita',
  keep: 'Tieni la gita',
};

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

/** Same measure as rounds 046 and 049: text out of the viewport or cut by a clipping ancestor. */
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

async function openForm(page: Page, fs: number): Promise<void> {
  await page.goto(`/gallery?set=form&fs=${fs}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(K.title);
  const label = page.getByText(K.remind, { exact: true });
  await expect(label).toBeVisible();
  // The prerendered page has fs=1; after hydration the query applies.
  await expect.poll(() => fontSize(label)).toBe(18 * fs);
}

async function height(target: Locator): Promise<number> {
  return (await target.boundingBox())!.height;
}

test.describe('ConfirmDialog in the gallery (G1)', () => {
  test.use({ locale: 'it-IT' });

  for (const width of [390, 1280]) {
    for (const fs of [1, 2]) {
      test(`G1 /gallery?set=form ConfirmDialog at ${width}px, fs ${fs}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await openForm(page, fs);

        const trigger = page.getByRole('button', { name: K.open, exact: true });
        await expect(trigger).toBeVisible();
        await trigger.click();
        const ask = page.getByRole('dialog', { name: K.dialog, exact: true });
        await expect(ask).toBeVisible();
        await expect(ask).toHaveAttribute('aria-modal', 'true');
        await expect(ask.getByText(K.dialog, { exact: true })).toBeVisible();
        await expect(ask.getByText(K.consequence, { exact: true })).toBeVisible();

        const confirm = ask.getByRole('button', { name: K.confirm, exact: true });
        const keep = ask.getByRole('button', { name: K.keep, exact: true });
        await expect(confirm).toHaveAccessibleDescription(K.consequence);
        await expect(keep).toBeFocused();
        expect(await height(confirm)).toBeGreaterThanOrEqual(48);
        expect(await height(keep)).toBeGreaterThanOrEqual(48);
        const box = (await ask.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(await cutTexts(page)).toEqual([]);
        const path = `${SCREENSHOTS}/confirm-kit-${width}-fs${fs}.png`;
        await page.screenshot({ path, fullPage: true });
        expect(statSync(join(APP, path)).size).toBeGreaterThan(0);

        await keep.click();
        await expect(ask).toHaveCount(0);
        await expect(trigger).toBeFocused();

        await trigger.click();
        await expect(ask).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(ask).toHaveCount(0);
        await expect(trigger).toBeFocused();
      });
    }
  }
});
