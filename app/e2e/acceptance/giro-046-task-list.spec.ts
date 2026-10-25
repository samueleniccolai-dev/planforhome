/// <reference types="node" />
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  BABBO,
  BICI,
  CARTA,
  CARTA_ID,
  CARTA_NEXT_ID,
  CSRF,
  DIVANO,
  DOCUMENTO,
  EXPECTED,
  FakeApi,
  FOTO,
  GIULIA,
  LIBRI,
  LIBRI_ID,
  LUCA,
  MAMMA,
  MENSA,
  MENSA_ID,
  NOW,
  PAOLO,
  PRANZO,
  PRANZO_ID,
  PRINCIPALE,
  REGALO,
  REGALO_ID,
  SECTIONS_EN,
  SECTIONS_IT,
  SPESA,
  taskPath,
  UUID_V7,
  ZAINO,
  type Person,
} from './giro-046-fake-api';

// Round 046, T13 part 1 (docs/lab/giri/046-piano.md, B1–B9 and the source check): «All my
// families» made of the list kit. A region labelled «Task di tutte le mie famiglie» holds, per
// non-empty section, a heading 2 and a list labelled with the same name; each task is one
// listitem with its TaskCard. The browser clock is fixed at 2026-11-03T03:00Z and the device runs
// in Asia/Tokyo: sections are computed in the zone of the family of each task. Elements are found
// by role and accessible name; the texts are the ones decided in the plan.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';
const DANGER = 'rgb(153, 27, 27)';

const IT = {
  allFamilies: 'Tutte le mie famiglie',
  region: 'Task di tutte le mie famiglie',
  filter: 'Filtro',
  tabs: ['Tutti', 'Assegnati a me', 'In coda', 'In scadenza'],
  done: (title: string) => `Fatto: ${title}`,
  doneNotice: (title: string) => `Fatto: ${title}.`,
  takenNotice: (title: string) => `Preso: ${title}.`,
  undo: 'Annulla',
  take: 'Prendi',
  forbidden: 'Non hai il permesso di farlo.',
  changed: 'Il task è cambiato. Ricarico.',
  notAvailable: 'Questo task non è più disponibile',
  failed: 'Qualcosa non ha funzionato. Riprova.',
  taken: (name: string) => `Già preso da ${name}.`,
  assigned: (name: string) => `Assegnato a ${name}`,
  queue: 'In coda',
  fromNotification: 'Aperto dalla notifica',
  empty: 'Nessun task.',
  emptyHint: 'Aggiungi il primo task nella tua famiglia.',
  add: 'Aggiungi',
};

type Rect = { x: number; y: number; width: number; height: number };

/** The gap between two boxes: 0 or less if they overlap. */
function gap(a: Rect, b: Rect): number {
  const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
  const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
  return Math.max(dx, dy);
}

function region(page: Page, name = IT.region): Locator {
  return page.getByRole('region', { name, exact: true });
}

function section(page: Page, name: string): Locator {
  return region(page).getByRole('list', { name, exact: true });
}

/** The listitems of the region holding the exact title. */
function card(scope: Locator, title: string): Locator {
  return scope
    .getByRole('listitem')
    .filter({ has: scope.page().getByText(title, { exact: true }) });
}

function checkbox(scope: Locator, title: string): Locator {
  return scope.getByRole('checkbox', { name: IT.done(title), exact: true });
}

function notice(page: Page, text: string): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

function undoIn(page: Page, text: string): Locator {
  return notice(page, text).getByRole('button', { name: IT.undo, exact: true });
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

/** The computed background of the element, or of the nearest ancestor that paints one. */
async function background(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    for (let a: Element | null = el; a; a = a.parentElement) {
      const bg = getComputedStyle(a).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return '';
  });
}

let api: FakeApi;

