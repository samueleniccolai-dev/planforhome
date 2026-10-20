import { expect, test, type Page } from '@playwright/test';

import { FakeApi, GIULIA, MARCO, PRINCIPALE, type Task } from './giro-011-fake-api';

// Round 013 (defect 012:major): with many tasks the family screen must scroll, so that the field
// of the new task and «Add task» can be reached at 1280x720. The fake API of round 011, plus twelve
// open tasks in Famiglia Principale. Elements are found by role and accessible name; the page is
// scrolled with the mouse wheel, as a person would.

type Texts = { locale: string; newTitle: string; add: string; familyTasks: string };

const cases: Texts[] = [
  {
    locale: 'it-IT',
    newTitle: 'Titolo del nuovo task',
    add: 'Aggiungi task',
    familyTasks: 'Task della famiglia',
  },
  { locale: 'en-US', newTitle: 'New task title', add: 'Add task', familyTasks: 'Family tasks' },
];

/** Twelve more open tasks of Principale (invented), due in November 2026, assigned to Marco. */
function manyTasks(): Task[] {
  return Array.from({ length: 12 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      id: `0192a3b4-0000-7000-8000-0000000013${n}`,
      familyId: PRINCIPALE,
      familyTimeZone: 'Europe/Rome',
      title: `Faccenda di prova ${n}`,
      notes: null,
      dueKind: 'DATE',
      due: `2026-11-${n}`,
      criticality: 'NORMAL',
      status: 'OPEN',
      assigneePersonId: MARCO.personId,
      createdBy: MARCO.personId,
      completedBy: null,
      version: 1,
      updatedAt: '2026-10-20T08:00:00Z',
    };
  });
}

/** Turns the mouse wheel over the middle of the page until {@code done} or 40 turns. */
async function wheelDown(page: Page, done: () => Promise<boolean>): Promise<void> {
  await page.mouse.move(640, 360);
  for (let turn = 0; turn < 40 && !(await done()); turn++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(50);
  }
}

for (const c of cases) {
  test.describe(`device language ${c.locale}`, () => {
    test.use({ locale: c.locale, viewport: { width: 1280, height: 720 } });

    test('with 20 tasks the field and «Add task» are reached with the wheel', async ({
      page,
      context,
    }) => {
      const api = new FakeApi(page, context);
      api.tasks.push(...manyTasks());
      await api.install();
      await api.openSession(GIULIA);

      await page.goto(`/family?id=${PRINCIPALE}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
      const list = page.getByRole('list', { name: c.familyTasks, exact: true });
      await expect(list.getByRole('listitem')).toHaveCount(20);

      const field = page.getByLabel(c.newTitle, { exact: true });
      const add = page.getByRole('button', { name: c.add, exact: true });
      // The page is longer than the window: without scrolling, the form is out of view.
      await expect(add).not.toBeInViewport();

      await wheelDown(page, () => add.isVisible().then((v) => v && add.evaluate(inView)));
      await expect(field).toBeInViewport();
      await expect(add).toBeInViewport();

      await field.click();
      await field.fill('Spolverare la libreria');
      await expect(add).toBeEnabled();
      await expect(add).toBeInViewport();
    });
  });
}

/** True when the element is entirely inside the window (run in the browser). */
function inView(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.top >= 0 && box.bottom <= window.innerHeight && box.height > 0;
}
