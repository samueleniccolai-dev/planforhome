import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test';

import {
  FakeApi,
  GIULIA,
  LISTA,
  LISTA_ID,
  LUCA,
  MAMMA,
  MONDAY,
  NONNA,
  NONNA_ID,
  PRINCIPALE,
  UUID,
  type Person,
} from './giro-019-fake-api';

// Round 020, T8 part 3 (app side): «Sposta su/giù» in the screen of a shopping list. Only the items
// of «Da prendere» have the two buttons «Sposta su «<item>»» and «Sposta giù «<item>»»; at the
// ends the button is visible and disabled. A move shows at once and sends
// `PUT …/items/order { mutationId, itemIds }` with all the items of the screen (checked and struck
// too) in the new order. At most one reorder in flight: the taps meanwhile stay local and the most
// recent local order goes out when the answer comes. With no reorder pending, the order of the
// answer wins. The focus stays on the pressed button (or on the other one of the same item, if
// that one is now disabled). Errors: 409 not_open → «La lista è chiusa»; anything else → «Qualcosa
// non ha funzionato. Riprova.» and the order before the move. The fake API of round 019 is reused
// as it is; what a test does to `PUT …/items/order` is a `page.route` of this file, registered after
// the fake API (so it runs first). Elements are found by role and accessible name.

const IT = {
  toGet: 'Da prendere',
  checked: 'Spuntate',
  removed: 'Voci tolte',
  closed: 'La lista è chiusa',
  failed: 'Qualcosa non ha funzionato. Riprova.',
};

const up = (text: string) => `Sposta su «${text}»`;
const down = (text: string) => `Sposta giù «${text}»`;
const orderPath = (familyId: string, taskId: string) =>
  `/api/families/${familyId}/tasks/${taskId}/items/order`;
const ORDER_ROUTE = '**/api/families/*/tasks/*/items/order';

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

function section(page: Page, name: string): Locator {
  return page.getByRole('list', { name, exact: true });
}

