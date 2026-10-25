/// <reference types="node" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Round 049, T14 part 1 (docs/lab/giri/049-piano.md, K2): the form kit in the gallery at
// /gallery?set=form, at 390 and 1280 px, with the test font multiplier `?fs=` of round 044:
// `TextField` with a hint, `CheckRow`, `RadioGroup` + `RadioRow`, `DateField` (web), `Sheet`.
// Local actions only (no network). /gallery and /gallery?set=list stay as they are. Elements are
// found by role and accessible name; the texts are the invented demo data of the plan.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const K = {
  title: 'Galleria del kit — form',
  field: 'Nota per Leo',
  hint: 'La vede solo la famiglia.',
  remind: 'Ricordamelo la sera prima',
  adults: 'Solo per gli adulti',
  who: 'Chi lo fa',
  people: ['Giulia', 'Marco', 'Leo'],
  date: 'Data della gita',
  noDate: 'Nessuna scadenza',
  clearDate: 'Togli la scadenza',
  openSheet: 'Apri il pannello',
  sheet: 'Pannello di prova',
  sheetBody: 'Contenuto del pannello.',
  close: 'Chiudi',
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

/** Same measure as round 046: text out of the viewport or cut by a clipping ancestor. */
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

test.describe('form kit in the gallery (K2)', () => {
  test.use({ locale: 'it-IT' });

  for (const width of [390, 1280]) {
    for (const fs of [1, 2]) {
      test(`K2 /gallery?set=form at ${width}px, fs ${fs}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await openForm(page, fs);

        // TextField with a hint linked to the field.
        const note = page.getByRole('textbox', { name: K.field, exact: true });
        await expect(note).toBeVisible();
        await expect(note).toHaveAccessibleDescription(K.hint);
        await expect(page.getByText(K.hint, { exact: true })).toBeVisible();

        // CheckRow: the whole row is the checkbox, with its text label.
        const remind = page.getByRole('checkbox', { name: K.remind, exact: true });
        const adults = page.getByRole('checkbox', { name: K.adults, exact: true });
        await expect(remind).toHaveAttribute('aria-checked', 'false');
        await expect(adults).toBeDisabled();
        expect(await height(remind)).toBeGreaterThanOrEqual(48);
        const row = (await remind.boundingBox())!;
        const text = (await page.getByText(K.remind, { exact: true }).boundingBox())!;
        expect(text.x).toBeGreaterThanOrEqual(row.x - 1);
        expect(text.x + text.width).toBeLessThanOrEqual(row.x + row.width + 1);
        await page.getByText(K.remind, { exact: true }).click(); // a tap on the text toggles
        await expect(remind).toHaveAttribute('aria-checked', 'true');

        // RadioGroup with a visible heading and a column of radios.
        const group = page.getByRole('radiogroup', { name: K.who, exact: true });
        await expect(group).toBeVisible();
        await expect(page.getByText(K.who, { exact: true })).toBeVisible();
        await expect(group.getByRole('radio')).toHaveCount(K.people.length);
        for (const name of K.people) {
          const radio = group.getByRole('radio', { name, exact: true });
          await expect(radio).toHaveAttribute('aria-checked', name === 'Giulia' ? 'true' : 'false');
          expect(await height(radio)).toBeGreaterThanOrEqual(48);
        }
        await group.getByRole('radio', { name: 'Leo', exact: true }).click();
        await expect(group.getByRole('radio', { name: 'Leo', exact: true })).toHaveAttribute(
          'aria-checked',
          'true',
        );
        await expect(group.getByRole('radio', { checked: true })).toHaveCount(1);

        // DateField on the web: the value is always written.
        const date = page.getByRole('textbox', { name: K.date, exact: true });
        await expect(date).toBeVisible();
        expect(await height(date)).toBeGreaterThanOrEqual(48);
        await expect(page.getByText(K.noDate, { exact: true })).toBeVisible();
        await date.fill('2026-10-30');
        await expect(page.getByText(K.noDate, { exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: K.clearDate, exact: true }).click();
        await expect(page.getByText(K.noDate, { exact: true })).toBeVisible();

        expect(await cutTexts(page)).toEqual([]);
        const path = `${SCREENSHOTS}/form-kit-${width}-fs${fs}.png`;
        await page.screenshot({ path, fullPage: true });
        expect(statSync(join(APP, path)).size).toBeGreaterThan(0);

        // Sheet: a modal dialog named by its visible title, «Chiudi», Esc, focus back.
        const trigger = page.getByRole('button', { name: K.openSheet, exact: true });
        await trigger.click();
        const sheet = page.getByRole('dialog', { name: K.sheet, exact: true });
        await expect(sheet).toBeVisible();
        await expect(sheet).toHaveAttribute('aria-modal', 'true');
        await expect(sheet.getByText(K.sheet, { exact: true })).toBeVisible();
        await expect(sheet.getByText(K.sheetBody, { exact: true })).toBeVisible();
        const close = sheet.getByRole('button', { name: K.close, exact: true });
        expect(await height(close)).toBeGreaterThanOrEqual(48);
        const box = (await sheet.boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(await cutTexts(page)).toEqual([]);
        await close.click();
        await expect(sheet).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(sheet).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(sheet).toHaveCount(0);
        await expect(trigger).toBeFocused();
      });
    }
  }
});
