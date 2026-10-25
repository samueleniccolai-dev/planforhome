import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import {
  AFFITTO,
  AFFITTO_ID,
  CANE,
  CANE_ID,
  CANE_NEXT_ID,
  CARTA,
  CARTA_ID,
  CSRF,
  FakeApi,
  FRIGO,
  FRIGO_ID,
  GATTO,
  GIULIA,
  MAMMA,
  MONDAY,
  PANE,
  PIANTE,
  PRINCIPALE,
  THURSDAY,
  UUID_V7,
  ZIO,
} from './giro-014-fake-api';

// Round 014, T6 part 2 (app side): recurring tasks in the family screen. The form «Add task» gets a
// due date, an optional time and the group «Repeats»; a recurring task shows its rule and its next
// due; «Cancel this time» and «End the series» act on it. The server decides permissions (403) and
// creates the next occurrence: the screen reloads the tasks of the family after done, cancel and
// end-series of a recurring task. Elements are found by role and accessible name. The options of
// «Repeats» are radios (role radio, aria-checked); if react-native-web does not give the role, a
// button with aria-pressed is accepted (the fallback of the plan). The clock of the browser and
// the clock of the fake server are fixed at the same instant. Round 049 (decision 138): the form
// lives in the dialog «Nuovo task» opened by the button of the same name; «Scadenza» is a date field
// (`yyyy-mm-dd` on the web); after a creation the dialog closes and, reopened, the form is empty.
// Round 050 (decision 138): «Annulla questa volta» and «Termina la serie» open a confirmation
// dialog; «Conferma annullamento», «Conferma: termina la serie» and «Non terminare» live there.

const SCREENSHOTS = 'e2e-screenshots';

const IT = {
  newTitle: 'Titolo',
  add: 'Aggiungi task',
  newTask: 'Nuovo task',
  familyTasks: 'Task della famiglia',
  dueInput: 'Scadenza',
  timeInput: 'Ora (hh:mm, facoltativa)',
  repeats: 'Si ripete',
  never: 'Mai',
  daily: 'Ogni giorno',
  everyN: 'Ogni N giorni',
  weekly: 'Ogni settimana',
  monthly: 'Ogni mese',
  interval: 'Ogni quanti giorni',
  dayOfMonth: 'Giorno del mese',
  tuesday: 'Martedì',
  friday: 'Venerdì',
  markDone: (title: string) => `Fatto: ${title}`,
  cancelTask: 'Annulla task',
  cancelOnce: 'Annulla questa volta',
  confirmCancel: 'Conferma annullamento',
  endSeries: 'Termina la serie',
  confirmEndSeries: 'Conferma: termina la serie',
  keepSeries: 'Non terminare',
  done: 'Fatto',
  cancelled: 'Annullato',
  queue: 'In coda',
  forbidden: 'Non hai il permesso di farlo.',
  failed: 'Qualcosa non ha funzionato. Riprova.',
  needsDue: 'Un task ciclico ha bisogno di una scadenza.',
  invalid: 'Controlla scadenza e ricorrenza.',
};

function familyTasks(page: Page): Locator {
  return page.getByRole('region', { name: IT.familyTasks, exact: true });
}

/** The list items of one title (a series can have more than one). */
function items(page: Page, title: string): Locator {
  return familyTasks(page)
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) });
}

/** The occurrence of {@code title} that shows {@code text} (for example its due). */
function occurrence(page: Page, title: string, text: string): Locator {
  return items(page, title).filter({ has: page.getByText(text, { exact: true }) });
}

function button(scope: Locator | Page, name: string): Locator {
  return scope.getByRole('button', { name, exact: true });
}

/** Round 047: «Mark done» is the checkbox «Fatto: {title}» of the card. */
function doneBox(scope: Locator, title: string): Locator {
  return scope.getByRole('checkbox', { name: IT.markDone(title), exact: true });
}

function text(scope: Locator | Page, value: string): Locator {
  return scope.getByText(value, { exact: true });
}

