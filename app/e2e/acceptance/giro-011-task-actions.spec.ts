import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  CANTINA,
  CANTINA_ID,
  CSRF,
  DIVANO,
  FakeApi,
  GIULIA,
  MARCO,
  PRINCIPALE,
  UUID_V7,
  ZAINO,
  ZAINO_ID,
} from './giro-011-fake-api';

// Round 011, T5 part 3 (app side): «Mark done», «Reopen» and «Cancel task» inside each task of
// the family screen. The buttons are shown to everybody: the server decides (403, 409). Elements
// are found by role and accessible name; the texts are the ones decided in the plan.

const SCREENSHOTS = 'e2e-screenshots';

type Texts = {
  locale: string;
  lang: string;
  tasks: string;
  familyTasks: string;
  markDone: string;
  reopen: string;
  cancel: string;
  confirmCancel: string;
  keep: string;
  done: string;
  cancelled: string;
  take: string;
  assign: string;
  forbidden: string;
  changed: string;
  failed: string;
};

const cases: Texts[] = [
  {
    locale: 'it-IT',
    lang: 'it',
    tasks: 'Task',
    familyTasks: 'Task della famiglia',
    markDone: 'Segna fatto',
    reopen: 'Riapri',
    cancel: 'Annulla task',
    confirmCancel: 'Conferma annullamento',
    keep: 'Non annullare',
    done: 'Fatto',
    cancelled: 'Annullato',
    take: 'Prendo io',
    assign: 'Assegna',
    forbidden: 'Non hai il permesso di farlo.',
    changed: 'Il task è cambiato. Ricarico.',
    failed: 'Qualcosa non ha funzionato. Riprova.',
  },
  {
    locale: 'en-US',
    lang: 'en',
    tasks: 'Tasks',
    familyTasks: 'Family tasks',
    markDone: 'Mark done',
    reopen: 'Reopen',
    cancel: 'Cancel task',
    confirmCancel: 'Confirm cancellation',
    keep: 'Keep task',
    done: 'Done',
    cancelled: 'Cancelled',
    take: "I'll take it",
    assign: 'Assign',
    forbidden: "You're not allowed to do that.",
    changed: 'The task has changed. Reloading.',
    failed: 'Something went wrong. Try again.',
  },
];

function familyTasks(page: Page, c: Texts): Locator {
  return page.getByRole('list', { name: c.familyTasks, exact: true });
}

