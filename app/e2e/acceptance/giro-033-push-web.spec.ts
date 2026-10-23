import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { ANNA, FakeApi, MONDAY, PANE_ID, SPESA, SPESA_ID, type Person } from './giro-031-fake-api';

// Round 033, T10 part 3 (web side). The tap on a notification opens `/tasks?task=<id>` (Android);
// the screen is the same on the web, so it is proved here against the fake API of round 031:
// - a task of the families of the person → a region «Aperto dalla notifica» / «Opened from the
//   notification» that shows the task (its title);
// - an id that is not among her tasks (another family, deleted) → the alert «Questo task non è più
//   disponibile» / «This task is no longer available»;
// - an id that is not a UUID → the usual screen, no region and no alert.
// W1 is a guard of non-regression: on the web nothing asks the permission or calls
// /api/me/devices, the page is not blank and there are no errors in the page.
// Demo data of round 031: Famiglia Mamma, Anna manager («Spesa per Anna»); «Comprare il pane»
// belongs to Famiglia Principale, where Anna is not a member.

const IT = {
  all: 'Tutte le mie famiglie',
  fromNotification: 'Aperto dalla notifica',
  notAvailable: 'Questo task non è più disponibile',
};
const EN = {
  all: 'All my families',
  fromNotification: 'Opened from the notification',
  notAvailable: 'This task is no longer available',
};

let api: FakeApi;

async function start(page: Page, context: BrowserContext, who: Person): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  api = new FakeApi(page, context);
  await api.install();
  await api.openSession(who);
  await page.clock.setFixedTime(new Date(MONDAY));
  return problems;
}

test.describe('giro 033 — web (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('W1 guard — signed in on the web: no /api/me/devices, no permission dialog, no page errors', async ({
    page,
    context,
  }) => {
    let dialogs = 0;
    page.on('dialog', () => dialogs++);
    const problems = await start(page, context, ANNA);
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { level: 1, name: IT.all })).toBeVisible();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(api.requests.filter((r) => new URL(r.url()).pathname === '/api/me/devices')).toEqual([]);
    expect(dialogs).toBe(0);
    expect(problems).toEqual([]);
  });

  test('W2 /tasks?task=<a task of Anna> shows it in the region «Aperto dalla notifica»', async ({
    page,
    context,
  }) => {
    await start(page, context, ANNA);
    await page.goto(`/tasks?task=${SPESA_ID}`);
    await expect(page.getByRole('heading', { level: 1, name: IT.all })).toBeVisible();
    const opened = page.getByRole('region', { name: IT.fromNotification, exact: true });
    await expect(opened).toBeVisible();
    await expect(opened.getByText(SPESA, { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('W3 /tasks?task=<a task of a family of others> shows the alert, never the task', async ({
    page,
    context,
  }) => {
    await start(page, context, ANNA);
    await page.goto(`/tasks?task=${PANE_ID}`);
    await expect(page.getByRole('alert').filter({ hasText: IT.notAvailable })).toBeVisible();
    await expect(page.getByRole('region', { name: IT.fromNotification })).toHaveCount(0);
    await expect(page.getByText('Comprare il pane', { exact: true })).toHaveCount(0);
  });

  test('W4 /tasks?task=<not a UUID> is the usual screen: no region, no alert', async ({
    page,
    context,
  }) => {
    await start(page, context, ANNA);
    await page.goto('/tasks?task=not-a-uuid');
    await expect(page.getByRole('heading', { level: 1, name: IT.all })).toBeVisible();
    await expect(page.getByText(SPESA, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('region', { name: IT.fromNotification })).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('giro 033 — web (en)', () => {
  test.use({ locale: 'en-US', timezoneId: 'Asia/Tokyo' });

  test('W5 the same in English: region and alert translated', async ({ page, context }) => {
    await start(page, context, ANNA);
    await page.goto(`/tasks?task=${SPESA_ID}`);
    const opened = page.getByRole('region', { name: EN.fromNotification, exact: true });
    await expect(opened.getByText(SPESA, { exact: true })).toBeVisible();

    await page.goto(`/tasks?task=${PANE_ID}`);
    await expect(page.getByRole('alert').filter({ hasText: EN.notAvailable })).toBeVisible();
  });
});
