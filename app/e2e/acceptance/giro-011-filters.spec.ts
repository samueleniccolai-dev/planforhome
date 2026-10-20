import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  BUS,
  CANTINA,
  DIVANO,
  FakeApi,
  FOTO,
  GIULIA,
  LIBRI,
  LUCA,
  MENSA,
  NOW,
  PRANZO,
  REGALI,
  REGALO,
  ZAINO,
  type Person,
} from './giro-011-fake-api';

// Round 011, T5 part 3 (app side): the filters of «All my families». A group labelled «Filter» of
// buttons with aria-pressed, one pressed at a time. The browser clock is fixed at 2026-11-02T10:00Z
// and the device runs in Asia/Tokyo: «Due soon» counts days in the zone of the family of each task
// (Principale in Rome, Mamma in New York here). Which task is in which filter is written next to
// each task in giro-011-fake-api.ts.

const SCREENSHOTS = 'e2e-screenshots';

const ALL_TITLES = [ZAINO, REGALO, CANTINA, DIVANO, MENSA, FOTO, LIBRI, BUS, PRANZO, REGALI];

type Texts = {
  locale: string;
  lang: string;
  allFamilies: string;
  allTasks: string;
  group: string;
  all: string;
  mine: string;
  queue: string;
  dueSoon: string;
  empty: string;
};

const cases: Texts[] = [
  {
    locale: 'it-IT',
    lang: 'it',
    allFamilies: 'Tutte le mie famiglie',
    allTasks: 'Task di tutte le mie famiglie',
    group: 'Filtro',
    all: 'Tutti',
    mine: 'Assegnati a me',
    queue: 'In coda',
    dueSoon: 'In scadenza',
    empty: 'Nessun task con questo filtro.',
  },
  {
    locale: 'en-US',
    lang: 'en',
    allFamilies: 'All my families',
    allTasks: 'Tasks of all my families',
    group: 'Filter',
    all: 'All',
    mine: 'Assigned to me',
    queue: 'In queue',
    dueSoon: 'Due soon',
    empty: 'No tasks match this filter.',
  },
];

function filters(page: Page, c: Texts): Locator {
  return page.getByRole('group', { name: c.group, exact: true });
}

function filter(page: Page, c: Texts, name: string): Locator {
  return filters(page, c).getByRole('button', { name, exact: true });
}

/** Clicks once the control is there: a missing control fails as an assertion, not a timeout. */
async function press(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await target.click();
}

async function titles(page: Page, c: Texts): Promise<string[]> {
  const list = page.getByRole('list', { name: c.allTasks, exact: true });
  const shown: string[] = [];
  for (const title of ALL_TITLES) {
    const found = list
      .getByRole('listitem')
      .filter({ has: page.getByText(title, { exact: true }) });
    if ((await found.count()) > 0) shown.push(title);
  }
  return shown.sort();
}

async function expectShown(page: Page, c: Texts, expected: string[]): Promise<void> {
  const list = page.getByRole('list', { name: c.allTasks, exact: true });
  await expect(list.getByRole('listitem')).toHaveCount(expected.length);
  expect(await titles(page, c)).toEqual([...expected].sort());
}

/** Exactly the named filter is pressed, the other three are not. */
async function expectPressed(page: Page, c: Texts, name: string): Promise<void> {
  for (const other of [c.all, c.mine, c.queue, c.dueSoon]) {
    await expect(
      filters(page, c).getByRole('button', { name: other, exact: true, pressed: other === name }),
    ).toHaveCount(1);
  }
}

for (const c of cases) {
  test.describe(`device language ${c.locale}, device zone Asia/Tokyo`, () => {
    test.use({ locale: c.locale, timezoneId: 'Asia/Tokyo' });

    let api: FakeApi;
    const open = async (page: Page, context: BrowserContext, who: Person) => {
      api = new FakeApi(page, context);
      await api.install();
      await api.openSession(who);
      await page.clock.setFixedTime(new Date(NOW));
      await page.goto('/tasks');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.allFamilies);
    };

    test('«All» is pressed at first and shows every task with its status', async ({
      page,
      context,
    }) => {
      await open(page, context, GIULIA);
      await expect(filters(page, c)).toBeVisible();
      await expectPressed(page, c, c.all);
      await expectShown(page, c, ALL_TITLES);
    });

    test('«Assigned to me»: open tasks of Giulia only, not those of Leo', async ({
      page,
      context,
    }) => {
      await open(page, context, GIULIA);
      await press(filter(page, c, c.mine));
      await expectPressed(page, c, c.mine);
      await expectShown(page, c, [REGALO, REGALI]);
      await page.screenshot({ path: `${SCREENSHOTS}/tasks-mine-${c.lang}.png`, fullPage: true });
    });

    test('«In queue»: open tasks without assignee, not the cancelled one', async ({
      page,
      context,
    }) => {
      await open(page, context, GIULIA);
      await press(filter(page, c, c.queue));
      await expectPressed(page, c, c.queue);
      await expectShown(page, c, [MENSA, PRANZO]);
    });

    test('«Due soon»: up to 7 days in the zone of the family, overdue included', async ({
      page,
      context,
    }) => {
      await open(page, context, GIULIA);
      await press(filter(page, c, c.dueSoon));
      await expectPressed(page, c, c.dueSoon);
      // Not the bus (8 days), the Christmas lunch, the done cellar nor the cancelled sofa.
      await expectShown(page, c, [ZAINO, REGALO, MENSA, FOTO, LIBRI, REGALI]);
      await page.screenshot({
        path: `${SCREENSHOTS}/tasks-due-soon-${c.lang}.png`,
        fullPage: true,
      });
    });

    test('back to «All» shows every task again', async ({ page, context }) => {
      await open(page, context, GIULIA);
      await press(filter(page, c, c.queue));
      await expectShown(page, c, [MENSA, PRANZO]);
      await press(filter(page, c, c.all));
      await expectPressed(page, c, c.all);
      await expectShown(page, c, ALL_TITLES);
      await expect(page.getByText(c.empty, { exact: true })).toHaveCount(0);
    });

    test('a filter with no task says so', async ({ page, context }) => {
      await open(page, context, LUCA); // Mamma only: nothing assigned to Luca
      await expectShown(page, c, [PRANZO, REGALI]);
      await press(filter(page, c, c.mine));
      await expectPressed(page, c, c.mine);
      await expect(page.getByText(c.empty, { exact: true })).toBeVisible();
      await expect(
        page.getByRole('list', { name: c.allTasks, exact: true }).getByRole('listitem'),
      ).toHaveCount(0);
      // Filtering happens on the client: one load of the tasks, no new request.
      expect(api.calls('GET', '/api/tasks')).toHaveLength(1);
    });
  });
}