/** The list item of one task, found by its exact title. */
function item(list: Locator, title: string): Locator {
  return list.getByRole('listitem').filter({ has: list.page().getByText(title, { exact: true }) });
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

/** Clicks once the control is there: a missing control fails as an assertion, not a timeout. */
async function press(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await target.click();
}

function label(scope: Locator, text: string): Locator {
  return scope.getByText(text, { exact: true });
}

async function openPrincipale(page: Page, c: Texts): Promise<void> {
  await page.goto(`/family?id=${PRINCIPALE}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
  await expect(page.getByRole('heading', { level: 2, name: c.tasks, exact: true })).toBeVisible();
}

const path = (id: string, action: string) => `/api/families/${PRINCIPALE}/tasks/${id}/${action}`;

for (const c of cases) {
  test.describe(`device language ${c.locale}`, () => {
    test.use({ locale: c.locale, timezoneId: 'Asia/Tokyo' });

    let api: FakeApi;
    const start = async (page: Page, context: BrowserContext) => {
      api = new FakeApi(page, context);
      await api.install();
      await api.openSession(GIULIA);
    };

    test('each task shows its status: open, done, cancelled', async ({ page, context }) => {
      await start(page, context);
      await openPrincipale(page, c);
      const list = familyTasks(page, c);

      const zaino = item(list, ZAINO);
      await expect(button(zaino, c.markDone)).toBeVisible();
      await expect(button(zaino, c.cancel)).toBeVisible();
      await expect(button(zaino, c.reopen)).toHaveCount(0);

      const cantina = item(list, CANTINA);
      await expect(label(cantina, c.done)).toBeVisible();
      await expect(button(cantina, c.reopen)).toBeVisible();
      for (const name of [c.markDone, c.cancel, c.take, c.assign]) {
        await expect(button(cantina, name)).toHaveCount(0);
      }

      const divano = item(list, DIVANO); // cancelled, in the queue
      await expect(label(divano, c.cancelled)).toBeVisible();
      await expect(divano.getByRole('button')).toHaveCount(0);
    });

    test('Giulia marks a task done, then reopens it', async ({ page, context }) => {
      await start(page, context);
      await openPrincipale(page, c);
      const zaino = item(familyTasks(page, c), ZAINO);

      await press(button(zaino, c.markDone));
      await expect(label(zaino, c.done)).toBeVisible();
      await expect(button(zaino, c.reopen)).toBeVisible();
      await expect(button(zaino, c.markDone)).toHaveCount(0);
      await expect(button(zaino, c.assign)).toHaveCount(0);

      const done = api.calls('POST', path(ZAINO_ID, 'done'));
      expect(done).toHaveLength(1);
      const body = done[0].postDataJSON() as Record<string, unknown>;
      expect(Object.keys(body)).toEqual(['mutationId']);
      expect(body.mutationId).toMatch(UUID_V7);
      expect(done[0].headers()['x-csrf-token']).toBe(CSRF);
      await page.screenshot({ path: `${SCREENSHOTS}/task-done-${c.lang}.png`, fullPage: true });

      await press(button(zaino, c.reopen));
      await expect(button(zaino, c.markDone)).toBeVisible();
      await expect(label(zaino, c.done)).toHaveCount(0);
      const reopen = api.calls('POST', path(ZAINO_ID, 'reopen'));
      expect(reopen).toHaveLength(1);
      const again = reopen[0].postDataJSON() as Record<string, unknown>;
      expect(Object.keys(again)).toEqual(['mutationId']);
      expect(again.mutationId).toMatch(UUID_V7);
      expect(again.mutationId).not.toBe(body.mutationId);
    });

    test('cancelling asks for confirmation; «keep» sends nothing', async ({ page, context }) => {
      await start(page, context);
      await openPrincipale(page, c);
      const zaino = item(familyTasks(page, c), ZAINO);

      await press(button(zaino, c.cancel));
      await expect(button(zaino, c.confirmCancel)).toBeVisible();
      await expect(button(zaino, c.keep)).toBeVisible();
      expect(api.calls('POST', path(ZAINO_ID, 'cancel'))).toHaveLength(0);

      await press(button(zaino, c.keep));
      await expect(button(zaino, c.confirmCancel)).toHaveCount(0);
      await expect(button(zaino, c.markDone)).toBeVisible();
      await page.waitForTimeout(500);
      expect(api.calls('POST', path(ZAINO_ID, 'cancel'))).toHaveLength(0);

      await press(button(zaino, c.cancel));
      await press(button(zaino, c.confirmCancel));
      await expect(label(zaino, c.cancelled)).toBeVisible();
      await expect(zaino.getByRole('button')).toHaveCount(0);
      const cancel = api.calls('POST', path(ZAINO_ID, 'cancel'));
      expect(cancel).toHaveLength(1);
      expect(Object.keys(cancel[0].postDataJSON() as object)).toEqual(['mutationId']);
    });

    test('the server refuses (403): the message, and the task stays open', async ({
      page,
      context,
    }) => {
      await start(page, context);
      api.writeScript.push({ status: 403, json: { error: 'forbidden' } });
      await openPrincipale(page, c);
      const zaino = item(familyTasks(page, c), ZAINO);

      await press(button(zaino, c.markDone));
      await expect(page.getByRole('alert')).toHaveText(c.forbidden);
      await expect(button(zaino, c.markDone)).toBeVisible();
      await expect(label(zaino, c.done)).toHaveCount(0);
    });

    test('a task someone else changed (409 not_open): the message and a reload', async ({
      page,
      context,
    }) => {
      await start(page, context);
      api.writeScript.push({
        status: 409,
        json: { error: 'not_open' },
        effect: () => api.setStatus(ZAINO_ID, 'DONE', MARCO),
      });
      await openPrincipale(page, c);
      const zaino = item(familyTasks(page, c), ZAINO);
      expect(api.calls('GET', `/api/families/${PRINCIPALE}/tasks`)).toHaveLength(1);

      await press(button(zaino, c.markDone));
      await expect(page.getByRole('alert')).toHaveText(c.changed);
      await expect(label(zaino, c.done)).toBeVisible();
      await expect(button(zaino, c.reopen)).toBeVisible();
      expect(api.calls('GET', `/api/families/${PRINCIPALE}/tasks`)).toHaveLength(2);
    });

    test('a reopen someone else beat (409 not_done): the message and a reload', async ({
      page,
      context,
    }) => {
      await start(page, context);
      api.writeScript.push({
        status: 409,
        json: { error: 'not_done' },
        effect: () => api.setStatus(CANTINA_ID, 'OPEN', null),
      });
      await openPrincipale(page, c);
      const cantina = item(familyTasks(page, c), CANTINA);

      await press(button(cantina, c.reopen));
      await expect(page.getByRole('alert')).toHaveText(c.changed);
      await expect(button(cantina, c.markDone)).toBeVisible();
      await expect(label(cantina, c.done)).toHaveCount(0);
      expect(api.calls('GET', `/api/families/${PRINCIPALE}/tasks`)).toHaveLength(2);
    });

    test('a double click on a slow «mark done» sends one request', async ({ page, context }) => {
      await start(page, context);
      api.writeDelayMs = 500;
      await openPrincipale(page, c);
      const zaino = item(familyTasks(page, c), ZAINO);

      await expect(button(zaino, c.markDone)).toBeVisible();
      await button(zaino, c.markDone).dblclick();
      await expect(label(zaino, c.done)).toBeVisible();
      await page.waitForTimeout(1000);
      expect(api.calls('POST', path(ZAINO_ID, 'done'))).toHaveLength(1);
      expect(api.calls('POST', path(ZAINO_ID, 'reopen'))).toHaveLength(0);
    });

    test('a «mark done» lost on the network is sent again with the same mutationId', async ({
      page,
      context,
    }) => {
      await start(page, context);
      api.writeScript.push('abort');
      await openPrincipale(page, c);
      const zaino = item(familyTasks(page, c), ZAINO);

      await press(button(zaino, c.markDone));
      await expect(page.getByRole('alert')).toHaveText(c.failed);
      await expect(label(zaino, c.done)).toHaveCount(0);

      await press(button(zaino, c.markDone));
      await expect(label(zaino, c.done)).toBeVisible();
      const done = api
        .calls('POST', path(ZAINO_ID, 'done'))
        .map((r) => r.postDataJSON() as Record<string, unknown>);
      expect(done).toHaveLength(2);
      expect(done[1]).toEqual(done[0]);
    });
  });
}