function field(page: Page, name: string): Locator {
  return page.getByRole('textbox', { name, exact: true });
}

/** A choice of «Repeats»: a radio, or (fallback of the plan) a button with aria-pressed. */
function choice(page: Page, name: string): Locator {
  return page
    .getByRole('radio', { name, exact: true })
    .or(page.getByRole('button', { name, exact: true }));
}

/** A day of «Every week»: a checkbox, or (fallback) a button with aria-pressed. */
function day(page: Page, name: string): Locator {
  return page
    .getByRole('checkbox', { name, exact: true })
    .or(page.getByRole('button', { name, exact: true }));
}

/** Round 050: the confirmation dialog of cancel once / end of the series. */
function confirmation(page: Page, name: string): Locator {
  return page.getByRole('dialog', { name, exact: true });
}

const cancelOnceDialog = 'Annullare questa volta?';
const endSeriesDialog = (title: string) => `Terminare la serie «${title}»?`;

function sheet(page: Page, name = IT.newTask): Locator {
  return page.getByRole('dialog', { name, exact: true });
}

/** Round 049: opens the dialog «Nuovo task» unless it is already open. */
async function openSheet(page: Page, name = IT.newTask): Promise<void> {
  if (await sheet(page, name).isVisible()) return;
  await press(button(page, name));
  await expect(sheet(page, name)).toBeVisible();
}

async function expectSelected(target: Locator, selected: boolean): Promise<void> {
  await expect(target).toBeVisible();
  await expect
    .poll(() =>
      target.evaluate((el) => el.getAttribute('aria-checked') ?? el.getAttribute('aria-pressed')),
    )
    .toBe(String(selected));
}

/** Clicks once the control is there: a missing control fails as an assertion. */
async function press(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  await target.click();
}

async function fill(target: Locator, value: string): Promise<void> {
  await expect(target).toBeVisible();
  await target.fill(value);
}

const tasksPath = (familyId: string) => `/api/families/${familyId}/tasks`;
const actionPath = (familyId: string, id: string, action: string) =>
  `${tasksPath(familyId)}/${id}/${action}`;

let api: FakeApi;

async function start(page: Page, context: BrowserContext, now: string): Promise<void> {
  api = new FakeApi(page, context);
  api.now = now;
  await api.install();
  await api.openSession(GIULIA);
  await page.clock.setFixedTime(new Date(now));
}

