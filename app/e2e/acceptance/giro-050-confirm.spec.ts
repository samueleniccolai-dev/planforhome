/// <reference types="node" />
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  FakeApi as RecurrenceApi,
  CARTA,
  CARTA_ID,
  GIULIA as GIULIA_014,
  PANE,
  PANE_ID,
  PRINCIPALE as PRINCIPALE_014,
  THURSDAY,
} from './giro-014-fake-api';
import {
  FakeApi as ForwardApi,
  FOTO,
  GIULIA,
  MAMMA,
  MONDAY,
  PRINCIPALE,
  REGALO,
  REGALO_ID,
  type Task,
} from './giro-016-fake-api';

// Round 050, T14 part 2 (docs/lab/giri/050-piano.md): the `ConfirmDialog` of the kit.
// - The forward dialog «Inoltra il task» writes the consequence before the confirmation; it is the
//   accessible description of «Conferma inoltro» (disabled until a family is chosen, with the
//   reason as description). Fake API of round 016.
// - «Annulla task», «Annulla questa volta», «Termina la serie» open a confirmation dialog with the
//   consequence; the confirm buttons are no longer in the row. After the write the dialog closes
//   anyway, even on error (choice (a) of the plan): the notice goes to the section and the focus
//   back to the button that opened the dialog. Fake API of round 014.
// Elements are found by role and accessible name; the texts are the ones decided in the plan.

const APP = resolve(__dirname, '..', '..');
const SCREENSHOTS = 'e2e-screenshots';

const IT = {
  familyTasks: 'Task della famiglia',
  forwardDialog: 'Inoltra il task',
  arrival: 'Famiglia di arrivo',
  mamma: 'Famiglia Mamma',
  confirmForward: 'Conferma inoltro',
  cancelForward: 'Annulla',
  close: 'Chiudi',
  chooseFamily: 'Scegli la famiglia di arrivo.',
  staysAssigned: 'Il task passa in Famiglia Mamma e resta assegnato a Giulia.',
  staysQueued: 'Il task passa in Famiglia Mamma e resta in coda.',
  warning: 'Avviso inoltro',
  goesToQueue: 'Marco non fa parte di Famiglia Mamma: il task andrà in coda.',
  unknownMembers: 'Il task passa in Famiglia Mamma. Se Marco non ne fa parte, andrà in coda.',
  sameRecurrence: 'La ricorrenza resta uguale.',
  forwarded: 'Inoltrato in Famiglia Mamma',
  cancelTask: 'Annulla task',
  cancelOnce: 'Annulla questa volta',
  confirmCancel: 'Conferma annullamento',
  keep: 'Non annullare',
  endSeries: 'Termina la serie',
  confirmEndSeries: 'Conferma: termina la serie',
  keepSeries: 'Non terminare',
  cancelled: 'Annullato',
  failed: 'Qualcosa non ha funzionato. Riprova.',
  cancelDialog: (title: string) => `Annullare «${title}»?`,
  cancelConsequence: 'Il task passa tra i Chiusi come annullato e nessuno lo vedrà più da fare.',
  cancelOnceDialog: 'Annullare questa volta?',
  cancelOnceConsequence: (title: string) =>
    `Si annulla solo questa occorrenza di «${title}»; le prossime restano.`,
  endSeriesDialog: (title: string) => `Terminare la serie «${title}»?`,
  endSeriesConsequence: 'Si annulla questa occorrenza e non ne arriveranno altre.',
  forward: (title: string) => `Inoltra «${title}»`,
};

// Invented tasks added to the fake API of round 016 (plan, «Dati demo»).
const CAPPOTTO = 'Ritirare il cappotto in tintoria';
const CAPPOTTO_ID = '0192a3b4-0000-7000-8000-000000005001';
const ORTO = "Annaffiare l'orto";
const ORTO_ID = '0192a3b4-0000-7000-8000-000000005002';