async function open(page: Page, context: BrowserContext, who: Person, query = ''): Promise<void> {
  api = new FakeApi(page, context);
  await api.install();
  await api.openSession(who);
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto(`/tasks${query}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(IT.allFamilies);
}

function mutationIds(method: string, path: string): string[] {
  return api
    .calls(method, path)
    .map((r) => (r.postDataJSON() as { mutationId: string }).mutationId);
}

test.describe('giro 046 — all my families (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Asia/Tokyo' });

  test('B1 five sections in order, the tasks under their section in the order of the plan', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    await expect(region(page).getByRole('heading', { level: 2 })).toHaveText(SECTIONS_IT);
    await expect(region(page).getByRole('listitem')).toHaveCount(10);
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
    // Document order: each heading, then exactly the tasks of its section.
    const order = await domOrder(page);
    const expected = SECTIONS_IT.flatMap((name, i) => [`# ${name}`, ...EXPECTED[i]]);
    expect(order).toHaveLength(expected.length);
    order.forEach((entry, k) => {
      if (expected[k].startsWith('# ')) expect(entry).toBe(expected[k]);
      else expect(entry, `position ${k}`).toContain(expected[k]);
    });

    await expect(page.getByText(DOCUMENTO)).toHaveCount(0);
    await expect(page.getByText('Famiglia Babbo')).toHaveCount(0);
    expect(api.requests.filter((r) => r.url().includes(BABBO))).toHaveLength(0);
    expect(api.calls('GET', '/api/tasks')).toHaveLength(1);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({ path: `${SCREENSHOTS}/tasks-${width}.png`, fullPage: true });
    }
  });

  test('B2 family tag on every card, badges, assignee, recurrence, overdue colour', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    const all = region(page);
    for (const [title, family] of [
      [ZAINO, 'Famiglia Principale'],
      [FOTO, 'Famiglia Mamma'],
      [LIBRI, 'Famiglia Mamma'],
      [MENSA, 'Famiglia Principale'],
      [CARTA, 'Famiglia Principale'],
      [REGALO, 'Famiglia Mamma'],
      [PRANZO, 'Famiglia Mamma'],
      [SPESA, 'Famiglia Principale'],
      [BICI, 'Famiglia Principale'],
      [DIVANO, 'Famiglia Mamma'],
    ]) {
      await expect(card(all, title).getByText(family, { exact: true }), title).toBeVisible();
    }

    const high = card(all, PRANZO).getByText('Alta', { exact: true });
    await expect(high).toBeVisible();
    expect(await background(high)).toBe(DANGER);
    await expect(all.getByText('Criticità: normale')).toHaveCount(0);
    await expect(card(all, LIBRI).getByText('Criticità: bassa', { exact: true })).toBeVisible();

    const carta = card(all, CARTA);
    await expect(carta.getByText(IT.assigned('Marco'), { exact: true })).toBeVisible();
    await expect(carta.getByText('M', { exact: true })).toBeVisible();
    await expect(carta.getByText('Si ripete: ogni martedì', { exact: true })).toBeVisible();

    const late = card(all, ZAINO).getByText('Scadenza: 02/11/2026 18:30', { exact: true });
    await expect(late).toBeVisible();
    expect(await late.evaluate((el) => getComputedStyle(el).color)).toBe(DANGER);
    const mensa = card(all, MENSA).getByText('Scadenza: 03/11/2026 17:00', { exact: true });
    await expect(mensa).toBeVisible();
    expect(await mensa.evaluate((el) => getComputedStyle(el).color)).not.toBe(DANGER);
  });

  test('B3 touch targets, «Prendi» only on open queued tasks, closed cards', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    const all = region(page);
    await expect(all.getByRole('checkbox')).toHaveCount(9);
    for (const box of await all.getByRole('checkbox').all()) {
      const r = (await box.boundingBox())!;
      expect(r.width).toBeGreaterThanOrEqual(48);
      expect(r.height).toBeGreaterThanOrEqual(48);
    }
    await expect(all.getByRole('button', { name: IT.take, exact: true })).toHaveCount(2);
    for (const title of [PRANZO, SPESA]) {
      const take = card(all, title).getByRole('button', { name: IT.take, exact: true });
      await expect(take).toBeVisible();
      const t = (await take.boundingBox())!;
      expect(t.height, title).toBeGreaterThanOrEqual(56);
      const size = await take.evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const n = walker.currentNode;
          if (n.textContent?.trim() && n.parentElement)
            return parseFloat(getComputedStyle(n.parentElement).fontSize);
        }
        return 0;
      });
      expect(size).toBeGreaterThanOrEqual(18);
      const c = (await checkbox(card(all, title), title).boundingBox())!;
      expect(gap(c, t), `${title}: checkbox and «Prendi»`).toBeGreaterThanOrEqual(8);
    }
    const divano = card(all, DIVANO);
    await expect(divano).toHaveCount(1);
    await expect(divano.getByRole('checkbox')).toHaveCount(0);
    await expect(divano.getByRole('button')).toHaveCount(0);
    await expect(divano.getByText('Annullato', { exact: true })).toBeVisible();
    await expect(checkbox(all, BICI)).toHaveAttribute('aria-checked', 'true');
    await expect(checkbox(all, MENSA)).toHaveAttribute('aria-checked', 'false');
  });

  test('B4 done, undo, done again: three writes, three different mutationIds', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    const donePath = taskPath(PRINCIPALE, MENSA_ID, 'done');
    const reopenPath = taskPath(PRINCIPALE, MENSA_ID, 'reopen');

    await press(checkbox(region(page), MENSA));
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
    expect(api.calls('POST', reopenPath)).toHaveLength(1);

    await press(checkbox(section(page, 'Oggi'), MENSA));
    await expect(undoIn(page, IT.doneNotice(MENSA))).toBeVisible();
    const ids = [...mutationIds('POST', donePath), ...mutationIds('POST', reopenPath)];
    expect(ids).toHaveLength(3);
    for (const id of ids) expect(id).toMatch(UUID_V7);
    expect(new Set(ids).size).toBe(3);
  });

  test('B5 slow done: disabled controls, one request; lost answer: the retry keeps the mutationId', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    const donePath = taskPath(PRINCIPALE, MENSA_ID, 'done');
    api.writeDelayMs = 1500;
    const box = checkbox(region(page), MENSA);
    await expect(box).toBeVisible();
    await box.dblclick();
    await expect(box).toBeDisabled();
    await expect(
      card(region(page), PRANZO).getByRole('button', { name: IT.take, exact: true }),
    ).toBeDisabled();
    await expect(undoIn(page, IT.doneNotice(MENSA))).toBeVisible();
    expect(api.calls('POST', donePath)).toHaveLength(1);
    expect(api.calls('POST', taskPath(PRINCIPALE, MENSA_ID, 'reopen'))).toHaveLength(0);

    // A lost answer on «Pagare la mensa»'s neighbour: same mutationId on the retry.
    api.writeDelayMs = 0;
    const libriPath = taskPath(MAMMA, LIBRI_ID, 'done');
    api.writeScript.push('abort');
    await press(checkbox(region(page), LIBRI));
    await expect(notice(page, IT.failed)).toBeVisible();
    await expect(checkbox(region(page), LIBRI)).toHaveAttribute('aria-checked', 'false');
    await press(checkbox(region(page), LIBRI));
    await expect(undoIn(page, IT.doneNotice(LIBRI))).toBeVisible();
    const ids = mutationIds('POST', libriPath);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });

  test('B5 two fast clicks on «Annulla» send one reopen', async ({ page, context }) => {
    await open(page, context, GIULIA);
    await press(checkbox(region(page), MENSA));
    const undo = undoIn(page, IT.doneNotice(MENSA));
    await expect(undo).toBeVisible();
    api.writeDelayMs = 1500;
    await undo.dblclick();
    await expect(checkbox(section(page, 'Oggi'), MENSA)).toHaveAttribute('aria-checked', 'false', {
      timeout: 10_000,
    });
    await page.waitForTimeout(500);
    expect(api.calls('POST', taskPath(PRINCIPALE, MENSA_ID, 'reopen'))).toHaveLength(1);
  });

  test('B6 403: the alert, the card stays as it was, nothing reloaded', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    // Giulia is a MEMBER of Famiglia Mamma and the lunch is in the queue: P7 says no.
    await press(checkbox(region(page), PRANZO));
    await expect(notice(page, IT.forbidden)).toBeVisible();
    await expect(checkbox(section(page, 'Prossimi'), PRANZO)).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(card(section(page, 'Chiusi'), PRANZO)).toHaveCount(0);
    expect(api.calls('POST', taskPath(MAMMA, PRANZO_ID, 'done'))).toHaveLength(1);
    expect(api.calls('GET', '/api/tasks')).toHaveLength(1);
  });

  test('B6 409 not_open: «Il task è cambiato», the list is replaced by a new GET /api/tasks', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    api.writeScript.push({
      status: 409,
      json: { error: 'not_open' },
      effect: () =>
        api.change(LIBRI_ID, {
          status: 'DONE',
          completedBy: '0192a3b4-0000-7000-8000-0000000000a4',
        }),
    });
    await press(checkbox(region(page), LIBRI));
    await expect(notice(page, IT.changed)).toBeVisible();
    await expect.poll(() => api.calls('GET', '/api/tasks').length).toBe(2);
    await expect(checkbox(section(page, 'Chiusi'), LIBRI)).toHaveAttribute('aria-checked', 'true');
    await expect(card(section(page, 'Oggi'), LIBRI)).toHaveCount(0);
  });

  test('B6 404: «non è più disponibile», the reload drops the task', async ({ page, context }) => {
    await open(page, context, GIULIA);
    api.writeScript.push({
      status: 404,
      json: { error: 'not_found' },
      effect: () => api.remove(REGALO_ID),
    });
    await press(checkbox(region(page), REGALO));
    await expect(notice(page, IT.notAvailable)).toBeVisible();
    await expect.poll(() => api.calls('GET', '/api/tasks').length).toBe(2);
    await expect(card(region(page), REGALO)).toHaveCount(0);
    await expect(region(page).getByRole('listitem')).toHaveCount(9);
  });

  test('B6 done on a recurring task: the reload brings the next occurrence', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    await press(checkbox(region(page), CARTA));
    await expect(undoIn(page, IT.doneNotice(CARTA))).toBeVisible();
    await expect.poll(() => api.calls('GET', '/api/tasks').length).toBe(2);
    expect(api.find(CARTA_NEXT_ID)).toBeTruthy();
    await expect(checkbox(section(page, 'Chiusi'), CARTA)).toHaveAttribute('aria-checked', 'true');
    const next = card(section(page, 'Prossimi'), CARTA);
    await expect(next).toHaveCount(1);
    await expect(next.getByText('Scadenza: 10/11/2026', { exact: true })).toBeVisible();
    await expect(checkbox(next, CARTA)).toHaveAttribute('aria-checked', 'false');
    expect(api.calls('POST', taskPath(PRINCIPALE, CARTA_ID, 'done'))).toHaveLength(1);
  });

  test('B7 «Prendi», then «Annulla» puts the task back in the queue', async ({ page, context }) => {
    await open(page, context, GIULIA);
    const lunch = () => card(region(page), PRANZO);
    await press(lunch().getByRole('button', { name: IT.take, exact: true }));
    await expect(lunch().getByText(IT.assigned('Giulia'), { exact: true })).toBeVisible();
    await expect(lunch().getByRole('button', { name: IT.take, exact: true })).toHaveCount(0);
    const took = api.calls('POST', taskPath(MAMMA, PRANZO_ID, 'take'));
    expect(took).toHaveLength(1);
    const takeId = (took[0].postDataJSON() as { mutationId: string }).mutationId;
    expect(takeId).toMatch(UUID_V7);

    await press(undoIn(page, IT.takenNotice(PRANZO)));
    await expect(lunch().getByText(IT.queue, { exact: true })).toBeVisible();
    await expect(lunch().getByRole('button', { name: IT.take, exact: true })).toBeVisible();
    await expect(notice(page, IT.takenNotice(PRANZO))).toHaveCount(0);
    const back = api.calls('PUT', taskPath(MAMMA, PRANZO_ID, 'assignee'));
    expect(back).toHaveLength(1);
    const body = back[0].postDataJSON() as { mutationId: string; assigneePersonId: string | null };
    expect(body.assigneePersonId).toBeNull();
    expect(body.mutationId).toMatch(UUID_V7);
    expect(body.mutationId).not.toBe(takeId);
  });

  test('B7 409 already_taken by Paolo: the notice and the reloaded list say Paolo', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    api.change(PRANZO_ID, { assigneePersonId: PAOLO.personId }); // Paolo was quicker
    await press(card(region(page), PRANZO).getByRole('button', { name: IT.take, exact: true }));
    await expect(notice(page, IT.taken('Paolo'))).toBeVisible();
    await expect.poll(() => api.calls('GET', '/api/tasks').length).toBe(2);
    const lunch = card(region(page), PRANZO);
    await expect(lunch.getByText(IT.assigned('Paolo'), { exact: true })).toBeVisible();
    await expect(lunch.getByRole('button', { name: IT.take, exact: true })).toHaveCount(0);
  });

  test('B8 the filters are tabs; «In coda» keeps the sections and asks nothing new', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA);
    const tabs = page.getByRole('tablist', { name: IT.filter, exact: true });
    await expect(tabs.getByRole('tab')).toHaveText(IT.tabs);
    await expect(tabs.getByRole('tab', { name: 'Tutti', exact: true, selected: true })).toHaveCount(
      1,
    );
    await expect(tabs.getByRole('tab', { selected: true })).toHaveCount(1);

    await press(tabs.getByRole('tab', { name: 'In coda', exact: true }));
    await expect(
      tabs.getByRole('tab', { name: 'In coda', exact: true, selected: true }),
    ).toHaveCount(1);
    await expect(tabs.getByRole('tab', { selected: true })).toHaveCount(1);
    await expect(region(page).getByRole('heading', { level: 2 })).toHaveText([
      'Prossimi',
      'Senza scadenza',
    ]);
    await expect(region(page).getByRole('listitem')).toHaveCount(2);
    await expect(card(section(page, 'Prossimi'), PRANZO)).toHaveCount(1);
    await expect(card(section(page, 'Senza scadenza'), SPESA)).toHaveCount(1);
    expect(api.calls('GET', '/api/tasks')).toHaveLength(1);
  });

  test('B9 nothing to do: the empty state with «Aggiungi» towards the only family', async ({
    page,
    context,
  }) => {
    api = new FakeApi(page, context);
    await api.install();
    api.tasks = api.tasks.filter((t) => t.familyId !== MAMMA); // Luca is only in Famiglia Mamma
    await api.openSession(LUCA);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(IT.allFamilies);

    await expect(page.getByText(IT.empty, { exact: true })).toBeVisible();
    await expect(page.getByText(IT.emptyHint, { exact: true })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
    const add = page.getByRole('button', { name: IT.add, exact: true });
    await expect(add).toBeVisible();
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    await add.click();
    await expect(page).toHaveURL(new RegExp(`/family\\?id=${MAMMA}$`));
  });

  test('B4 the card opened from a notification shares its state with the list', async ({
    page,
    context,
  }) => {
    await open(page, context, GIULIA, `?task=${MENSA_ID}`);
    const opened = region(page, IT.fromNotification);
    await expect(opened.getByText('Famiglia Principale', { exact: true })).toBeVisible();
    await press(checkbox(opened, MENSA));
    await expect(undoIn(page, IT.doneNotice(MENSA))).toBeVisible();
    await expect(checkbox(opened, MENSA)).toHaveAttribute('aria-checked', 'true');
    await expect(checkbox(section(page, 'Chiusi'), MENSA)).toHaveAttribute('aria-checked', 'true');
    expect(api.calls('POST', taskPath(PRINCIPALE, MENSA_ID, 'done'))).toHaveLength(1);
  });

  test('tasks.tsx is made of the kit: nothing from react-native, no StyleSheet', () => {
    const source = readFileSync(join(APP, 'app', 'tasks.tsx'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]react-native['"]/);
    expect(source).not.toMatch(/StyleSheet/);
  });
});

test.describe('giro 046 — all my families (en)', () => {
  test.use({ locale: 'en-US', timezoneId: 'Asia/Tokyo' });

  test('B1 the sections in English', async ({ page, context }) => {
    api = new FakeApi(page, context);
    await api.install();
    await api.openSession(GIULIA);
    await page.clock.setFixedTime(new Date(NOW));
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All my families');
    const all = page.getByRole('region', { name: 'Tasks of all my families', exact: true });
    await expect(all.getByRole('heading', { level: 2 })).toHaveText(SECTIONS_EN);
    await expect(all.getByRole('listitem')).toHaveCount(10);
    await expect(all.getByRole('checkbox', { name: `Done: ${MENSA}`, exact: true })).toBeVisible();
  });
});
