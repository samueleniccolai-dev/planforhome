import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Response,
  type Route,
} from '@playwright/test';

import {
  FakeApi,
  GIULIA,
  LISTA,
  LISTA_ID,
  MONDAY,
  PRINCIPALE,
  type Person,
} from './giro-019-fake-api';

// Round 021, T8 (contestation 020-a): the focus goes on a «Sposta» button only right after the
// tap on it, never later. A tap asks for the focus once; no later render (answer of the server,
// an item above checked, removed or back from «Spuntate», an item that leaves an end) moves it.
// The fake API of round 019 is reused as it is; a test holds an answer with a `page.route` of this
// file, registered after the fake API (so it runs first). Elements are found by role and
// accessible name. The proof that the keys are not stolen uses only `page.keyboard` (a locator
// `fill` or `type` would give the focus back to the field by itself).

const IT = {
  toGet: 'Da prendere',
  checked: 'Spuntate',
  newItem: 'Nuova voce',
};

const up = (text: string) => `Sposta su «${text}»`;
const down = (text: string) => `Sposta giù «${text}»`;
const ORDER_ROUTE = '**/api/families/*/tasks/*/items/order';
const CHECKED_ROUTE = '**/api/families/*/tasks/*/items/*/checked';
const REMOVE_ROUTE = '**/api/families/*/tasks/*/items/*/remove';

function section(page: Page, name: string): Locator {
  return page.getByRole('list', { name, exact: true });
}

