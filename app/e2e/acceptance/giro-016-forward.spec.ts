import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  FakeApi,
  FOTO,
  FOTO_ID,
  GIULIA,
  LUCA,
  MAMMA,
  MONDAY,
  PRANZO,
  PRINCIPALE,
  REGALO,
  REGALO_ID,
  UUID,
  type Person,
} from './giro-016-fake-api';

// Round 016, T7 (app side): «Forward» on an OPEN task, for who has at least two families. The
// panel (role dialog, «Inoltra il task») has the group «Famiglia di arrivo» (radiogroup, one radio
// for every other family), an alert «Avviso inoltro» when the assignee is not a member of the
// chosen family (read from the members of that family, before the confirmation), «Conferma
// inoltro» (disabled until a family is chosen and while the request is pending) and «Annulla».
// The server decides: the alert only informs. Elements are found by role and accessible name.

const IT = {
  familyTasks: 'Task della famiglia',
  allTasks: 'Task di tutte le mie famiglie',
  dialog: 'Inoltra il task',
  arrival: 'Famiglia di arrivo',
  mamma: 'Famiglia Mamma',
  warning: 'Avviso inoltro',
  warningText: 'Marco non fa parte di Famiglia Mamma: il task andrà in coda.',
  confirm: 'Conferma inoltro',
  cancel: 'Annulla',
  forwarded: 'Inoltrato in Famiglia Mamma',
  forbidden: 'Non puoi inoltrare questo task',
};

const forwardLabel = (title: string) => `Inoltra «${title}»`;
const forwardPath = (familyId: string, id: string) =>
  `/api/families/${familyId}/tasks/${id}/forward`;

function familyTasks(page: Page): Locator {
  return page.getByRole('list', { name: IT.familyTasks, exact: true });
}

function item(page: Page, title: string): Locator {
  return familyTasks(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) });
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function dialog(page: Page): Locator {
  return page.getByRole('dialog', { name: IT.dialog, exact: true });
}

