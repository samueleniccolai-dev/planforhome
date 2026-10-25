/// <reference types="node" />
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  BICI,
  BICI_ID,
  CARTA,
  CARTA_ID,
  CARTA_NEXT_ID,
  CSRF,
  EXPECTED,
  FakeApi,
  GATTO,
  GATTO_ID,
  GIULIA,
  LEO,
  MAMMA,
  MARCO,
  MENSA,
  MENSA_ID,
  NOW,
  PRINCIPALE,
  SECTIONS_EN,
  SECTIONS_IT,
  SPESA,
  SPESA_ID,
  taskPath,
  UUID_V7,
  ZAINO,
  ZAINO_ID,
} from './giro-047-fake-api';

// Round 047, T13 part 2 (docs/lab/giri/047-piano.md, F1–F12): the list of the family view
// (/family?id=…) made of the list kit. A region labelled «Task della famiglia» holds, per non-empty
// section, a heading 2 and a list labelled with the same name; each task is one listitem with its
// TaskCard, without the family tag. The browser clock is fixed at 2026-11-03T03:00Z and the device
// runs in Asia/Tokyo: sections are computed in the zone of the family. Elements are found by role
// and accessible name; the texts are the ones decided in the plan.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const IT = {
  region: 'Task della famiglia',
  done: (title: string) => `Fatto: ${title}`,
  doneNotice: (title: string) => `Fatto: ${title}.`,
  takenNotice: (title: string) => `Preso: ${title}.`,
  undo: 'Annulla',
  take: 'Prendi',
  oldTake: 'Prendo io',
  oldDone: 'Segna fatto',
  assign: 'Assegna',
  assignTo: (name: string) => `Assegna a ${name}`,
  assigned: (name: string) => `Assegnato a ${name}`,
  queue: 'In coda',
  high: 'Alta',
  cancel: 'Annulla task',
  confirmCancel: 'Conferma annullamento',
  keep: 'Non annullare',
  cancelled: 'Annullato',
  cancelOnce: 'Annulla questa volta',
  endSeries: 'Termina la serie',
  reopen: 'Riapri',
  nudge: (title: string) => `Sollecita «${title}»`,
  forward: (title: string) => `Inoltra «${title}»`,
  openList: (title: string) => `Apri la lista «${title}»`,
  forbidden: 'Non hai il permesso di farlo.',
  changed: 'Il task è cambiato. Ricarico.',
  failed: 'Qualcosa non ha funzionato. Riprova.',
  taken: (name: string) => `Già preso da ${name}.`,
  empty: 'Nessun task.',
  emptyHint: 'Aggiungi il primo task nella tua famiglia.',
  add: 'Aggiungi',
  newTitle: 'Titolo',
  newTask: 'Nuovo task',
};

function region(page: Page): Locator {
  return page.getByRole('region', { name: IT.region, exact: true });
}

function section(page: Page, name: string): Locator {
  return region(page).getByRole('list', { name, exact: true });
}

/** The listitems of the scope holding the exact title. */
function card(scope: Locator, title: string): Locator {
  return scope
    .getByRole('listitem')
    .filter({ has: scope.page().getByText(title, { exact: true }) });
}

function checkbox(scope: Locator, title: string): Locator {
  return scope.getByRole('checkbox', { name: IT.done(title), exact: true });
}

