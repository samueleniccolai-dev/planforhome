import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  ANNA,
  FakeApi,
  FOTO,
  GIULIA,
  LISTA,
  LISTA_ID,
  LUCA,
  MAMMA,
  MARCO,
  MONDAY,
  NONNA,
  NONNA_ID,
  PRINCIPALE,
  SABATO_ID,
  UUID,
  type Person,
} from './giro-019-fake-api';

// Round 019, T8 part 2 (app side): the screen of a shopping list, `/list?family=<f>&task=<t>`.
// Heading = title of the task; three named lists «Da prendere», «Spuntate», «Voci tolte»; every
// alive item has a checkbox (name = text) and «Togli «<item>»»; a struck item shows «tolta da
// <name>» and «Ripristina «<item>»» (and «Togli «<item>»» for the creator and the managers); an item
// added by somebody who is not the creator shows «aggiunta da <name>» («qualcuno» if he is not in
// the family). «Togli le spuntate» is shown to the creator, the managers and the assignee only (the
// server decides). The result of a remove is the one of the server. A write on a screen that is no
// longer up to date (409 item_removed / not_removed, 404) reloads the list and shows an alert.
// The reordering with «Sposta su/giù» is not in this round (round 020). Elements are found by role
// and accessible name.

const IT = {
  familyTasks: 'Task della famiglia',
  newTitle: 'Titolo',
  add: 'Aggiungi task',
  newTask: 'Nuovo task',
  shoppingSwitch: 'Lista della spesa',
  toGet: 'Da prendere',
  checked: 'Spuntate',
  removed: 'Voci tolte',
  newItem: 'Nuova voce',
  clear: 'Togli le spuntate',
  forbidden:
    "Solo chi ha creato la lista, un gestore o l'assegnatario possono togliere le spuntate",
  stale: 'La lista è cambiata nel frattempo ed è stata aggiornata',
  notFound: 'Lista non trovata',
};

const open = (title: string) => `Apri la lista «${title}»`;
const removeLabel = (text: string) => `Togli «${text}»`;
const restoreLabel = (text: string) => `Ripristina «${text}»`;
const itemsPath = (familyId: string, taskId: string) =>
  `/api/families/${familyId}/tasks/${taskId}/items`;

function section(page: Page, name: string): Locator {
  return page.getByRole('list', { name, exact: true });
}

function entries(page: Page, name: string): Locator {
  return section(page, name).getByRole('listitem');
}