function extraTasks(): Task[] {
  const base = {
    familyId: PRINCIPALE,
    familyTimeZone: 'Europe/Rome',
    notes: null,
    criticality: 'NORMAL' as const,
    status: 'OPEN' as const,
    createdBy: GIULIA.personId,
    completedBy: null,
    version: 1,
    updatedAt: '2031-01-05T08:00:00Z',
  };
  const cappotto: Task = {
    ...base,
    id: CAPPOTTO_ID,
    title: CAPPOTTO,
    dueKind: null,
    due: null,
    assigneePersonId: null,
    recurrence: null,
    seriesId: null,
  };
  // Every Saturday, assigned to Giulia: the fake of 016 types `recurrence` as null only.
  const orto = {
    ...base,
    id: ORTO_ID,
    title: ORTO,
    dueKind: 'DATE',
    due: '2031-01-11',
    assigneePersonId: GIULIA.personId,
    recurrence: { type: 'WEEKLY', days: ['SATURDAY'] },
    seriesId: ORTO_ID,
  } as unknown as Task;
  return [cappotto, orto];
}

function familyTasks(page: Page): Locator {
  // The region of the family screen, in Italian or in English (E1).
  return page.getByRole('region', { name: /^(Task della famiglia|Family tasks)$/ });
}

function item(page: Page, title: string): Locator {
  return familyTasks(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) });
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

function dialog(page: Page, name: string): Locator {
  return page.getByRole('dialog', { name, exact: true });
}

async function press(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await target.click();
}

/** Same measure as rounds 046 and 049: text out of the viewport or cut by a clipping ancestor. */
async function cutTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > width + 1) {
      problems.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${width}`);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('input, textarea, script, style, noscript')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < -1 || r.right > width + 1) problems.push(`outside the viewport: ${text}`);
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        const box = a.getBoundingClientRect();
        const scrollsX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
        const scrollsY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
        if (scrollsX && a.scrollWidth > a.clientWidth + 1) {
          problems.push(`horizontal scroll around: ${text}`);
          break;
        }
        const clipX = cs.overflowX !== 'visible' && !scrollsX;
        const clipY = cs.overflowY !== 'visible' && !scrollsY;
        if (
          (clipX && (r.left < box.left - 1 || r.right > box.right + 1)) ||
          (clipY && (r.top < box.top - 1 || r.bottom > box.bottom + 1))
        ) {
          problems.push(`cut: ${text}`);
          break;
        }
      }
    }
    return problems;
  });
}

// ------------------------------------------------------------------ forward (fake API of 016)

let fwd: ForwardApi;

async function startForward(page: Page, context: BrowserContext): Promise<void> {
  fwd = new ForwardApi(page, context);
  fwd.tasks.push(...extraTasks());
  await fwd.install();
  await fwd.openSession(GIULIA);
  await page.clock.setFixedTime(new Date(MONDAY));
  await page.goto(`/family?id=${PRINCIPALE}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
  await expect(familyTasks(page)).toBeVisible();
}

const forwardPath = (id: string) => `/api/families/${PRINCIPALE}/tasks/${id}/forward`;

/** Opens the forward dialog of {@code title}: «Conferma inoltro» is disabled, with its reason. */
async function openForward(page: Page, title: string): Promise<Locator> {
  await press(button(item(page, title), IT.forward(title)));
  const panel = dialog(page, IT.forwardDialog);
  await expect(panel).toBeVisible();
  const confirm = button(panel, IT.confirmForward);
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveAccessibleDescription(IT.chooseFamily);
  return panel;
}

async function chooseMamma(panel: Locator): Promise<void> {
  const group = panel.getByRole('radiogroup', { name: IT.arrival, exact: true });
  const radio = group.getByRole('radio', { name: IT.mamma, exact: true });
  await press(radio);
  await expect(radio).toBeChecked();
}