function warning(page: Page): Locator {
  return page.getByRole('alert', { name: IT.warning, exact: true });
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

async function openFamily(page: Page, familyId: string, name: string): Promise<void> {
  await page.goto(`/family?id=${familyId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(familyTasks(page)).toBeVisible();
}

/** Opens the panel of {@code title} and chooses Famiglia Mamma. */
async function chooseMamma(page: Page, title: string): Promise<Locator> {
  await press(button(page, forwardLabel(title)));
  const panel = dialog(page);
  await expect(panel).toBeVisible();
  const group = panel.getByRole('radiogroup', { name: IT.arrival, exact: true });
  await expect(group).toBeVisible();
  await expect(button(panel, IT.confirm)).toBeDisabled();
  await press(group.getByRole('radio', { name: IT.mamma, exact: true }));
  await expect(group.getByRole('radio', { name: IT.mamma, exact: true })).toBeChecked();
  return panel;
}

async function membersOfMammaRead(): Promise<void> {
  await expect
    .poll(() => api.calls('GET', `/api/families/${MAMMA}/members`).length)
    .toBeGreaterThan(0);
}

test.describe('device language it-IT', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('F1 — the warning on the assignee appears before the confirmation, nothing is sent', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');

    await press(button(item(page, FOTO), forwardLabel(FOTO)));
    const panel = dialog(page);
    await expect(panel).toBeVisible();
    // The focus goes inside the dialog when it opens (APG, dialog modal).
    await expect.poll(() => panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    const group = panel.getByRole('radiogroup', { name: IT.arrival, exact: true });
    await expect(group.getByRole('radio')).toHaveCount(1); // only the other family
    await expect(button(panel, IT.confirm)).toBeDisabled();
    await press(group.getByRole('radio', { name: IT.mamma, exact: true }));

    await expect(warning(page)).toBeVisible();
    await expect(warning(page)).toHaveText(IT.warningText);
    await expect(button(panel, IT.confirm)).toBeEnabled();
    expect(api.calls('POST', forwardPath(PRINCIPALE, FOTO_ID))).toHaveLength(0);
  });

  test('F2 — no warning when the assignee is a member of the family of arrival', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');

    const panel = await chooseMamma(page, REGALO);
    await membersOfMammaRead();
    await expect(button(panel, IT.confirm)).toBeEnabled();
    await expect(warning(page)).toHaveCount(0);
  });

  test('F3 — the confirmation sends one forward, the task leaves the list and shows in Mamma', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');

    const panel = await chooseMamma(page, FOTO);
    await press(button(panel, IT.confirm));

    await expect(page.getByText(IT.forwarded, { exact: true })).toBeVisible();
    await expect(item(page, FOTO)).toHaveCount(0);
    await expect(item(page, REGALO)).toHaveCount(1);
    await expect(dialog(page)).toHaveCount(0);
    const sent = api.calls('POST', forwardPath(PRINCIPALE, FOTO_ID));
    expect(sent).toHaveLength(1);
    const body = sent[0].postDataJSON() as { mutationId: string; toFamilyId: string };
    expect(body.toFamilyId).toBe(MAMMA);
    expect(body.mutationId).toMatch(UUID);

    await page.goto('/tasks');
    const all = page.getByRole('list', { name: IT.allTasks, exact: true });
    const moved = all.getByRole('listitem').filter({ has: page.getByText(FOTO, { exact: true }) });
    await expect(moved).toHaveCount(1);
    await expect(moved.getByText(IT.mamma, { exact: true })).toBeVisible();
  });

  test('F4 — two fast clicks on the confirmation send at most one forward', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    api.forwardDelayMs = 1500;
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');

    const panel = await chooseMamma(page, REGALO);
    const confirm = button(panel, IT.confirm);
    await confirm.dblclick();
    await expect(confirm).toBeDisabled(); // while the request is pending

    await expect(page.getByText(IT.forwarded, { exact: true })).toBeVisible();
    expect(api.calls('POST', forwardPath(PRINCIPALE, REGALO_ID))).toHaveLength(1);
  });

  test('F5 — «Annulla» sends nothing, the task stays, the focus goes back to «Inoltra»', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');

    const panel = await chooseMamma(page, FOTO);
    await press(button(panel, IT.cancel));

    await expect(dialog(page)).toHaveCount(0);
    await expect(item(page, FOTO)).toHaveCount(1);
    await expect(button(item(page, FOTO), forwardLabel(FOTO))).toBeFocused();
    expect(api.calls('POST', forwardPath(PRINCIPALE, FOTO_ID))).toHaveLength(0);
  });

  test('F6 — a 403 of the server says «Non puoi inoltrare questo task», the task stays', async ({
    page,
    context,
  }) => {
    await start(page, context, GIULIA);
    api.forwardScript.push({ status: 403, json: { error: 'forbidden' } });
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');

    const panel = await chooseMamma(page, FOTO);
    await press(button(panel, IT.confirm));

    await expect(page.getByText(IT.forbidden, { exact: true })).toBeVisible();
    await expect(item(page, FOTO)).toHaveCount(1);
    expect(api.calls('POST', forwardPath(PRINCIPALE, FOTO_ID))).toHaveLength(1);
  });

  test('F7 — who has only one family sees no «Inoltra»', async ({ page, context }) => {
    // Giulia (two families) sees «Inoltra» on the same task of Mamma: the difference is Luca.
    await start(page, context, GIULIA);
    await openFamily(page, MAMMA, 'Famiglia Mamma');
    await expect(button(item(page, PRANZO), forwardLabel(PRANZO))).toBeVisible();

    await api.openSession(LUCA);
    const before = api.calls('GET', '/api/families').length;
    await openFamily(page, MAMMA, 'Famiglia Mamma');
    await expect(item(page, PRANZO)).toHaveCount(1);
    // Wait for the families of Luca: the button must not appear once they are known.
    await expect.poll(() => api.calls('GET', '/api/families').length).toBeGreaterThan(before);
    await expect(page.getByRole('button', { name: /^Inoltra/ })).toHaveCount(0);
  });
});