function entries(page: Page, name: string): Locator {
  return section(page, name).getByRole('listitem');
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function field(page: Page): Locator {
  return page.getByRole('textbox', { name: IT.newItem, exact: true });
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

async function openList(page: Page) {
  await page.goto(`/list?family=${PRINCIPALE}&task=${LISTA_ID}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(LISTA);
  await expect(section(page, IT.toGet)).toBeVisible();
}

/** The next answer of a request of that method whose path ends with `suffix`. */
function answerOf(page: Page, method: string, suffix: RegExp): Promise<Response> {
  return page.waitForResponse(
    (r) => r.request().method() === method && suffix.test(new URL(r.url()).pathname),
  );
}
const ORDER_PATH = /\/items\/order$/;
const CHECKED_PATH = /\/items\/[^/]+\/checked$/;
const REMOVE_PATH = /\/items\/[^/]+\/remove$/;

type Held = { reached: Promise<void>; release: () => void };

/**
 * Holds the first request matching `pattern` until `release()`; then `answer` (default: the fake
 * API) answers it. The requests after the first pass at once.
 */
async function hold(
  page: Page,
  pattern: string,
  answer: (route: Route) => Promise<void> = (route) => route.fallback(),
): Promise<Held> {
  let release!: () => void;
  const gate = new Promise<void>((done) => (release = done));
  let reachedDone!: () => void;
  const reached = new Promise<void>((done) => (reachedDone = done));
  let first = true;
  await page.route(pattern, async (route: Route) => {
    if (!first) return route.fallback();
    first = false;
    reachedDone();
    await gate;
    await answer(route);
  });
  return { reached, release };
}

/** An answer to the PUT …/items/order carrying an order somebody else saved meanwhile. */
function concurrent(order: string[]) {
  return async (route: Route) => {
    order.forEach((text, position) => api.elsewhere(LISTA_ID, text, { position }));
    const list = api.tasks.find((t) => t.id === LISTA_ID)!;
    await route.fulfill({ status: 200, json: JSON.parse(JSON.stringify(api.visible(list))) });
  };
}

/** Lets React paint and run its passive effects (where a focus would be given back). */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 50))),
      ),
  );
  await page.waitForTimeout(250);
}

/**
 * The keys typed now go to «Nuova voce»: only the keyboard is used, then «Uova» is in «Da
 * prendere», the field is empty and, last, the focus is on it.
 */
async function keysGoToTheField(page: Page): Promise<void> {
  await settle(page);
  await page.keyboard.type('Uova');
  await page.keyboard.press('Enter');
  await expect(entries(page, IT.toGet).filter({ hasText: 'Uova' })).toHaveCount(1);
  await expect(field(page)).toHaveValue('');
  await expect(field(page)).toBeFocused();
}

test.describe('device language it-IT', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('F1 — the answer with a concurrent order does not take the focus back', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    const put = await hold(page, ORDER_ROUTE, concurrent(['Biscotti', 'Mele', 'Pane', 'Latte']));
    await openList(page);

    await press(button(page, down('Latte')));
    await expect(entries(page, IT.toGet)).toHaveText([/Pane/, /Latte/, /Mele/, /Biscotti/]);
    await expect(button(page, down('Latte'))).toBeFocused();
    await put.reached;

    await press(field(page));
    await expect(field(page)).toBeFocused();
    const answered = answerOf(page, 'PUT', ORDER_PATH);
    put.release();
    await answered;
    await expect(entries(page, IT.toGet)).toHaveText([/Biscotti/, /Mele/, /Pane/, /Latte/]);

    await keysGoToTheField(page);
  });

  test('F2 — an item above checked later does not take the focus back', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page);

    const moved = answerOf(page, 'PUT', ORDER_PATH);
    await press(button(page, down('Pane')));
    await moved;
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Pane/, /Biscotti/]);
    await expect(button(page, down('Pane'))).toBeFocused();

    const check = await hold(page, CHECKED_ROUTE);
    await press(section(page, IT.toGet).getByRole('checkbox', { name: 'Latte', exact: true }));
    await check.reached;
    await press(field(page));
    await expect(field(page)).toBeFocused();
    const answered = answerOf(page, 'PUT', CHECKED_PATH);
    check.release();
    await answered;
    await expect(entries(page, IT.toGet)).toHaveText([/Mele/, /Pane/, /Biscotti/]);

    await keysGoToTheField(page);
  });

  test('F3 — an item above removed later does not take the focus back', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page);

    const moved = answerOf(page, 'PUT', ORDER_PATH);
    await press(button(page, down('Pane')));
    await moved;
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Pane/, /Biscotti/]);

    const remove = await hold(page, REMOVE_ROUTE);
    await press(button(section(page, IT.toGet), 'Togli «Latte»'));
    await remove.reached;
    await press(field(page));
    await expect(field(page)).toBeFocused();
    const answered = answerOf(page, 'POST', REMOVE_PATH);
    remove.release();
    await answered;
    await expect(entries(page, IT.toGet)).toHaveText([/Mele/, /Pane/, /Biscotti/]);

    await keysGoToTheField(page);
  });

  test('F4 — an item back from «Spuntate» does not take the focus back', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    api.elsewhere(LISTA_ID, 'Latte', { checked: true });
    await openList(page);
    await expect(entries(page, IT.toGet)).toHaveText([/Pane/, /Mele/, /Biscotti/]);
    await expect(entries(page, IT.checked)).toHaveText([/Latte/]);

    const moved = answerOf(page, 'PUT', ORDER_PATH);
    await press(button(page, down('Pane')));
    await moved;
    await expect(entries(page, IT.toGet)).toHaveText([/Mele/, /Pane/, /Biscotti/]);

    const uncheck = await hold(page, CHECKED_ROUTE);
    await press(section(page, IT.checked).getByRole('checkbox', { name: 'Latte', exact: true }));
    await uncheck.reached;
    await press(field(page));
    await expect(field(page)).toBeFocused();
    const answered = answerOf(page, 'PUT', CHECKED_PATH);
    uncheck.release();
    await answered;
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Pane/, /Biscotti/]);

    await keysGoToTheField(page);
  });

  test('F5 — an item that leaves the bottom does not hand the focus to its other button', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    const put = await hold(page, ORDER_ROUTE, concurrent(['Mele', 'Latte', 'Pane', 'Biscotti']));
    await openList(page);

    await press(button(page, down('Mele')));
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Pane/, /Biscotti/, /Mele/]);
    await expect(button(page, down('Mele'))).toBeDisabled();
    await expect(button(page, up('Mele'))).toBeFocused();
    await put.reached;

    await press(field(page));
    await expect(field(page)).toBeFocused();
    const answered = answerOf(page, 'PUT', ORDER_PATH);
    put.release();
    await answered;
    await expect(entries(page, IT.toGet)).toHaveText([/Mele/, /Latte/, /Pane/, /Biscotti/]);
    await expect(button(page, down('Mele'))).toBeEnabled();

    await keysGoToTheField(page);
  });

  test('F6 — regression: «Sposta su «Mele»» twice, the focus is on «Sposta giù «Mele»»', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page);

    await press(button(page, up('Mele')));
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Pane/, /Biscotti/]);
    await expect(button(page, up('Mele'))).toBeFocused();
    await press(button(page, up('Mele')));

    await expect(entries(page, IT.toGet)).toHaveText([/Mele/, /Latte/, /Pane/, /Biscotti/]);
    await expect(button(page, up('Mele'))).toBeDisabled();
    await expect(button(page, down('Mele'))).toBeFocused();
  });

  test('F7 — two taps with the first answer held: the focus stays on the button of the second', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    const put = await hold(page, ORDER_ROUTE);
    await openList(page);

    await press(button(page, down('Latte')));
    await expect(button(page, down('Latte'))).toBeFocused();
    await put.reached;
    await press(button(page, up('Biscotti')));
    await expect(entries(page, IT.toGet)).toHaveText([/Pane/, /Latte/, /Biscotti/, /Mele/]);
    await expect(button(page, up('Biscotti'))).toBeFocused();

    const first = answerOf(page, 'PUT', ORDER_PATH);
    const second = page.waitForRequest(
      (r) => r.method() === 'PUT' && ORDER_PATH.test(new URL(r.url()).pathname),
    );
    put.release();
    await first;
    await second;
    await settle(page);
    await expect(entries(page, IT.toGet)).toHaveText([/Pane/, /Latte/, /Biscotti/, /Mele/]);
    await expect(button(page, up('Biscotti'))).toBeFocused();
  });

  test('F8 — from the keyboard: Enter on «Sposta giù «Pane»» moves it and keeps the focus', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page);

    await button(page, down('Pane')).focus();
    await page.keyboard.press('Enter');
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Pane/, /Biscotti/]);
    await expect(button(page, down('Pane'))).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Mele/, /Biscotti/, /Pane/]);
    await expect(button(page, up('Pane'))).toBeFocused();
  });
});