test.describe('giro 050 — forward with the consequence written (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('I1 the consequence is written before the confirmation and describes it', async ({
    page,
    context,
  }) => {
    await startForward(page, context);
    const panel = await openForward(page, REGALO);
    await expect(panel.getByText(REGALO, { exact: true })).toBeVisible();
    await expect(panel.getByText(IT.chooseFamily, { exact: true })).toBeVisible();

    await chooseMamma(panel);
    await expect(panel.getByText(IT.staysAssigned, { exact: true })).toBeVisible();
    const confirm = button(panel, IT.confirmForward);
    await expect(confirm).toBeEnabled();
    await expect(confirm).toHaveAccessibleDescription(IT.staysAssigned);
    await page.waitForTimeout(300);
    expect(fwd.calls('POST', forwardPath(REGALO_ID))).toHaveLength(0);
  });

  test('I2 a task in the queue stays in the queue; the confirmation sends one forward', async ({
    page,
    context,
  }) => {
    await startForward(page, context);
    const panel = await openForward(page, CAPPOTTO);
    await chooseMamma(panel);
    await expect(panel.getByText(IT.staysQueued, { exact: true })).toBeVisible();
    await expect(button(panel, IT.confirmForward)).toHaveAccessibleDescription(IT.staysQueued);

    await press(button(panel, IT.confirmForward));
    await expect(page.getByText(IT.forwarded, { exact: true })).toBeVisible();
    await expect(dialog(page, IT.forwardDialog)).toHaveCount(0);
    expect(fwd.calls('POST', forwardPath(CAPPOTTO_ID))).toHaveLength(1);
  });

  test('I3 the assignee is not in the family of arrival: the alert is the consequence', async ({
    page,
    context,
  }) => {
    await startForward(page, context);
    const panel = await openForward(page, FOTO);
    await chooseMamma(panel);
    const alert = page.getByRole('alert', { name: IT.warning, exact: true });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(IT.goesToQueue);
    await expect(button(panel, IT.confirmForward)).toBeEnabled();
    await expect(button(panel, IT.confirmForward)).toHaveAccessibleDescription(IT.goesToQueue);
  });

  test('I4 the members of the arrival cannot be read: the consequence says so, confirm works', async ({
    page,
    context,
  }) => {
    await startForward(page, context);
    // Registered after the fake API: it answers first.
    await page.route(`**/api/families/${MAMMA}/members`, (route) =>
      route.fulfill({ status: 500, json: { error: 'internal' } }),
    );
    const panel = await openForward(page, FOTO);
    await chooseMamma(panel);
    await expect(panel.getByText(IT.unknownMembers, { exact: true })).toBeVisible();
    const confirm = button(panel, IT.confirmForward);
    await expect(confirm).toBeEnabled();
    await expect(confirm).toHaveAccessibleDescription(IT.unknownMembers);
  });

  test('I5 a recurring task: the consequence adds that the recurrence stays the same', async ({
    page,
    context,
  }) => {
    await startForward(page, context);
    const panel = await openForward(page, ORTO);
    await chooseMamma(panel);
    await expect(panel.getByText(new RegExp(IT.sameRecurrence.replace('.', '\\.')))).toBeVisible();
    const confirm = button(panel, IT.confirmForward);
    await expect(confirm).toHaveAccessibleDescription(/La ricorrenza resta uguale\./);
    await expect(confirm).toHaveAccessibleDescription(/resta assegnato a Giulia/);
  });

  test('I6 «Annulla», «Chiudi» and Esc send nothing and give the focus back to «Inoltra»', async ({
    page,
    context,
  }) => {
    await startForward(page, context);
    const trigger = button(item(page, REGALO), IT.forward(REGALO));
    for (const how of ['annulla', 'chiudi', 'esc'] as const) {
      const panel = await openForward(page, REGALO);
      await chooseMamma(panel);
      if (how === 'annulla') await press(button(panel, IT.cancelForward));
      else if (how === 'chiudi') await press(button(panel, IT.close));
      else await page.keyboard.press('Escape');
      await expect(dialog(page, IT.forwardDialog), how).toHaveCount(0);
      await expect(trigger, how).toBeFocused();
    }
    await page.waitForTimeout(300);
    expect(fwd.calls('POST', forwardPath(REGALO_ID))).toHaveLength(0);
  });

  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    test(`S1 the forward dialog with its consequence at ${width}×${height}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height });
      await startForward(page, context);
      const panel = await openForward(page, REGALO);
      await chooseMamma(panel);
      await expect(panel.getByText(IT.staysAssigned, { exact: true })).toBeVisible();
      const confirm = button(panel, IT.confirmForward);
      await confirm.scrollIntoViewIfNeeded();
      await expect(confirm).toBeInViewport();
      const box = (await panel.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(await cutTexts(page)).toEqual([]);
      const path = `${SCREENSHOTS}/forward-consequence-${width}.png`;
      await page.screenshot({ path, fullPage: true });
      expect(statSync(join(APP, path)).size).toBeGreaterThan(0);
    });
  }
});

// ------------------------------------------------- cancel and end of series (fake API of 014)

let rec: RecurrenceApi;

async function startRecurrence(page: Page, context: BrowserContext): Promise<void> {
  rec = new RecurrenceApi(page, context);
  rec.now = THURSDAY;
  await rec.install();
  await rec.openSession(GIULIA_014);
  await page.clock.setFixedTime(new Date(THURSDAY));
  await page.goto(`/family?id=${PRINCIPALE_014}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');
  await expect(familyTasks(page)).toBeVisible();
}

