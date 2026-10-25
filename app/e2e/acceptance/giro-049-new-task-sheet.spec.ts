/// <reference types="node" />
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  CreateApi,
  CSRF,
  GIULIA,
  MAMMA,
  MENSA,
  NOW_049,
  PRINCIPALE,
  UUID_V7,
} from './giro-049-fake-api';

// Round 049, T14 part 1 (docs/lab/giri/049-piano.md, N1–N14): the new task is created in a `Sheet`
// (role dialog «Nuovo task») opened by the primary button «Nuovo task» of the family view or by
// «Aggiungi» of the empty state. Every field has a visible label above it and the same accessible
// name; «Aggiungi task» is disabled, with its reason linked, while the title is blank; the
// criticality is sent only when it is not Normal; the errors of the form and of the server show
// inside the dialog, which stays open. The browser clock is fixed at 2026-10-28T09:00Z and the
// device runs in Asia/Tokyo: a time is the local time of the family (Europe/Rome). Elements are
// found by role and accessible name; the texts are the ones decided in the plan.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const IT = {
  newTask: 'Nuovo task',
  title: 'Titolo',
  due: 'Scadenza',
  noDue: 'Nessuna scadenza',
  clearDue: 'Togli la scadenza',
  time: 'Ora (hh:mm, facoltativa)',
  criticality: 'Criticità',
  low: 'Bassa',
  normal: 'Normale',
  high: 'Alta',
  repeats: 'Si ripete',
  daily: 'Ogni giorno',
  shopping: 'Lista della spesa',
  add: 'Aggiungi task',
  reason: 'Scrivi il titolo per aggiungere il task.',
  close: 'Chiudi',
  region: 'Task della famiglia',
  needsDue: 'Un task ciclico ha bisogno di una scadenza.',
  failed: 'Qualcosa non ha funzionato. Riprova.',
  forbidden: 'Non hai il permesso di farlo.',
  empty: 'Nessun task.',
  emptyAdd: 'Aggiungi',
  openList: (title: string) => `Apri la lista «${title}»`,
};

const PANE = 'Comprare il pane';
const AUTO = "Portare l'auto in revisione";
const SABATO = 'Spesa del sabato';
const BASILICO = 'Annaffiare il basilico';
const BOLLETTA = 'Pagare la bolletta della luce';
const IDRAULICO = "Chiamare l'idraulico";

let api: CreateApi;