/** The row of an item in a section, found by its checkbox or by its text. */
function row(page: Page, name: string, text: string): Locator {
  return entries(page, name).filter({
    has: page
      .getByRole('checkbox', { name: text, exact: true })
      .or(page.getByText(text, { exact: true })),
  });
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function box(scope: Locator | Page, text: string): Locator {
  return scope.getByRole('checkbox', { name: text, exact: true });
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

type Body = Record<string, unknown>;

function bodies(method: string, path: string): Body[] {
  return api.calls(method, path).map((r) => r.postDataJSON() as Body);
}

test.describe('device language it-IT', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('L1 — from the family, «Apri la lista» opens the list with its items and authors', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await page.goto(`/family?id=${PRINCIPALE}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
    await expect(page.getByRole('region', { name: IT.familyTasks, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: open(FOTO), exact: true })).toHaveCount(0);

    await press(page.getByRole('link', { name: open(LISTA), exact: true }));
    await expect(page).toHaveURL(new RegExp(`/list\\?.*task=${LISTA_ID}`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(LISTA);

    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Pane/, /Mele/, /Biscotti/]);
    for (const text of ['Latte', 'Pane', 'Mele', 'Biscotti']) {
      await expect(box(section(page, IT.toGet), text)).not.toBeChecked();
      await expect(button(row(page, IT.toGet, text), removeLabel(text))).toBeVisible();
    }
    await expect(row(page, IT.toGet, 'Biscotti').getByText('aggiunta da Marco')).toBeVisible();
    await expect(row(page, IT.toGet, 'Latte').getByText(/aggiunta da/)).toHaveCount(0);
    await expect(entries(page, IT.checked)).toHaveCount(0);
    await expect(entries(page, IT.removed)).toHaveCount(0);
  });

  test('L2 — quick add: Enter sends one POST, the field is empty and keeps the focus', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    const field = page.getByRole('textbox', { name: IT.newItem, exact: true });

    await field.fill('Uova');
    await field.press('Enter');

    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Pane/, /Mele/, /Biscotti/, /Uova/]);
    const sent = bodies('POST', itemsPath(PRINCIPALE, LISTA_ID));
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toBe('Uova');
    expect(sent[0].mutationId).toMatch(UUID);
    expect(sent[0].id).toMatch(UUID);
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();

    await field.press('Enter');
    await field.fill('   ');
    await field.press('Enter');
    await page.waitForTimeout(300);
    expect(api.calls('POST', itemsPath(PRINCIPALE, LISTA_ID))).toHaveLength(1);
  });

  test('L3 — two Enter in a row while the add is pending send one POST only', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    api.addDelayMs = 800;
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    const field = page.getByRole('textbox', { name: IT.newItem, exact: true });

    await field.fill('Burro');
    await field.press('Enter');
    await field.press('Enter');

    await expect(row(page, IT.toGet, 'Burro')).toHaveCount(1);
    await page.waitForTimeout(1000);
    expect(api.calls('POST', itemsPath(PRINCIPALE, LISTA_ID))).toHaveLength(1);
    await expect(row(page, IT.toGet, 'Burro')).toHaveCount(1);
  });

  test('L4 — a checked item moves to «Spuntate» and back', async ({ page, context }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    const pane = api.itemOf(LISTA_ID, 'Pane');

    await press(box(section(page, IT.toGet), 'Pane'));
    await expect(box(section(page, IT.checked), 'Pane')).toBeChecked();
    await expect(box(section(page, IT.toGet), 'Pane')).toHaveCount(0);
    const checks = bodies('PUT', `${itemsPath(PRINCIPALE, LISTA_ID)}/${pane.id}/checked`);
    expect(checks).toHaveLength(1);
    expect(checks[0].checked).toBe(true);
    expect(checks[0].mutationId).toMatch(UUID);

    await press(box(section(page, IT.checked), 'Pane'));
    await expect(box(section(page, IT.toGet), 'Pane')).not.toBeChecked();
    await expect(entries(page, IT.checked)).toHaveCount(0);
    expect(
      bodies('PUT', `${itemsPath(PRINCIPALE, LISTA_ID)}/${pane.id}/checked`).map((b) => b.checked),
    ).toEqual([true, false]);
  });

  test('L5 — Giulia, the creator, removes the checked items', async ({ page, context }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    await press(box(section(page, IT.toGet), 'Pane'));
    await press(box(section(page, IT.toGet), 'Mele'));
    await expect(entries(page, IT.checked)).toHaveCount(2);

    await press(button(page, IT.clear));

    await expect(entries(page, IT.checked)).toHaveCount(0);
    await expect(entries(page, IT.toGet)).toHaveText([/Latte/, /Biscotti/]);
    expect(api.calls('POST', `${itemsPath(PRINCIPALE, LISTA_ID)}/clear-checked`)).toHaveLength(1);
  });

  test('L6 — Giulia, the creator, removes «Biscotti» and it is gone', async ({ page, context }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    const biscotti = api.itemOf(LISTA_ID, 'Biscotti');

    await press(button(page, removeLabel('Biscotti')));

    await expect(page.getByText('Biscotti', { exact: true })).toHaveCount(0);
    await expect(box(page, 'Biscotti')).toHaveCount(0);
    await expect(entries(page, IT.removed)).toHaveCount(0);
    const sent = bodies('POST', `${itemsPath(PRINCIPALE, LISTA_ID)}/${biscotti.id}/remove`);
    expect(sent).toHaveLength(1);
    expect(sent[0].mutationId).toMatch(UUID);
  });

  test('L7 — the app follows the server: a remove answered as struck goes to «Voci tolte»', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    const biscotti = api.itemOf(LISTA_ID, 'Biscotti');
    api.removeScript.push({
      status: 200,
      json: { ...biscotti, removedBy: GIULIA.personId, deletedAt: null, version: 2 },
    });

    await press(button(page, removeLabel('Biscotti')));

    await expect(row(page, IT.removed, 'Biscotti')).toBeVisible();
    await expect(row(page, IT.removed, 'Biscotti').getByText('tolta da Giulia')).toBeVisible();
    await expect(box(section(page, IT.toGet), 'Biscotti')).toHaveCount(0);
  });

  test('L8 — Luca, a member, strikes «Uova» in the forwarded list and restores it', async ({
    page,
    context,
  }) => {
    await start(page, context, LUCA);
    await openList(page, MAMMA, NONNA_ID, NONNA);
    await expect(button(page, IT.clear)).toHaveCount(0);
    await expect(row(page, IT.toGet, 'Farina').getByText('aggiunta da Luca')).toBeVisible();
    await expect(row(page, IT.checked, 'Zucchero').getByText('aggiunta da qualcuno')).toBeVisible();
    await expect(row(page, IT.toGet, 'Uova').getByText(/aggiunta da/)).toHaveCount(0);
    const sale = row(page, IT.removed, 'Sale');
    await expect(sale.getByText('tolta da Luca')).toBeVisible();
    await expect(button(sale, restoreLabel('Sale'))).toBeVisible();
    await expect(button(sale, removeLabel('Sale'))).toHaveCount(0);

    await press(button(page, removeLabel('Uova')));
    await expect(row(page, IT.removed, 'Uova').getByText('tolta da Luca')).toBeVisible();
    await expect(box(section(page, IT.toGet), 'Uova')).toHaveCount(0);
    await expect(entries(page, IT.toGet)).toHaveText([/Farina/]);

    await press(button(row(page, IT.removed, 'Uova'), restoreLabel('Uova')));
    await expect(box(section(page, IT.toGet), 'Uova')).toBeVisible();
    await expect(row(page, IT.removed, 'Uova')).toHaveCount(0);
    await expect(entries(page, IT.toGet)).toHaveText([/Uova/, /Farina/]);
    expect(
      api.calls('POST', `${itemsPath(MAMMA, NONNA_ID)}/${api.itemOf(NONNA_ID, 'Uova').id}/restore`),
    ).toHaveLength(1);
  });

  test('L9 — Giulia, a member of Mamma but not the creator, strikes «Farina»', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page, MAMMA, NONNA_ID, NONNA);
    await expect(button(page, IT.clear)).toHaveCount(0);

    await press(button(page, removeLabel('Farina')));

    await expect(row(page, IT.removed, 'Farina').getByText('tolta da Giulia')).toBeVisible();
    await expect(entries(page, IT.removed)).toHaveCount(2);
  });

  test('L10 — Anna, a manager, clears the checked of the forwarded list and removes a struck item', async ({
    page,
    context,
  }) => {
    await start(page, context, ANNA);
    await openList(page, MAMMA, NONNA_ID, NONNA);
    await expect(box(section(page, IT.checked), 'Zucchero')).toBeChecked();

    await press(button(page, IT.clear));
    await expect(entries(page, IT.checked)).toHaveCount(0);
    await expect(page.getByText('Zucchero', { exact: true })).toHaveCount(0);

    const sale = row(page, IT.removed, 'Sale');
    await expect(button(sale, restoreLabel('Sale'))).toBeVisible();
    await press(button(sale, removeLabel('Sale')));
    await expect(entries(page, IT.removed)).toHaveCount(0);
    await expect(page.getByText('Sale', { exact: true })).toHaveCount(0);
  });

  test('L11 — «Togli le spuntate» is there for a manager who is not the creator and for the assignee', async ({
    page,
    context,
  }) => {
    await start(page, context, MARCO);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    await expect(button(page, IT.clear)).toBeVisible();

    api.user = LUCA;
    await openList(page, MAMMA, SABATO_ID, 'Spesa del sabato');
    await expect(box(section(page, IT.checked), 'Pane')).toBeChecked();
    await expect(button(page, IT.clear)).toBeVisible();
    await press(button(page, IT.clear));
    await expect(entries(page, IT.checked)).toHaveCount(0);
  });

  test('L12 — a 403 on «Togli le spuntate» shows the alert and keeps the checked items', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    await press(box(section(page, IT.toGet), 'Pane'));
    await expect(box(section(page, IT.checked), 'Pane')).toBeChecked();
    api.clearScript.push({ status: 403, json: { error: 'forbidden' } });

    await press(button(page, IT.clear));

    await expect(alert(page, IT.forbidden)).toBeVisible();
    await expect(box(section(page, IT.checked), 'Pane')).toBeChecked();
  });

  test('L13 — a check on an item struck meanwhile: the list reloads and an alert says so', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openList(page, PRINCIPALE, LISTA_ID, LISTA);
    const reads = api.calls('GET', itemsPath(PRINCIPALE, LISTA_ID)).length;
    api.elsewhere(LISTA_ID, 'Pane', { removedBy: MARCO.personId });

    await press(box(section(page, IT.toGet), 'Pane'));

    await expect(alert(page, IT.stale)).toBeVisible();
    await expect(row(page, IT.removed, 'Pane').getByText('tolta da Marco')).toBeVisible();
    await expect(box(section(page, IT.toGet), 'Pane')).toHaveCount(0);
    expect(api.calls('GET', itemsPath(PRINCIPALE, LISTA_ID)).length).toBeGreaterThan(reads);
  });

  test('L14 — a remove or a restore on an item changed meanwhile: reload and alert', async ({
    page,
    context,
  }) => {
    await start(page, context, LUCA);
    await openList(page, MAMMA, NONNA_ID, NONNA);
    // Anna restored «Sale» and cancelled «Farina» after Luca opened the list.
    api.elsewhere(NONNA_ID, 'Sale', { removedBy: null });
    api.elsewhere(NONNA_ID, 'Farina', { deletedAt: MONDAY, removedBy: ANNA.personId });

    await press(button(row(page, IT.removed, 'Sale'), restoreLabel('Sale')));
    await expect(alert(page, IT.stale)).toBeVisible();
    await expect(box(section(page, IT.toGet), 'Sale')).toBeVisible();

    await press(button(page, removeLabel('Farina')));
    await expect(page.getByText('Farina', { exact: true })).toHaveCount(0);
    await expect(alert(page, IT.stale)).toBeVisible();
  });

  // Round 049: the form lives in the dialog «Nuovo task» and «Lista della spesa» is a checkbox
  // (CheckRow of the kit), no longer a switch.
  test('L15 — the form creates a shopping list with the box checked, and a plain task without', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await page.goto(`/family?id=${PRINCIPALE}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
    const dialog = page.getByRole('dialog', { name: IT.newTask, exact: true });
    const title = dialog.getByRole('textbox', { name: IT.newTitle, exact: true });
    const toggle = dialog.getByRole('checkbox', { name: IT.shoppingSwitch, exact: true });

    await press(button(page, IT.newTask));
    await expect(title).toBeVisible();
    await title.fill('Comprare il regalo per la nonna');
    await press(button(page, IT.add));
    await expect(page.getByText('Comprare il regalo per la nonna', { exact: true })).toBeVisible();

    await expect(dialog).toHaveCount(0);
    await press(button(page, IT.newTask));
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await title.fill('Spesa del weekend');
    await press(toggle);
    await expect(toggle).toBeChecked();
    await press(button(page, IT.add));
    await expect(
      page.getByRole('link', { name: open('Spesa del weekend'), exact: true }),
    ).toBeVisible();

    const sent = bodies('POST', `/api/families/${PRINCIPALE}/tasks`);
    expect(sent).toHaveLength(2);
    expect(sent[0]).not.toHaveProperty('template');
    expect(sent[1].template).toBe('SHOPPING_LIST');
    await expect(
      page.getByRole('link', { name: open('Comprare il regalo per la nonna'), exact: true }),
    ).toHaveCount(0);
  });

  test('L16 — an unknown list says «Lista non trovata»', async ({ page, context }) => {
    await start(page, context, GIULIA);
    await page.goto(`/list?family=${PRINCIPALE}&task=0192a3b4-0000-7000-8000-000000001999`);
    await expect(alert(page, IT.notFound)).toBeVisible();
  });
});

test.describe('device language en-US', () => {
  test.use({ locale: 'en-US', timezoneId: 'Europe/Rome' });

  test('L17 — the texts in English', async ({ page, context }) => {
    await start(page, context, ANNA);
    await page.goto(`/family?id=${MAMMA}`);
    await press(page.getByRole('link', { name: `Open the list «${NONNA}»`, exact: true }));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NONNA);

    await expect(section(page, 'To get')).toBeVisible();
    await expect(section(page, 'Checked')).toBeVisible();
    await expect(section(page, 'Removed items')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'New item', exact: true })).toBeVisible();
    await expect(button(page, 'Remove checked items')).toBeVisible();
    await expect(button(page, 'Remove «Uova»')).toBeVisible();
    await expect(button(page, 'Restore «Sale»')).toBeVisible();
    await expect(page.getByText('removed by Luca', { exact: true })).toBeVisible();
    await expect(page.getByText('added by Luca', { exact: true })).toBeVisible();
    await expect(page.getByText('added by someone', { exact: true })).toBeVisible();
  });
});