const actionPath = (id: string, action: string) =>
  `/api/families/${PRINCIPALE_014}/tasks/${id}/${action}`;

test.describe('giro 050 — cancel and end of the series in the ConfirmDialog (it)', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

  test('C1 «Annulla task» asks in a dialog; «Non annullare» and Esc give the focus back', async ({
    page,
    context,
  }) => {
    await startRecurrence(page, context);
    const pane = item(page, PANE);
    const trigger = button(pane, IT.cancelTask);
    const ask = dialog(page, IT.cancelDialog(PANE));

    await press(trigger);
    await expect(ask).toBeVisible();
    await expect(ask).toHaveAttribute('aria-modal', 'true');
    await expect(ask.getByText(IT.cancelConsequence, { exact: true })).toBeVisible();
    await expect(button(ask, IT.confirmCancel)).toHaveAccessibleDescription(IT.cancelConsequence);
    await expect(button(ask, IT.keep)).toBeFocused();
    // The confirm buttons are no longer in the row; the button that opened the dialog stays.
    const hidden = { exact: true, includeHidden: true };
    await expect(pane.getByRole('button', { name: IT.confirmCancel, ...hidden })).toHaveCount(0);
    await expect(pane.getByRole('button', { name: IT.keep, ...hidden })).toHaveCount(0);
    await expect(pane.getByRole('button', { name: IT.cancelTask, ...hidden })).toHaveCount(1);

    await press(button(ask, IT.keep));
    await expect(ask).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await press(trigger);
    await expect(ask).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(ask).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.waitForTimeout(300);
    expect(rec.calls('POST', actionPath(PANE_ID, 'cancel'))).toHaveLength(0);

    await press(trigger);
    await press(button(ask, IT.confirmCancel));
    await expect(ask).toHaveCount(0);
    await expect(pane.getByText(IT.cancelled, { exact: true })).toBeVisible();
    expect(rec.calls('POST', actionPath(PANE_ID, 'cancel'))).toHaveLength(1);
  });

  test('C2 «Annulla questa volta» asks in a dialog with the consequence for one occurrence', async ({
    page,
    context,
  }) => {
    await startRecurrence(page, context);
    const carta = item(page, CARTA);
    await press(button(carta, IT.cancelOnce));
    const ask = dialog(page, IT.cancelOnceDialog);
    await expect(ask).toBeVisible();
    const consequence = IT.cancelOnceConsequence(CARTA);
    await expect(ask.getByText(consequence, { exact: true })).toBeVisible();
    await expect(button(ask, IT.confirmCancel)).toHaveAccessibleDescription(consequence);
    await expect(button(ask, IT.keep)).toBeFocused();
    expect(rec.calls('POST', actionPath(CARTA_ID, 'cancel'))).toHaveLength(0);
  });

  test('C3 «Termina la serie» asks in a dialog; «Non terminare» gives the focus back; one request', async ({
    page,
    context,
  }) => {
    await startRecurrence(page, context);
    const carta = item(page, CARTA);
    const trigger = button(carta, IT.endSeries);
    const ask = dialog(page, IT.endSeriesDialog(CARTA));

    await press(trigger);
    await expect(ask).toBeVisible();
    await expect(ask.getByText(IT.endSeriesConsequence, { exact: true })).toBeVisible();
    await expect(button(ask, IT.confirmEndSeries)).toHaveAccessibleDescription(
      IT.endSeriesConsequence,
    );
    await expect(button(ask, IT.keepSeries)).toBeFocused();
    const hidden = { exact: true, includeHidden: true };
    await expect(carta.getByRole('button', { name: IT.confirmEndSeries, ...hidden })).toHaveCount(
      0,
    );
    await expect(carta.getByRole('button', { name: IT.endSeries, ...hidden })).toHaveCount(1);

    await press(button(ask, IT.keepSeries));
    await expect(ask).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(rec.calls('POST', actionPath(CARTA_ID, 'end-series'))).toHaveLength(0);

    // A slow answer: the double click must not send two requests.
    await page.route(`**${actionPath(CARTA_ID, 'end-series')}`, async (route) => {
      await new Promise((done) => setTimeout(done, 800));
      await route.fallback();
    });
    await press(trigger);
    const confirm = button(ask, IT.confirmEndSeries);
    await expect(confirm).toBeVisible();
    await confirm.dblclick();
    await expect(carta.getByText(IT.cancelled, { exact: true })).toBeVisible();
    await page.waitForTimeout(500);
    expect(rec.calls('POST', actionPath(CARTA_ID, 'end-series'))).toHaveLength(1);
  });

  test('C4 a cancel lost on the network: dialog closed, the notice, retry with the same mutationId', async ({
    page,
    context,
  }) => {
    await startRecurrence(page, context);
    rec.writeScript.push('abort');
    const pane = item(page, PANE);
    const trigger = button(pane, IT.cancelTask);
    const ask = dialog(page, IT.cancelDialog(PANE));

    await press(trigger);
    await press(button(ask, IT.confirmCancel));
    await expect(ask).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveText(IT.failed);
    await expect(pane.getByText(IT.cancelled, { exact: true })).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await press(trigger);
    await press(button(ask, IT.confirmCancel));
    await expect(ask).toHaveCount(0);
    await expect(pane.getByText(IT.cancelled, { exact: true })).toBeVisible();
    const sent = rec
      .calls('POST', actionPath(PANE_ID, 'cancel'))
      .map((r) => r.postDataJSON() as Record<string, unknown>);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
  });
});