function entries(page: Page, name: string): Locator {
  return section(page, name).getByRole('listitem');
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function alert(page: Page, text: string): Locator {
  return page.getByRole('alert').filter({ hasText: text });
}

async function press(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await target.click();
}

let api: FakeApi;

async function start(page: Page, context: BrowserContext, who: Person): Promise<void> {
  api = new FakeApi(page, context);
  await api.install();
  await api.openSession(who);
  await page.clock.setFixedTime(new Date(MONDAY));
}

async function openList(page: Page, familyId: string, taskId: string, title: string) {
  await page.goto(`/list?family=${familyId}&task=${taskId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(section(page, IT.toGet)).toBeVisible();
}

type OrderBody = { mutationId?: unknown; itemIds?: unknown };

/** The bodies of the PUT …/items/order that reached the fake API. */
function orders(familyId: string, taskId: string): OrderBody[] {
  return api.calls('PUT', orderPath(familyId, taskId)).map((r) => r.postDataJSON() as OrderBody);
}

/** The ids of the items of a list, by text, in the given order. */
function ids(taskId: string, texts: string[]): string[] {
  return texts.map((text) => api.itemOf(taskId, text).id);
}

const LISTA_START = [/Latte/, /Pane/, /Mele/, /Biscotti/];

test.describe('device language it-IT', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('R1 — every item to get has «Sposta su/giù»; at the ends they are disabled and do nothing', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    await expect(entries(page, IT.toGet)).toHaveText(LISTA_START);

    for (const text of ['Latte', 'Pane', 'Mele', 'Biscotti']) {
      await expect(button(section(page, IT.toGet), up(text))).toBeVisible();
      await expect(button(section(page, IT.toGet), down(text))).toBeVisible();
    }
    await expect(button(page, up('Latte'))).toBeDisabled();
    await expect(button(page, down('Biscotti'))).toBeDisabled();
    for (const name of [down('Latte'), up('Pane'), down('Pane'), up('Mele'), down('Mele')]) {
      await expect(button(page, name)).toBeEnabled();
    }
    await expect(button(page, up('Biscotti'))).toBeEnabled();

    await button(page, up('Latte')).click({ force: true });
    await button(page, down('Biscotti')).click({ force: true });
    await page.waitForTimeout(300);
    expect(orders(PRINCIPALE, LISTA_ID)).toHaveLength(0);
    await expect(entries(page, IT.toGet)).toHaveText(LISTA_START);
  });

  test('R2 — «Sposta giù «Latte»» moves it, sends the whole order once and keeps the focus', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);

    await press(button(page, down('Latte')));

    await expect(entries(page, IT.toGet)).toHaveText([/Pane/, /Latte/, /Mele/, /Biscotti/]);
    await expect.poll(() => orders(PRINCIPALE, LISTA_ID).length).toBe(1);
    const sent = orders(PRINCIPALE, LISTA_ID)[0];
    expect(sent.mutationId).toMatch(UUID);
    expect(sent.itemIds).toEqual(ids(LISTA_ID, ['Pane', 'Latte', 'Mele', 'Biscotti']));
    await expect(button(page, down('Latte'))).toBeFocused();
  });

  test('R3 — «Sposta su «Mele»» twice: Mele first, its «Sposta su» disabled, focus on «Sposta giù»', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);

    await press(button(page, up('Mele')));
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Pane/, /Biscotti/]);
    await expect(button(page, up('Mele'))).toBeFocused();
    await press(button(page, up('Mele')));

    await expect(entries(page, IT.toGet)).toHaveText([/Mele/, /Latte/, /Pane/, /Biscotti/]);
    await expect(button(page, up('Mele'))).toBeDisabled();
    await expect(button(page, down('Mele'))).toBeFocused();
  });

  test('R4 — two quick moves with the answers swapped: Latte stays third', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    // The first PUT waits until a second PUT has reached the fake API (at most 1.5 s: a client with
    // one reorder in flight sends the second only after the first answer).
    let calls = 0;
    let secondPassed!: () => void;
    const second = new Promise<void>((done) => (secondPassed = done));
    await page.route(ORDER_ROUTE, async (route: Route) => {
      calls += 1;
      if (calls === 1) {
        await Promise.race([second, sleep(1500)]);
        await route.fallback();
      } else {
        await route.fallback();
        await sleep(200);
        secondPassed();
      }
    });
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);

    const latteDown = button(page, down('Latte'));
    await press(latteDown);
    await press(latteDown);

    const third = [/Pane/, /Mele/, /Latte/, /Biscotti/];
    await expect(entries(page, IT.toGet)).toHaveText(third);
    await expect
      .poll(() => orders(PRINCIPALE, LISTA_ID).length, { timeout: 5000 })
      .toBeGreaterThan(0);
    await page.waitForTimeout(2500); // every answer is in
    const sent = orders(PRINCIPALE, LISTA_ID);
    expect(sent[sent.length - 1].itemIds).toEqual(
      ids(LISTA_ID, ['Pane', 'Mele', 'Latte', 'Biscotti']),
    );
    await expect(entries(page, IT.toGet)).toHaveText(third);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(LISTA);
    await expect(entries(page, IT.toGet)).toHaveText(third);
  });

  test('R5 — with checked and struck items: only «Da prendere» moves, the PUT has all the items', async ({
    page,
    context,
  }) => {
    await start(page, context, LUCA);
    await openList(page, MAMMA, NONNA_ID, NONNA);
    await expect(button(page, up('Uova'))).toBeDisabled();
    await expect(button(page, down('Farina'))).toBeDisabled();

    await press(button(page, up('Farina')));

    await expect(entries(page, IT.toGet)).toHaveText([/Farina/, /Uova/]);
    await expect.poll(() => orders(MAMMA, NONNA_ID).length).toBe(1);
    expect(orders(MAMMA, NONNA_ID)[0].itemIds).toEqual(
      ids(NONNA_ID, ['Farina', 'Uova', 'Zucchero', 'Sale']),
    );
    await expect(entries(page, IT.checked)).toHaveText([/Zucchero/]);
    await expect(entries(page, IT.removed)).toHaveText([/Sale/]);
    await expect(section(page, IT.checked).getByRole('button', { name: /^Sposta/ })).toHaveCount(0);
    await expect(section(page, IT.removed).getByRole('button', { name: /^Sposta/ })).toHaveCount(0);
  });

  test('R6 — the server wins: an answer with a later concurrent order is what the screen shows', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    // Somebody else reordered right after Giulia: the answer carries his order.
    await page.route(ORDER_ROUTE, async (route: Route) => {
      ['Biscotti', 'Mele', 'Pane', 'Latte'].forEach((text, position) =>
        api.elsewhere(LISTA_ID, text, { position }),
      );
      const list = api.tasks.find((t) => t.id === LISTA_ID)!;
      await route.fulfill({ status: 200, json: JSON.parse(JSON.stringify(api.visible(list))) });
    });
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);

    await press(button(page, down('Latte')));

    await expect(entries(page, IT.toGet)).toHaveText([/Biscotti/, /Mele/, /Pane/, /Latte/]);
  });

  test('R7 — after a move, a reload keeps the order', async ({ page, context }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);

    await press(button(page, down('Pane')));
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Pane/, /Biscotti/]);
    await expect.poll(() => orders(PRINCIPALE, LISTA_ID).length).toBe(1);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(LISTA);
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Pane/, /Biscotti/]);
  });

  test('R8 — a closed list: 409 not_open shows «La lista è chiusa»', async ({ page, context }) => {
    await start(page, context, GIULIA);
    await page.route(ORDER_ROUTE, (route: Route) =>
      route.fulfill({ status: 409, json: { error: 'not_open' } }),
    );
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);

    await press(button(page, down('Latte')));

    await expect(alert(page, IT.closed)).toBeVisible();
  });

  test('R9 — any other error: the alert and the order before the move', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await page.route(ORDER_ROUTE, (route: Route) =>
      route.fulfill({ status: 500, json: { error: 'internal' } }),
    );
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);

    await press(button(page, down('Latte')));

    await expect(alert(page, IT.failed)).toBeVisible();
    await expect(entries(page, IT.toGet)).toHaveText(LISTA_START);
  });
});

test.describe('device language en-US', () => {
  test.use({ locale: 'en-US', timezoneId: 'Europe/Rome' });

  test('R10 — the buttons in English', async ({ page, context }) => {
    await start(page, context, GIULIA);
    await page.goto(`/list?family=${PRINCIPALE}&task=${LISTA_ID}`);
    await expect(button(page, 'Move up «Pane»')).toBeVisible();
  });
});
