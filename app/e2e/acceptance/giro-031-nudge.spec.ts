import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  ANNA,
  AUTO,
  FakeApi,
  LUCA,
  MAMMA,
  MARCO,
  MONDAY,
  PANE,
  PANE_ID,
  PRINCIPALE,
  SPESA,
  UUID,
  ZAINO,
  type Person,
} from './giro-031-fake-api';

// Round 031, T10 part 1 (app side): the nudge on the web (SPEC 8). In the row of an OPEN and
// assigned task, a manager sees the button «Sollecita «<title>»» / «Nudge «<title>»». A task with
// `lastNudgedAt` shows the text «Sollecitato alle HH:MM» / «Nudged at HH:MM», the time in the zone
// of the family (not of the browser: the browser runs in another zone on purpose). Every tap is a
// new mutationId; a 429 shows the alert «Sollecito già inviato da poco» / «Already nudged
// recently». Members do not see the button; a task in the queue has none. The server decides.
// Elements are found by role and accessible name, the mark by its visible text.

const IT = {
  familyTasks: 'Task della famiglia',
  nudge: (title: string) => `Sollecita «${title}»`,
  nudged: (time: string) => `Sollecitato alle ${time}`,
  tooSoon: 'Sollecito già inviato da poco',
};

const EN = {
  familyTasks: 'Family tasks',
  nudge: (title: string) => `Nudge «${title}»`,
  nudged: (time: string) => `Nudged at ${time}`,
  tooSoon: 'Already nudged recently',
};

const nudgePath = (familyId: string, id: string) => `/api/families/${familyId}/tasks/${id}/nudge`;

function familyTasks(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true });
}

function item(page: Page, list: string, title: string): Locator {
  return familyTasks(page, list)
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) });
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

async function openFamily(page: Page, familyId: string, name: string, list: string) {
  await page.goto(`/family?id=${familyId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(familyTasks(page, list)).toBeVisible();
}

function mutationIds(): string[] {
  return api
    .calls('POST', nudgePath(PRINCIPALE, PANE_ID))
    .map((r) => (r.postDataJSON() as { mutationId: string }).mutationId);
}

test.describe('device language it-IT, browser in New York', () => {
  test.use({ locale: 'it-IT', timezoneId: 'America/New_York' });

  test('N1 — Marco nudges, the mark shows 09:00 Rome time, a second tap gets the 429 alert', async ({
    page,
    context,
  }) => {
    await start(page, context, MARCO);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale', IT.familyTasks);

    const pane = item(page, IT.familyTasks, PANE);
    await expect(pane.getByText(/^Sollecitato alle/)).toHaveCount(0);
    await expect(
      item(page, IT.familyTasks, ZAINO).getByText(IT.nudged('08:15'), { exact: true }),
    ).toBeVisible();
    await expect(button(item(page, IT.familyTasks, ZAINO), IT.nudge(ZAINO))).toBeVisible();
    await expect(button(item(page, IT.familyTasks, AUTO), IT.nudge(AUTO))).toHaveCount(0);

    await press(button(pane, IT.nudge(PANE)));
    await expect(pane.getByText(IT.nudged('09:00'), { exact: true })).toBeVisible();
    expect(mutationIds()).toHaveLength(1);
    expect(mutationIds()[0]).toMatch(UUID);

    await press(button(pane, IT.nudge(PANE)));
    await expect(alert(page, IT.tooSoon)).toBeVisible();
    await expect(pane.getByText(IT.nudged('09:00'), { exact: true })).toBeVisible();
    const ids = mutationIds();
    expect(ids).toHaveLength(2);
    expect(ids[1]).toMatch(UUID);
    expect(ids[1]).not.toBe(ids[0]);
  });

  test('N2 — Anna (manager) sees the button on «Spesa per Anna», Luca (member) does not', async ({
    page,
    context,
  }) => {
    await start(page, context, ANNA);
    await openFamily(page, MAMMA, 'Famiglia Mamma', IT.familyTasks);
    await expect(button(item(page, IT.familyTasks, SPESA), IT.nudge(SPESA))).toBeVisible();

    await api.openSession(LUCA);
    await openFamily(page, MAMMA, 'Famiglia Mamma', IT.familyTasks);
    const spesa = item(page, IT.familyTasks, SPESA);
    await expect(spesa).toBeVisible();
    await expect(button(spesa, IT.nudge(SPESA))).toHaveCount(0);
    expect(api.requests.filter((r) => r.url().includes('/nudge'))).toHaveLength(0);
  });
});

test.describe('device language en-US, browser in Tokyo', () => {
  test.use({ locale: 'en-US', timezoneId: 'Asia/Tokyo' });

  test('N3 — the same in English, time still in the zone of the family', async ({
    page,
    context,
  }) => {
    await start(page, context, MARCO);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale', EN.familyTasks);

    const pane = item(page, EN.familyTasks, PANE);
    await press(button(pane, EN.nudge(PANE)));
    await expect(pane.getByText(EN.nudged('09:00'), { exact: true })).toBeVisible();
    await expect(
      item(page, EN.familyTasks, ZAINO).getByText(EN.nudged('08:15'), { exact: true }),
    ).toBeVisible();

    await press(button(pane, EN.nudge(PANE)));
    await expect(alert(page, EN.tooSoon)).toBeVisible();
  });
});