// ------------------------------------------------------------------------------ English

test.describe('giro 050 — the dialogs in English (E1)', () => {
  test.use({ locale: 'en-US', timezoneId: 'Europe/Rome' });

  test('E1 forward: reason and consequence in English', async ({ page, context }) => {
    await startForward(page, context);
    await press(button(item(page, REGALO), `Forward “${REGALO}”`));
    const panel = dialog(page, 'Forward the task');
    await expect(panel).toBeVisible();
    const confirm = button(panel, 'Confirm forward');
    await expect(confirm).toBeDisabled();
    await expect(confirm).toHaveAccessibleDescription('Choose the family of arrival.');
    const group = panel.getByRole('radiogroup', { name: 'Arrival family', exact: true });
    await press(group.getByRole('radio', { name: IT.mamma, exact: true }));
    const consequence = 'The task moves to Famiglia Mamma and stays assigned to Giulia.';
    await expect(panel.getByText(consequence, { exact: true })).toBeVisible();
    await expect(confirm).toHaveAccessibleDescription(consequence);
  });

  test('E1 cancel: the dialog in English', async ({ page, context }) => {
    await startRecurrence(page, context);
    await press(button(item(page, PANE), 'Cancel task'));
    const ask = dialog(page, `Cancel “${PANE}”?`);
    await expect(ask).toBeVisible();
    await expect(button(ask, 'Confirm cancellation')).toBeVisible();
    await expect(button(ask, 'Keep task')).toBeFocused();
  });
});

// ------------------------------------------------------------------------ kit only (S2)

test('S2 ForwardDialog is made of the kit; ConfirmDialog exists without literal colours', () => {
  const source = readFileSync(join(APP, 'src', 'task', 'ForwardDialog.tsx'), 'utf8');
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
  const kit = join(APP, 'src', 'ui', 'ConfirmDialog.tsx');
  expect(existsSync(kit), 'ConfirmDialog.tsx').toBe(true);
  expect(readFileSync(kit, 'utf8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(source).toMatch(/ConfirmDialog/);
});