function button(scope: Locator, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function notice(page: Page, text: string): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

function undoIn(page: Page, text: string): Locator {
  return button(notice(page, text), IT.undo);
}

/** Clicks once the control is there: a missing control fails as an assertion, not a timeout. */
async function press(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await target.click();
}

/** Headings 2 and listitems of the region in document order: `# name` for a heading, else text. */
async function domOrder(page: Page): Promise<string[]> {
  await expect(region(page)).toBeVisible();
  return region(page).evaluate((root) => {
    const out: string[] = [];
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const role =
        el.getAttribute('role') ??
        (/^H2$/.test(el.tagName) ? 'heading' : el.tagName === 'LI' ? 'listitem' : '');
      if (role === 'heading' && (el.getAttribute('aria-level') ?? el.tagName.slice(1)) === '2') {
        out.push(`# ${el.textContent?.trim()}`);
      } else if (role === 'listitem') {
        out.push(el.textContent ?? '');
      }
    }
    return out;
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

/** Same measure as round 046 (B10): text out of the viewport or cut by a clipping ancestor. */
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

/** Elements inside the cards whose content is wider than their box. */
async function overflowingInCards(page: Page): Promise<string[]> {
  return region(page).evaluate((root) => {
    const out: string[] = [];
    for (const item of Array.from(root.querySelectorAll('[role="listitem"]'))) {
      for (const el of [item, ...Array.from(item.querySelectorAll('*'))]) {
        const html = el as HTMLElement;
        if (html.clientWidth > 0 && html.scrollWidth > html.clientWidth + 1) {
          out.push(`${html.tagName} «${(html.textContent ?? '').slice(0, 40)}»`);
        }
      }
    }
    return out;
  });
}

let api: FakeApi;

async function open(page: Page, context: BrowserContext, query = ''): Promise<void> {
  api = new FakeApi(page, context);
  await api.install();
  await api.openSession(GIULIA);
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto(`/family?id=${PRINCIPALE}${query}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
}

function mutationIds(method: string, path: string): string[] {
  return api
    .calls(method, path)
    .map((r) => (r.postDataJSON() as { mutationId: string }).mutationId);
}

test.describe('giro 047 — family view on the list kit (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Asia/Tokyo' });

  test('F1 the region «Task della famiglia»: five sections in order, each task in one section', async ({
    page,
    context,
  }) => {
    await open(page, context);
    await expect(region(page).getByRole('heading', { level: 2 })).toHaveText(SECTIONS_IT);
    await expect(region(page).getByRole('listitem')).toHaveCount(6);
    for (const [i, name] of SECTIONS_IT.entries()) {
      const items = section(page, name).getByRole('listitem');
      await expect(items, name).toHaveCount(EXPECTED[i].length);
      for (const [j, title] of EXPECTED[i].entries()) {
        await expect(
          items.nth(j).getByText(title, { exact: true }),
          `${name} #${j + 1}`,
        ).toBeVisible();
      }
    }
    const order = await domOrder(page);
    const expected = SECTIONS_IT.flatMap((name, i) => [`# ${name}`, ...EXPECTED[i]]);
    expect(order).toHaveLength(expected.length);
    order.forEach((entry, k) => {
      if (expected[k].startsWith('# ')) expect(entry).toBe(expected[k]);
      else expect(entry, `position ${k}`).toContain(expected[k]);
    });
    // The old flat list labelled «Task della famiglia» is gone: the name belongs to the region.
    await expect(page.getByRole('list', { name: IT.region, exact: true })).toHaveCount(0);
    expect(api.calls('GET', `/api/families/${PRINCIPALE}/tasks`)).toHaveLength(1);
  });

  test('F2 no family tag, «Alta», «In coda», assignee; the old buttons are gone', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const all = region(page);
    await expect(all.getByText('Famiglia Principale', { exact: true })).toHaveCount(0);
    await expect(card(all, GATTO).getByText(IT.high, { exact: true })).toBeVisible();
    await expect(all.getByText(IT.high, { exact: true })).toHaveCount(1);
    for (const title of [GATTO, SPESA]) {
      await expect(card(all, title).getByText(IT.queue, { exact: true }), title).toBeVisible();
    }
    await expect(card(all, ZAINO).getByText(IT.assigned('Leo'), { exact: true })).toBeVisible();
    await expect(card(all, MENSA).getByText(IT.assigned('Giulia'), { exact: true })).toBeVisible();
    await expect(button(all, IT.oldDone)).toHaveCount(0);
    await expect(button(all, IT.oldTake)).toHaveCount(0);
    // Done task: checkbox ticked and turned off (it replaces «Segna fatto» absent).
    await expect(checkbox(all, BICI)).toHaveAttribute('aria-checked', 'true');
    await expect(checkbox(all, BICI)).toBeDisabled();
  });

  test('F3 checkbox «Fatto»: done, card in «Chiusi»; «Annulla» reopens it back in «Oggi»', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const donePath = taskPath(PRINCIPALE, MENSA_ID, 'done');
    const reopenPath = taskPath(PRINCIPALE, MENSA_ID, 'reopen');

    await press(checkbox(card(section(page, 'Oggi'), MENSA), MENSA));
    await expect(undoIn(page, IT.doneNotice(MENSA))).toBeVisible();
    const sent = api.calls('POST', donePath);
    expect(sent).toHaveLength(1);
    expect(Object.keys(sent[0].postDataJSON() as object)).toEqual(['mutationId']);
    expect(mutationIds('POST', donePath)[0]).toMatch(UUID_V7);
    expect(await sent[0].headerValue('x-csrf-token')).toBe(CSRF);
    await expect(checkbox(section(page, 'Chiusi'), MENSA)).toHaveAttribute('aria-checked', 'true');
    await expect(card(section(page, 'Oggi'), MENSA)).toHaveCount(0);

    await press(undoIn(page, IT.doneNotice(MENSA)));
    await expect(checkbox(section(page, 'Oggi'), MENSA)).toHaveAttribute('aria-checked', 'false');
    await expect(card(section(page, 'Chiusi'), MENSA)).toHaveCount(0);
    await expect(notice(page, IT.doneNotice(MENSA))).toHaveCount(0);
    const reopened = mutationIds('POST', reopenPath);
    expect(reopened).toHaveLength(1);
    expect(reopened[0]).toMatch(UUID_V7);
    expect(reopened[0]).not.toBe(mutationIds('POST', donePath)[0]);
  });

  test('F4 «Prendi» assigns to Giulia; «Annulla» puts it back in the queue', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const gatto = () => card(region(page), GATTO);
    await press(button(gatto(), IT.take));
    await expect(gatto().getByText(IT.assigned('Giulia'), { exact: true })).toBeVisible();
    await expect(button(gatto(), IT.take)).toHaveCount(0);
    const took = mutationIds('POST', taskPath(PRINCIPALE, GATTO_ID, 'take'));
    expect(took).toHaveLength(1);
    expect(took[0]).toMatch(UUID_V7);

    await press(undoIn(page, IT.takenNotice(GATTO)));
    await expect(gatto().getByText(IT.queue, { exact: true })).toBeVisible();
    await expect(button(gatto(), IT.take)).toBeVisible();
    await expect(notice(page, IT.takenNotice(GATTO))).toHaveCount(0);
    const back = api.calls('PUT', taskPath(PRINCIPALE, GATTO_ID, 'assignee'));
    expect(back).toHaveLength(1);
    const body = back[0].postDataJSON() as { mutationId: string; assigneePersonId: string | null };
    expect(body.assigneePersonId).toBeNull();
    expect(body.mutationId).toMatch(UUID_V7);
    expect(body.mutationId).not.toBe(took[0]);
  });

  test('F4 409 already_taken: «Già preso da Marco», the card says Marco, no «Annulla»', async ({
    page,
    context,
  }) => {
    await open(page, context);
    api.change(GATTO_ID, { assigneePersonId: MARCO.personId }); // Marco was quicker
    await press(button(card(region(page), GATTO), IT.take));
    await expect(notice(page, IT.taken('Marco'))).toBeVisible();
    await expect(button(notice(page, IT.taken('Marco')), IT.undo)).toHaveCount(0);
    const gatto = card(region(page), GATTO);
    await expect(gatto.getByText(IT.assigned('Marco'), { exact: true })).toBeVisible();
    await expect(button(gatto, IT.take)).toHaveCount(0);
  });

  test('F5 done on the weekly task: the 10/11 occurrence appears without reloading the page; «Annulla» reopens the 03/11 one only', async ({
    page,
    context,
  }) => {
    await open(page, context);
    await page.evaluate(() => ((window as unknown as { marker047: number }).marker047 = 47));
    await press(checkbox(section(page, 'Oggi'), CARTA));
    await expect(undoIn(page, IT.doneNotice(CARTA))).toBeVisible();
    await expect(checkbox(section(page, 'Chiusi'), CARTA)).toHaveAttribute('aria-checked', 'true');
    const next = card(section(page, 'Prossimi'), CARTA);
    await expect(next).toHaveCount(1);
    await expect(next.getByText('Scadenza: 10/11/2026', { exact: true })).toBeVisible();
    await expect(checkbox(next, CARTA)).toHaveAttribute('aria-checked', 'false');
    expect(api.find(CARTA_NEXT_ID)).toBeTruthy();
    expect(await page.evaluate(() => (window as unknown as { marker047?: number }).marker047)).toBe(
      47,
    );

    await press(undoIn(page, IT.doneNotice(CARTA)));
    const today = card(section(page, 'Oggi'), CARTA);
    await expect(today).toHaveCount(1);
    await expect(today.getByText('Scadenza: 03/11/2026', { exact: true })).toBeVisible();
    await expect(checkbox(today, CARTA)).toHaveAttribute('aria-checked', 'false');
    await expect(card(section(page, 'Prossimi'), CARTA)).toHaveCount(1);
    await expect(card(region(page), CARTA)).toHaveCount(2);
    expect(api.calls('POST', taskPath(PRINCIPALE, CARTA_ID, 'reopen'))).toHaveLength(1);
    expect(api.calls('POST', taskPath(PRINCIPALE, CARTA_NEXT_ID, 'reopen'))).toHaveLength(0);
  });

  test('F6 404 on a write: the screen reloads tasks and people (onStale), the task is gone', async ({
    page,
    context,
  }) => {
    await open(page, context);
    api.writeScript.push({
      status: 404,
      json: { error: 'not_found' },
      effect: () => api.remove(ZAINO_ID),
    });
    await press(checkbox(region(page), ZAINO));
    await expect(card(region(page), ZAINO)).toHaveCount(0);
    await expect.poll(() => api.calls('GET', `/api/families/${PRINCIPALE}/members`).length).toBe(2);
    await expect(region(page).getByRole('listitem')).toHaveCount(5);
  });

  test('F6 409 changed: «Il task è cambiato», reload through onStale, the server state wins', async ({
    page,
    context,
  }) => {
    await open(page, context);
    api.writeScript.push({
      status: 409,
      json: { error: 'not_open' },
      effect: () => api.change(MENSA_ID, { status: 'DONE', completedBy: MARCO.personId }),
    });
    await press(checkbox(region(page), MENSA));
    await expect(notice(page, IT.changed)).toBeVisible();
    await expect(button(notice(page, IT.changed), IT.undo)).toHaveCount(0);
    await expect.poll(() => api.calls('GET', `/api/families/${PRINCIPALE}/members`).length).toBe(2);
    await expect(checkbox(section(page, 'Chiusi'), MENSA)).toHaveAttribute('aria-checked', 'true');
    await expect(card(section(page, 'Oggi'), MENSA)).toHaveCount(0);
  });

  test('F7 one notice for the section: another write drops the «Annulla» of the previous one', async ({
    page,
    context,
  }) => {
    await open(page, context);
    await press(checkbox(region(page), MENSA));
    await expect(undoIn(page, IT.doneNotice(MENSA))).toBeVisible();
    await press(button(card(region(page), GATTO), IT.take));
    await expect(undoIn(page, IT.takenNotice(GATTO))).toBeVisible();
    await expect(notice(page, IT.doneNotice(MENSA))).toHaveCount(0);
    await expect(button(page.getByRole('alert'), IT.undo)).toHaveCount(1);
    expect(api.calls('POST', taskPath(PRINCIPALE, MENSA_ID, 'reopen'))).toHaveLength(0);
  });

  test('F8 answer held: double tap sends one request, every write of the section waits', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const release = api.hold();
    const box = checkbox(region(page), MENSA);
    await expect(box).toBeVisible();
    await box.dblclick();
    await expect.poll(() => api.writes().length).toBe(1);

    // One lock for the whole section, also across different tasks.
    const take = button(card(region(page), GATTO), IT.take);
    const zaino = checkbox(region(page), ZAINO);
    const nudge = button(card(region(page), ZAINO), IT.nudge(ZAINO));
    await expect(take).toBeDisabled();
    await expect(zaino).toBeDisabled();
    await expect(nudge).toBeDisabled();
    for (const target of [take, zaino, nudge]) {
      await target.click({ force: true, timeout: 2000 }).catch(() => undefined);
    }
    await page.waitForTimeout(300);
    expect(api.writes()).toHaveLength(1);

    release();
    await expect(undoIn(page, IT.doneNotice(MENSA))).toBeVisible();
    await page.waitForTimeout(300);
    expect(api.writes()).toHaveLength(1);
    expect(api.calls('POST', taskPath(PRINCIPALE, MENSA_ID, 'done'))).toHaveLength(1);
    await expect(take).toBeEnabled();
  });

  test('F8 retry: same mutationId only after a network error, a new one after a 403', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const donePath = taskPath(PRINCIPALE, MENSA_ID, 'done');
    api.writeScript.push('abort');
    await press(checkbox(region(page), MENSA));
    await expect(notice(page, IT.failed)).toBeVisible();
    await expect(checkbox(region(page), MENSA)).toHaveAttribute('aria-checked', 'false');
    api.writeScript.push({ status: 403, json: { error: 'forbidden' } });
    await press(checkbox(region(page), MENSA));
    await expect(notice(page, IT.forbidden)).toBeVisible();
    await expect(checkbox(section(page, 'Oggi'), MENSA)).toHaveAttribute('aria-checked', 'false');
    await press(checkbox(region(page), MENSA));
    await expect(undoIn(page, IT.doneNotice(MENSA))).toBeVisible();
    const ids = mutationIds('POST', donePath);
    expect(ids).toHaveLength(3);
    expect(ids[1], 'retry after a network error').toBe(ids[0]);
    expect(ids[2], 'retry after a 403').not.toBe(ids[1]);
  });

  test('F9 secondary actions by name: assign, cancel with confirmation, reopen, nudge, forward, series', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const all = region(page);

    // Assign «Pagare la mensa» to Leo.
    await press(button(card(all, MENSA), IT.assign));
    await press(button(card(all, MENSA), IT.assignTo('Leo')));
    await expect(card(all, MENSA).getByText(IT.assigned('Leo'), { exact: true })).toBeVisible();
    const assigned = api.calls('PUT', taskPath(PRINCIPALE, MENSA_ID, 'assignee'));
    expect(assigned).toHaveLength(1);
    expect((assigned[0].postDataJSON() as { assigneePersonId: string }).assigneePersonId).toBe(
      LEO.personId,
    );

    // The shopping list keeps its link; «Annulla task» asks first.
    await expect(card(all, SPESA).getByRole('link', { name: IT.openList(SPESA) })).toBeVisible();
    await press(button(card(all, SPESA), IT.cancel));
    await expect(button(card(all, SPESA), IT.keep)).toBeVisible();
    expect(api.calls('POST', taskPath(PRINCIPALE, SPESA_ID, 'cancel'))).toHaveLength(0);
    await press(button(card(all, SPESA), IT.confirmCancel));
    const spesa = card(section(page, 'Chiusi'), SPESA);
    await expect(spesa.getByText(IT.cancelled, { exact: true })).toBeVisible();
    await expect(spesa.getByRole('checkbox')).toHaveCount(0);
    expect(api.calls('POST', taskPath(PRINCIPALE, SPESA_ID, 'cancel'))).toHaveLength(1);

    // «Riapri» on the done bike: back open, overdue since 01/11.
    await press(button(card(all, BICI), IT.reopen));
    await expect(checkbox(section(page, 'In ritardo'), BICI)).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(api.calls('POST', taskPath(PRINCIPALE, BICI_ID, 'reopen'))).toHaveLength(1);

    // Nudge: Giulia manages the family; never on the tasks in the queue.
    await press(button(card(all, ZAINO), IT.nudge(ZAINO)));
    await expect
      .poll(() => mutationIds('POST', taskPath(PRINCIPALE, ZAINO_ID, 'nudge')))
      .toEqual([expect.stringMatching(UUID_V7)]);
    await expect(button(card(all, GATTO), IT.nudge(GATTO))).toHaveCount(0);

    // Forward (two families), cancel once and end of the series on the weekly task.
    await expect(button(card(all, GATTO), IT.forward(GATTO))).toBeVisible();
    await expect(button(card(all, CARTA), IT.cancelOnce)).toBeVisible();
    await expect(button(card(all, CARTA), IT.endSeries)).toBeVisible();
  });

  // Round 049: «Aggiungi» opens the dialog «Nuovo task» with the focus on its title.
  test('F10 Famiglia Mamma has no task: empty state, «Aggiungi» moves the focus to the title', async ({
    page,
    context,
  }) => {
    api = new FakeApi(page, context);
    await api.install();
    await api.openSession(GIULIA);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto(`/family?id=${MAMMA}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Mamma');

    await expect(page.getByText(IT.empty, { exact: true })).toBeVisible();
    await expect(page.getByText(IT.emptyHint, { exact: true })).toBeVisible();
    const dialog = page.getByRole('dialog', { name: IT.newTask, exact: true });
    const title = dialog.getByRole('textbox', { name: IT.newTitle, exact: true });
    await expect(dialog).toHaveCount(0);
    const add = page.getByRole('button', { name: IT.add, exact: true });
    await press(add);
    await expect(dialog).toBeVisible();
    await expect(title).toBeFocused();
    expect(api.writes()).toHaveLength(0);
  });

  for (const width of [390, 1280]) {
    for (const fs of [1, 2]) {
      test(`F11 targets and no cut text at ${width}px, font scale ${fs}`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
        await open(page, context, `&fs=${fs}`);
        const all = region(page);
        const title = all.getByText(MENSA, { exact: true });
        await expect(title).toBeVisible();
        // The prerendered page has fs=1; after hydration the query applies.
        await expect.poll(() => fontSize(title)).toBe(18 * fs);

        await expect(all.getByRole('checkbox')).toHaveCount(6);
        for (const box of await all.getByRole('checkbox').all()) {
          const r = (await box.boundingBox())!;
          expect(r.width).toBeGreaterThanOrEqual(48);
          expect(r.height).toBeGreaterThanOrEqual(48);
        }
        await expect(button(all, IT.take)).toHaveCount(2);
        const buttons = await all.getByRole('button').all();
        expect(buttons.length).toBeGreaterThan(2);
        for (const b of buttons) {
          const r = (await b.boundingBox())!;
          const name = (await b.getAttribute('aria-label')) ?? (await b.innerText());
          expect(r.height, name).toBeGreaterThanOrEqual(48);
        }

        expect(await cutTexts(page)).toEqual([]);
        expect(await overflowingInCards(page)).toEqual([]);

        const path = `${SCREENSHOTS}/family-${width}-fs${fs}.png`;
        await page.screenshot({ path, fullPage: true });
        expect(statSync(join(APP, path)).size).toBeGreaterThan(0);
      });
    }
  }

  test('F12 TasksSection is made of the kit: no Pressable, Text or StyleSheet, no static tokens', () => {
    const source = readFileSync(join(APP, 'src', 'task', 'TasksSection.tsx'), 'utf8');
    expect(source).not.toMatch(/StyleSheet/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/from\s+['"]@\/ui\/tokens['"]/);
    const native = /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/.exec(source);
    const names = native ? native[1].split(',').map((n) => n.trim()) : [];
    expect(names).not.toContain('Pressable');
    expect(names).not.toContain('Text');
  });
});

test.describe('giro 047 — family view on the list kit (en)', () => {
  test.use({ locale: 'en-US', timezoneId: 'Asia/Tokyo' });

  test('F1 the sections and the controls in English', async ({ page, context }) => {
    api = new FakeApi(page, context);
    await api.install();
    await api.openSession(GIULIA);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto(`/family?id=${PRINCIPALE}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
    const all = page.getByRole('region', { name: 'Family tasks', exact: true });
    await expect(all.getByRole('heading', { level: 2 })).toHaveText(SECTIONS_EN);
    await expect(all.getByRole('listitem')).toHaveCount(6);
    await expect(all.getByRole('checkbox', { name: `Done: ${MENSA}`, exact: true })).toBeVisible();
    await expect(card(all, GATTO).getByRole('button', { name: 'Take', exact: true })).toBeVisible();
  });
});