async function open(
  page: Page,
  context: BrowserContext,
  familyId = PRINCIPALE,
  query = '',
): Promise<void> {
  api = new CreateApi(page, context);
  await api.install();
  await api.base.openSession(GIULIA);
  await page.clock.setFixedTime(new Date(NOW_049));
  await page.goto(`/family?id=${familyId}${query}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    familyId === PRINCIPALE ? 'Famiglia Principale' : 'Famiglia Mamma',
  );
}

function region(page: Page): Locator {
  return page.getByRole('region', { name: IT.region, exact: true });
}

function card(page: Page, title: string): Locator {
  return region(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) });
}

function dialog(page: Page): Locator {
  return page.getByRole('dialog', { name: IT.newTask, exact: true });
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function field(scope: Locator, name: string): Locator {
  return scope.getByRole('textbox', { name, exact: true });
}

function newTask(page: Page): Locator {
  return button(page, IT.newTask);
}

/** Clicks once the control is there: a missing control fails as an assertion, not a timeout. */
async function press(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await target.click();
}

async function openSheet(page: Page): Promise<Locator> {
  await expect(region(page).getByText(MENSA, { exact: true })).toBeVisible();
  await press(newTask(page));
  await expect(dialog(page)).toBeVisible();
  return dialog(page);
}

async function fontSize(locator: Locator): Promise<number> {
  return locator.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let holder: Element = root;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent?.trim() && node.parentElement) {
        holder = node.parentElement;
        break;
      }
    }
    return parseFloat(getComputedStyle(holder).fontSize);
  });
}

test.describe('giro 049 — new task in the sheet (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Asia/Tokyo' });

  test('N1 «Nuovo task» opens the dialog «Nuovo task» with the focus on «Titolo»', async ({
    page,
    context,
  }) => {
    await open(page, context);
    await expect(dialog(page)).toHaveCount(0);
    // The form is no longer always open in the family view.
    await expect(page.getByRole('textbox', { name: IT.title, exact: true })).toHaveCount(0);
    const sheet = await openSheet(page);
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet.getByText(IT.newTask, { exact: true })).toBeVisible();
    await expect(field(sheet, IT.title)).toBeFocused();
    await expect(button(sheet, IT.close)).toBeVisible();
  });

  test('N2 a task with its title only in three interactions, focus back on «Nuovo task»', async ({
    page,
    context,
  }) => {
    await open(page, context);
    await expect(region(page).getByText(MENSA, { exact: true })).toBeVisible();
    let interactions = 0;

    interactions++;
    await press(newTask(page));
    await expect(dialog(page)).toBeVisible();
    interactions++;
    await page.keyboard.type(PANE); // no click on the field: it already has the focus
    interactions++;
    await press(button(dialog(page), IT.add));

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, PANE)).toHaveCount(1);
    await expect(newTask(page)).toBeFocused();
    expect(interactions).toBeLessThanOrEqual(3);

    const posts = api.creations(PRINCIPALE);
    expect(posts).toHaveLength(1);
    const body = posts[0].postDataJSON() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['id', 'mutationId', 'title']);
    expect(body.title).toBe(PANE);
    expect(body.id).toMatch(UUID_V7);
    expect(body.mutationId).toMatch(UUID_V7);
    expect(posts[0].headers()['x-csrf-token']).toBe(CSRF);
  });

  test('N3 every field has a visible label above it, the same as its accessible name', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const sheet = await openSheet(page);
    for (const label of [IT.title, IT.due, IT.time, IT.criticality, IT.repeats, IT.shopping]) {
      await expect(sheet.getByText(label, { exact: true }).first(), label).toBeVisible();
    }
    const title = field(sheet, IT.title);
    const due = field(sheet, IT.due);
    const time = field(sheet, IT.time);
    await expect(title).toBeVisible();
    await expect(due).toBeVisible();
    await expect(time).toBeVisible();
    await expect(
      sheet.getByRole('radiogroup', { name: IT.criticality, exact: true }),
    ).toBeVisible();
    await expect(sheet.getByRole('radiogroup', { name: IT.repeats, exact: true })).toBeVisible();
    await expect(sheet.getByRole('checkbox', { name: IT.shopping, exact: true })).toBeVisible();

    // The label is above its field, not a placeholder inside it.
    for (const [label, input] of [
      [IT.title, title],
      [IT.time, time],
    ] as const) {
      const text = (await sheet.getByText(label, { exact: true }).boundingBox())!;
      const box = (await input.boundingBox())!;
      expect(text.y + text.height, label).toBeLessThanOrEqual(box.y + 1);
    }
    for (const box of await sheet.getByRole('textbox').all()) {
      await expect(box).toHaveAccessibleName(/\S/);
      const name = await box.evaluate(
        (el) =>
          el.getAttribute('aria-label') ??
          (el.getAttribute('aria-labelledby') ?? '')
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '')
            .join(' ')
            .trim(),
      );
      const placeholder = (await box.getAttribute('placeholder')) ?? '';
      expect(placeholder === '' || placeholder !== name, `placeholder of ${name}`).toBe(true);
    }
  });

  test('N4 «Aggiungi task» is disabled with its reason while the title is blank', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const sheet = await openSheet(page);
    const add = button(sheet, IT.add);
    await expect(add).toBeDisabled();
    await expect(sheet.getByText(IT.reason, { exact: true })).toBeVisible();
    await expect(add).toHaveAccessibleDescription(IT.reason);
    await add.click({ force: true });

    await field(sheet, IT.title).fill('   ');
    await expect(add).toBeDisabled();
    await expect(add).toHaveAccessibleDescription(IT.reason);
    await add.click({ force: true });
    await page.waitForTimeout(300);
    expect(api.creations(PRINCIPALE)).toHaveLength(0);

    await field(sheet, IT.title).fill(PANE);
    await expect(add).toBeEnabled();
    await expect(sheet.getByText(IT.reason, { exact: true })).toHaveCount(0);
    await expect(add).not.toHaveAccessibleDescription(IT.reason);
  });

  test('N5 «Criticità»: Normale by default, «Alta» is sent and shown on the card', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const sheet = await openSheet(page);
    const group = sheet.getByRole('radiogroup', { name: IT.criticality, exact: true });
    await expect(group.getByRole('radio')).toHaveCount(3);
    for (const [name, checked] of [
      [IT.low, 'false'],
      [IT.normal, 'true'],
      [IT.high, 'false'],
    ] as const) {
      await expect(group.getByRole('radio', { name, exact: true })).toHaveAttribute(
        'aria-checked',
        checked,
      );
    }
    await field(sheet, IT.title).fill(AUTO);
    await press(group.getByRole('radio', { name: IT.high, exact: true }));
    await expect(group.getByRole('radio', { name: IT.high, exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(group.getByRole('radio', { name: IT.normal, exact: true })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await press(button(sheet, IT.add));

    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, AUTO).getByText(IT.high, { exact: true })).toBeVisible();
    const [body] = api.bodies(PRINCIPALE);
    expect(body).toMatchObject({ title: AUTO, criticality: 'HIGH' });
    expect(Object.keys(body).sort()).toEqual(['criticality', 'id', 'mutationId', 'title']);
  });

  test('N6 «Scadenza» on the web: a date, a date and time in Rome, «Togli la scadenza»', async ({
    page,
    context,
  }) => {
    await open(page, context);
    let sheet = await openSheet(page);
    await expect(sheet.getByText(IT.noDue, { exact: true })).toBeVisible();
    await expect(button(sheet, IT.clearDue)).toHaveCount(0);

    await field(sheet, IT.due).fill('2026-10-30');
    await expect(sheet.getByText(IT.noDue, { exact: true })).toHaveCount(0);
    await press(button(sheet, IT.clearDue));
    await expect(sheet.getByText(IT.noDue, { exact: true })).toBeVisible();
    await expect(field(sheet, IT.due)).toHaveValue('');

    await field(sheet, IT.title).fill(BOLLETTA);
    await field(sheet, IT.due).fill('2026-10-30');
    await press(button(sheet, IT.add));
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, BOLLETTA)).toHaveCount(1);

    sheet = await openSheet(page);
    await field(sheet, IT.title).fill(IDRAULICO);
    await field(sheet, IT.due).fill('2026-10-30');
    await field(sheet, IT.time).fill('18:30');
    await press(button(sheet, IT.add));
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, IDRAULICO)).toHaveCount(1);

    const [date, dateTime] = api.bodies(PRINCIPALE);
    expect(date).toMatchObject({ title: BOLLETTA, dueKind: 'DATE', due: '2026-10-30' });
    expect(dateTime).toMatchObject({ title: IDRAULICO, dueKind: 'DATETIME' });
    // 30 October 2026 is after the end of summer time: Rome is UTC+1.
    expect(new Date(dateTime.due as string).toISOString()).toBe('2026-10-30T17:30:00.000Z');
  });

  test('N7 «Lista della spesa» is a checkbox whose state is read without colour', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const sheet = await openSheet(page);
    const shopping = sheet.getByRole('checkbox', { name: IT.shopping, exact: true });
    await expect(shopping).toHaveAttribute('aria-checked', 'false');
    const box = (await shopping.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(48);
    await press(shopping);
    await expect(shopping).toHaveAttribute('aria-checked', 'true');

    await field(sheet, IT.title).fill(SABATO);
    await press(button(sheet, IT.add));
    await expect(dialog(page)).toHaveCount(0);
    await expect(
      card(page, SABATO).getByRole('link', { name: IT.openList(SABATO), exact: true }),
    ).toBeVisible();
    const [body] = api.bodies(PRINCIPALE);
    expect(body).toMatchObject({ title: SABATO, template: 'SHOPPING_LIST' });
  });

  test('N8 Esc and «Chiudi» close without a POST, the focus goes back, the form is empty', async ({
    page,
    context,
  }) => {
    await open(page, context);
    let sheet = await openSheet(page);
    await field(sheet, IT.title).fill(PANE);
    await press(sheet.getByRole('radio', { name: IT.high, exact: true }));
    await press(sheet.getByRole('checkbox', { name: IT.shopping, exact: true }));
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(newTask(page)).toBeFocused();

    sheet = await openSheet(page);
    await expect(field(sheet, IT.title)).toHaveValue('');
    await expect(sheet.getByRole('radio', { name: IT.normal, exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(sheet.getByRole('checkbox', { name: IT.shopping, exact: true })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await field(sheet, IT.title).fill(AUTO);
    await press(button(sheet, IT.close));
    await expect(dialog(page)).toHaveCount(0);
    await expect(newTask(page)).toBeFocused();
    sheet = await openSheet(page);
    await expect(field(sheet, IT.title)).toHaveValue('');
    await page.waitForTimeout(300);
    expect(api.creations(PRINCIPALE)).toHaveLength(0);
  });

  test('N8 a rule without a due: the alert is inside the dialog, which stays open', async ({
    page,
    context,
  }) => {
    await open(page, context);
    const sheet = await openSheet(page);
    await field(sheet, IT.title).fill(BASILICO);
    await press(sheet.getByRole('radio', { name: IT.daily, exact: true }));
    await press(button(sheet, IT.add));
    await expect(sheet.getByRole('alert')).toHaveText(IT.needsDue);
    await expect(dialog(page)).toBeVisible();
    await expect(field(sheet, IT.title)).toHaveValue(BASILICO);
    await page.waitForTimeout(300);
    expect(api.creations(PRINCIPALE)).toHaveLength(0);
  });

  test('N13 a network error and a 403 show inside the dialog; the retry keeps the ids', async ({
    page,
    context,
  }) => {
    await open(page, context);
    api.createScript.push('abort');
    let sheet = await openSheet(page);
    await field(sheet, IT.title).fill(PANE);
    await press(button(sheet, IT.add));
    await expect(sheet.getByRole('alert')).toHaveText(IT.failed);
    await expect(dialog(page)).toBeVisible();
    await expect(field(sheet, IT.title)).toHaveValue(PANE);
    await expect(card(page, PANE)).toHaveCount(0);

    await press(button(sheet, IT.add));
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, PANE)).toHaveCount(1);
    const [first, second] = api.bodies(PRINCIPALE);
    expect(second).toEqual(first);

    api.createScript.push({ status: 403, json: { error: 'forbidden' } });
    sheet = await openSheet(page);
    await field(sheet, IT.title).fill(AUTO);
    await press(button(sheet, IT.add));
    await expect(sheet.getByRole('alert')).toHaveText(IT.forbidden);
    await expect(dialog(page)).toBeVisible();
    await expect(field(sheet, IT.title)).toHaveValue(AUTO);
    await expect(card(page, AUTO)).toHaveCount(0);
  });

  test('N14 the dialog closed while the POST is in flight: the answer does not reopen it', async ({
    page,
    context,
  }) => {
    await open(page, context);
    // A failure after the close goes to the alert of the section.
    let release = api.hold();
    api.createScript.push('abort');
    let sheet = await openSheet(page);
    await field(sheet, IT.title).fill(PANE);
    await press(button(sheet, IT.add));
    await expect.poll(() => api.creations(PRINCIPALE).length).toBe(1);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    release();
    await expect(page.getByRole('alert').filter({ hasText: IT.failed })).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    sheet = await openSheet(page);
    await expect(field(sheet, IT.title)).toHaveValue('');
    await press(button(sheet, IT.close));

    // A success after the close shows the task and leaves the dialog closed.
    release = api.hold();
    sheet = await openSheet(page);
    await field(sheet, IT.title).fill(AUTO);
    await press(button(sheet, IT.add));
    await expect.poll(() => api.creations(PRINCIPALE).length).toBe(2);
    await press(button(sheet, IT.close));
    await expect(dialog(page)).toHaveCount(0);
    release();
    await expect(card(page, AUTO)).toHaveCount(1);
    await page.waitForTimeout(300);
    await expect(dialog(page)).toHaveCount(0);
  });

  test('N9 empty family: «Aggiungi» opens the dialog, the creation brings the focus back', async ({
    page,
    context,
  }) => {
    await open(page, context, MAMMA);
    await expect(page.getByText(IT.empty, { exact: true })).toBeVisible();
    await press(button(page, IT.emptyAdd));
    const sheet = dialog(page);
    await expect(sheet).toBeVisible();
    await expect(field(sheet, IT.title)).toBeFocused();
    await page.keyboard.type(PANE);
    await press(button(sheet, IT.add));
    await expect(dialog(page)).toHaveCount(0);
    await expect(card(page, PANE)).toHaveCount(1);
    await expect(newTask(page)).toBeFocused();
    expect(api.creations(MAMMA)).toHaveLength(1);
  });

  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ]) {
    for (const fs of [1, 2]) {
      test(`N11 the dialog at ${width}×${height}, font scale ${fs}: no horizontal overflow`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width, height });
        await open(page, context, PRINCIPALE, `&fs=${fs}`);
        const mensa = region(page).getByText(MENSA, { exact: true });
        await expect(mensa).toBeVisible();
        // The prerendered page has fs=1; after hydration the query applies.
        await expect.poll(() => fontSize(mensa)).toBe(18 * fs);
        const sheet = await openSheet(page);
        const box = (await sheet.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
          ),
        ).toBe(true);
        for (const name of [IT.title, IT.due, IT.time]) {
          const r = (await field(sheet, name).boundingBox())!;
          expect(r.x + r.width, name).toBeLessThanOrEqual(width + 1);
          expect(r.height, name).toBeGreaterThanOrEqual(48);
        }
        for (const radio of await sheet.getByRole('radio').all()) {
          expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(48);
        }
        const add = button(sheet, IT.add);
        await add.scrollIntoViewIfNeeded();
        await expect(add).toBeInViewport();
        const path = `${SCREENSHOTS}/new-task-sheet-${width}-fs${fs}.png`;
        await page.screenshot({ path });
        expect(statSync(join(APP, path)).size).toBeGreaterThan(0);
      });
    }
  }

  test('N12 NewTaskForm is made of the kit: only View from react-native, no static tokens', () => {
    const source = readFileSync(join(APP, 'src', 'task', 'NewTaskForm.tsx'), 'utf8');
    expect(source).not.toMatch(/StyleSheet/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/from\s+['"]@\/ui\/tokens['"]/);
    const natives = [
      ...source.matchAll(/import\s*(type\s+)?\{([^}]*)\}\s*from\s*['"]react-native['"]/g),
    ];
    const values = natives
      .filter((m) => !m[1])
      .flatMap((m) => m[2].split(','))
      .map((n) => n.trim())
      .filter((n) => n !== '' && !n.startsWith('type '));
    expect(values.filter((n) => n !== 'View')).toEqual([]);
    for (const name of ['CheckRow', 'RadioRow', 'Sheet', 'DateField']) {
      const path = join(APP, 'src', 'ui', `${name}.tsx`);
      expect(existsSync(path), `${name}.tsx`).toBe(true);
      expect(readFileSync(path, 'utf8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
    const web = join(APP, 'src', 'ui', 'DateField.web.tsx');
    expect(existsSync(web), 'DateField.web.tsx').toBe(true);
    expect(readFileSync(web, 'utf8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

test.describe('giro 049 — new task in the sheet (en)', () => {
  test.use({ locale: 'en-US', timezoneId: 'Asia/Tokyo' });

  test('N10 the dialog in English', async ({ page, context }) => {
    await open(page, context);
    const all = page.getByRole('region', { name: 'Family tasks', exact: true });
    await expect(all.getByText(MENSA, { exact: true })).toBeVisible();
    await press(button(page, 'New task'));
    const sheet = page.getByRole('dialog', { name: 'New task', exact: true });
    await expect(sheet).toBeVisible();
    await expect(field(sheet, 'Title')).toBeFocused();
    await expect(field(sheet, 'Due date')).toBeVisible();
    const group = sheet.getByRole('radiogroup', { name: 'Criticality', exact: true });
    for (const name of ['Low', 'Normal', 'High']) {
      await expect(group.getByRole('radio', { name, exact: true })).toBeVisible();
    }
    const add = button(sheet, 'Add task');
    await expect(add).toBeDisabled();
    await expect(add).toHaveAccessibleDescription('Write the title to add the task.');
  });
});