async function openFamily(page: Page, familyId: string, name: string): Promise<void> {
  await page.goto(`/family?id=${familyId}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.getByRole('heading', { level: 2, name: 'Task', exact: true })).toBeVisible();
  // Marks the page: a reload of the page would lose it.
  await page.evaluate(() => {
    (window as unknown as { giro014: boolean }).giro014 = true;
  });
}

async function notReloaded(page: Page): Promise<void> {
  expect(await page.evaluate(() => (window as unknown as { giro014?: boolean }).giro014)).toBe(
    true,
  );
}

type Body = Record<string, unknown>;

function posts(familyId: string): Body[] {
  return api.calls('POST', tasksPath(familyId)).map((r) => r.postDataJSON() as Body);
}

/** Title, due, rule, «Add task»: the fields of the form, as a person fills them. */
async function create(
  page: Page,
  title: string,
  due: string,
  time: string | undefined,
  rule: () => Promise<void>,
): Promise<void> {
  await openSheet(page);
  await fill(field(page, IT.newTitle), title);
  await fill(field(page, IT.dueInput), due);
  if (time !== undefined) await fill(field(page, IT.timeInput), time);
  await rule();
  await press(button(page, IT.add));
}

test.describe('device language it-IT', () => {
  test.use({ locale: 'it-IT', timezoneId: 'Asia/Tokyo' });

  test('A1 — every kind of rule is created with a DATE due, days in order Monday → Sunday', async ({
    page,
    context,
  }) => {
    await start(page, context, MONDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    // Round 049: the form lives in the dialog «Nuovo task»; open it before reading the rule.
    await openSheet(page);
    await expect(page.getByRole('radiogroup', { name: IT.repeats, exact: true })).toBeVisible();
    await expectSelected(choice(page, IT.never), true);

    const cases: {
      title: string;
      due: string;
      rule: () => Promise<void>;
      sent: Body;
      shown: string;
    }[] = [
      {
        title: 'Portare fuori il cane la sera',
        due: '2031-01-07',
        rule: () => press(choice(page, IT.daily)),
        sent: { dueKind: 'DATE', due: '2031-01-07', recurrence: { type: 'DAILY' } },
        shown: 'Si ripete: ogni giorno',
      },
      {
        title: 'Annaffiare il basilico',
        due: '2031-01-07',
        rule: async () => {
          await press(choice(page, IT.everyN));
          await fill(field(page, IT.interval), '3');
        },
        sent: {
          dueKind: 'DATE',
          due: '2031-01-07',
          recurrence: { type: 'EVERY_N_DAYS', interval: 3 },
        },
        shown: 'Si ripete: ogni 3 giorni',
      },
      {
        title: 'Pulire il bagno',
        due: '2031-01-07',
        rule: async () => {
          await press(choice(page, IT.weekly));
          // Friday first: the rule still lists Tuesday first.
          await press(day(page, IT.friday));
          await press(day(page, IT.tuesday));
          await expectSelected(day(page, IT.tuesday), true);
          await expectSelected(day(page, 'Lunedì'), false);
        },
        sent: {
          dueKind: 'DATE',
          due: '2031-01-07',
          recurrence: { type: 'WEEKLY', days: ['TUESDAY', 'FRIDAY'] },
        },
        shown: 'Si ripete: ogni martedì, venerdì',
      },
      {
        title: 'Pagare il condominio',
        due: '2031-01-31',
        rule: async () => {
          await press(choice(page, IT.monthly));
          await fill(field(page, IT.dayOfMonth), '31');
        },
        sent: {
          dueKind: 'DATE',
          due: '2031-01-31',
          recurrence: { type: 'MONTHLY', dayOfMonth: 31 },
        },
        shown: 'Si ripete: ogni mese il giorno 31',
      },
    ];

    for (const [i, c] of cases.entries()) {
      await create(page, c.title, c.due, undefined, c.rule);
      const item = items(page, c.title);
      await expect(text(item, c.shown)).toBeVisible();

      const sent = posts(PRINCIPALE);
      expect(sent).toHaveLength(i + 1);
      const body = sent[i];
      expect(body).toMatchObject({ title: c.title, ...c.sent });
      expect(body.recurrence).toEqual(c.sent.recurrence);
      expect(body.id).toMatch(UUID_V7);
      expect(body.mutationId).toMatch(UUID_V7);
      expect(api.calls('POST', tasksPath(PRINCIPALE))[i].headers()['x-csrf-token']).toBe(CSRF);

      // After the 201 the dialog closes; reopened, the form is empty again, on «Never».
      await expect(sheet(page)).toHaveCount(0);
      await openSheet(page);
      await expect(field(page, IT.newTitle)).toHaveValue('');
      await expect(field(page, IT.dueInput)).toHaveValue('');
      await expectSelected(choice(page, IT.never), true);
    }
    await page.screenshot({ path: `${SCREENSHOTS}/recurrence-created-it.png`, fullPage: true });
  });

  test('A2 — a DATETIME due is the local time in the zone of the family, not of the device', async ({
    page,
    context,
  }) => {
    await start(page, context, MONDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    await create(page, 'Dare la medicina al cane', '2031-03-29', '07:00', () =>
      press(choice(page, IT.daily)),
    );
    await expect(
      text(items(page, 'Dare la medicina al cane'), 'Si ripete: ogni giorno'),
    ).toBeVisible();
    const rome = posts(PRINCIPALE)[0];
    expect(rome.dueKind).toBe('DATETIME');
    expect(new Date(rome.due as string).toISOString()).toBe('2031-03-29T06:00:00.000Z');
    expect(rome.recurrence).toEqual({ type: 'DAILY' });

    // Famiglia Zio (America/New_York) has no tasks: the zone comes from the family itself.
    await openFamily(page, ZIO, 'Famiglia Zio');
    await create(page, 'Chiamare la nonna', '2031-03-08', '07:00', () =>
      press(choice(page, IT.daily)),
    );
    await expect(text(items(page, 'Chiamare la nonna'), 'Si ripete: ogni giorno')).toBeVisible();
    const newYork = posts(ZIO)[0];
    expect(newYork.dueKind).toBe('DATETIME');
    expect(new Date(newYork.due as string).toISOString()).toBe('2031-03-08T12:00:00.000Z');
    expect(newYork.recurrence).toEqual({ type: 'DAILY' });
  });

  test('A3 — a rule without a due, or a wrong value, sends nothing', async ({ page, context }) => {
    await start(page, context, MONDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');

    await openSheet(page);
    await fill(field(page, IT.newTitle), 'Svuotare la lavastoviglie');
    await press(choice(page, IT.daily));
    await press(button(page, IT.add));
    await expect(page.getByRole('alert')).toHaveText(IT.needsDue);

    await fill(field(page, IT.dueInput), '2031-01-07');
    await press(choice(page, IT.everyN));
    await fill(field(page, IT.interval), '1');
    await press(button(page, IT.add));
    await expect(page.getByRole('alert')).toHaveText(IT.invalid);

    // Round 049: the date field cannot hold 31/02 any more; an impossible time is still wrong.
    await press(choice(page, IT.never));
    await fill(field(page, IT.timeInput), '24:99');
    await press(button(page, IT.add));
    await expect(page.getByRole('alert')).toHaveText(IT.invalid);

    await page.waitForTimeout(300);
    expect(posts(PRINCIPALE)).toHaveLength(0);
  });

  test('A4 — the rule and «Next» follow the clock and the zone of the family', async ({
    page,
    context,
  }) => {
    await start(page, context, THURSDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');

    const carta = items(page, CARTA);
    await expect(text(carta, 'Si ripete: ogni martedì')).toBeVisible();
    await expect(text(carta, 'Prossima: 14/01/2031')).toBeVisible();
    const affitto = items(page, AFFITTO);
    await expect(text(affitto, 'Si ripete: ogni mese il giorno 31')).toBeVisible();
    await expect(text(affitto, 'Prossima: 28/02/2031')).toBeVisible();
    const piante = items(page, PIANTE);
    await expect(text(piante, 'Si ripete: ogni 3 giorni')).toBeVisible();
    await expect(text(piante, 'Prossima: 10/01/2031')).toBeVisible();
  });

  test('A4 — «Next» of a DATETIME series keeps the local time of the rule', async ({
    page,
    context,
  }) => {
    await start(page, context, '2031-03-29T05:00:00Z');
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    const gatto = items(page, GATTO);
    await expect(text(gatto, 'Si ripete: ogni giorno')).toBeVisible();
    await expect(text(gatto, 'Prossima: 30/03/2031 07:00')).toBeVisible();
  });

  test('A5 — «Mark done» on the paper: the next one appears without reloading the page', async ({
    page,
    context,
  }) => {
    await start(page, context, THURSDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    const first = occurrence(page, CARTA, 'Scadenza: 07/01/2031');

    await press(doneBox(first, CARTA));

    await expect(text(first, IT.done)).toBeVisible();
    const next = occurrence(page, CARTA, 'Scadenza: 14/01/2031');
    await expect(next).toHaveCount(1);
    await expect(text(next, 'Assegnato a Marco')).toBeVisible();
    await expect(doneBox(next, CARTA)).toBeVisible();
    await expect(items(page, CARTA)).toHaveCount(2);
    await notReloaded(page);
    expect(api.calls('POST', actionPath(PRINCIPALE, CARTA_ID, 'done'))).toHaveLength(1);
    await page.screenshot({ path: `${SCREENSHOTS}/recurrence-next-it.png`, fullPage: true });
  });

  test('A6 — «Cancel this time» on the rent: confirmation, then the next one in the queue', async ({
    page,
    context,
  }) => {
    await start(page, context, THURSDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    const first = occurrence(page, AFFITTO, 'Scadenza: 31/01/2031');
    await expect(button(first, IT.cancelTask)).toHaveCount(0);

    await press(button(first, IT.cancelOnce));
    expect(api.calls('POST', actionPath(PRINCIPALE, AFFITTO_ID, 'cancel'))).toHaveLength(0);
    await press(button(confirmation(page, cancelOnceDialog), IT.confirmCancel));

    await expect(text(first, IT.cancelled)).toBeVisible();
    const next = occurrence(page, AFFITTO, 'Scadenza: 28/02/2031');
    await expect(next).toHaveCount(1);
    await expect(text(next, IT.queue)).toBeVisible();
    await expect(button(next, IT.cancelOnce)).toBeVisible();
    await notReloaded(page);
    const cancel = api.calls('POST', actionPath(PRINCIPALE, AFFITTO_ID, 'cancel'));
    expect(cancel).toHaveLength(1);
    expect(Object.keys(cancel[0].postDataJSON() as object)).toEqual(['mutationId']);
  });

  test('A7 — Giulia (manager) ends the series of the paper: no new occurrence', async ({
    page,
    context,
  }) => {
    await start(page, context, THURSDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    const carta = items(page, CARTA);

    await press(button(carta, IT.endSeries));
    const ask = confirmation(page, endSeriesDialog(CARTA));
    await expect(button(ask, IT.keepSeries)).toBeVisible();
    expect(api.calls('POST', actionPath(PRINCIPALE, CARTA_ID, 'end-series'))).toHaveLength(0);
    await press(button(ask, IT.confirmEndSeries));

    await expect(text(carta, IT.cancelled)).toBeVisible();
    await expect(carta).toHaveCount(1);
    await expect(carta.getByRole('button')).toHaveCount(0);
    await expect(carta.getByRole('checkbox')).toHaveCount(0);
    const ended = api.calls('POST', actionPath(PRINCIPALE, CARTA_ID, 'end-series'));
    expect(ended).toHaveLength(1);
    const body = ended[0].postDataJSON() as Body;
    expect(Object.keys(body)).toEqual(['mutationId']);
    expect(body.mutationId).toMatch(UUID_V7);
    expect(ended[0].headers()['x-csrf-token']).toBe(CSRF);
  });

  test('A7 — ending a reopened occurrence also cancels the next one, without reloading', async ({
    page,
    context,
  }) => {
    await start(page, context, THURSDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    const reopened = occurrence(page, CANE, 'Scadenza: 07/01/2031');
    const next = occurrence(page, CANE, 'Scadenza: 08/01/2031');
    await expect(doneBox(next, CANE)).toBeVisible();

    await press(button(reopened, IT.endSeries));
    await press(button(confirmation(page, endSeriesDialog(CANE)), IT.confirmEndSeries));

    await expect(text(reopened, IT.cancelled)).toBeVisible();
    await expect(text(next, IT.cancelled)).toBeVisible();
    // Round 047: «Mark done» is the checkbox, absent on a cancelled task.
    await expect(doneBox(next, CANE)).toHaveCount(0);
    await expect(items(page, CANE)).toHaveCount(2);
    await notReloaded(page);
    expect(api.calls('POST', actionPath(PRINCIPALE, CANE_ID, 'end-series'))).toHaveLength(1);
    expect(api.calls('POST', actionPath(PRINCIPALE, CANE_NEXT_ID, 'end-series'))).toHaveLength(0);
  });

  test('A8 — a member cannot end the series of Anna: the message, the fridge stays open', async ({
    page,
    context,
  }) => {
    await start(page, context, THURSDAY);
    await openFamily(page, MAMMA, 'Famiglia Mamma');
    const frigo = items(page, FRIGO);
    const path = actionPath(MAMMA, FRIGO_ID, 'end-series');

    const ask = confirmation(page, endSeriesDialog(FRIGO));
    await press(button(frigo, IT.endSeries));
    await press(button(ask, IT.keepSeries));
    await expect(ask).toHaveCount(0);
    await expect(button(page, IT.confirmEndSeries)).toHaveCount(0);
    await expect(doneBox(frigo, FRIGO)).toBeVisible();
    await page.waitForTimeout(300);
    expect(api.calls('POST', path)).toHaveLength(0);

    await press(button(frigo, IT.endSeries));
    await press(button(ask, IT.confirmEndSeries));
    await expect(ask).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveText(IT.forbidden);
    await expect(doneBox(frigo, FRIGO)).toBeVisible();
    await expect(text(frigo, IT.cancelled)).toHaveCount(0);
    expect(api.calls('POST', path)).toHaveLength(1);
  });

  test('A9 — a task that does not repeat stays as it was', async ({ page, context }) => {
    await start(page, context, THURSDAY);
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    const pane = items(page, PANE);
    await expect(doneBox(pane, PANE)).toBeVisible();
    await expect(button(pane, IT.cancelTask)).toBeVisible();
    await expect(button(pane, IT.endSeries)).toHaveCount(0);
    await expect(button(pane, IT.cancelOnce)).toHaveCount(0);
    await expect(pane.getByText(/^Si ripete/)).toHaveCount(0);
    await expect(pane.getByText(/^Prossima/)).toHaveCount(0);
    // A recurring task in the same list does show the rule (the screen is the new one).
    await expect(text(items(page, CARTA), 'Si ripete: ogni martedì')).toBeVisible();
  });

  test('A10 — a creation lost on the network: same data, same ids; new rule, new ids', async ({
    page,
    context,
  }) => {
    await start(page, context, MONDAY);
    api.createScript.push('abort', 'abort');
    await openFamily(page, PRINCIPALE, 'Famiglia Principale');
    const title = 'Portare giù il vetro';

    await create(page, title, '2031-01-07', undefined, () => press(choice(page, IT.daily)));
    await expect(page.getByRole('alert')).toHaveText(IT.failed);
    await press(button(page, IT.add));
    await expect.poll(() => posts(PRINCIPALE).length).toBe(2);
    await expect(page.getByRole('alert')).toHaveText(IT.failed);

    // Same title, another rule: it is another task, not a replay of the lost one.
    await press(choice(page, IT.weekly));
    await press(day(page, IT.tuesday));
    await press(button(page, IT.add));
    await expect(text(items(page, title), 'Si ripete: ogni martedì')).toBeVisible();

    const sent = posts(PRINCIPALE);
    expect(sent).toHaveLength(3);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[2].recurrence).toEqual({ type: 'WEEKLY', days: ['TUESDAY'] });
    expect(sent[2].mutationId).not.toBe(sent[0].mutationId);
    expect(sent[2].id).not.toBe(sent[0].id);
  });
});

test.describe('device language en-US', () => {
  test.use({ locale: 'en-US', timezoneId: 'Asia/Tokyo' });

  test('A9 — the texts in English', async ({ page, context }) => {
    await start(page, context, THURSDAY);
    await page.goto(`/family?id=${PRINCIPALE}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Famiglia Principale');

    const carta = page
      .getByRole('region', { name: 'Family tasks', exact: true })
      .getByRole('listitem')
      .filter({ has: page.getByText(CARTA, { exact: true }) });
    await expect(text(carta, 'Repeats: every Tuesday')).toBeVisible();
    await expect(text(carta, 'Next: 14/01/2031')).toBeVisible();
    await expect(button(carta, 'Cancel this time')).toBeVisible();
    await expect(button(carta, 'End the series')).toBeVisible();
    await openSheet(page, 'New task');
    await expect(page.getByRole('radiogroup', { name: 'Repeats', exact: true })).toBeVisible();
    await expect(field(page, 'Due date')).toBeVisible();
    await expect(field(page, 'Time (hh:mm, optional)')).toBeVisible();
    await expect(choice(page, 'Every week')).toBeVisible();
  });
});
