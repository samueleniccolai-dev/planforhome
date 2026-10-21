import { expect, test, type Route } from '@playwright/test';

import {
  FakeApi,
  GIULIA,
  LISTA,
  LISTA_ID,
  MONDAY,
  PRINCIPALE,
} from './acceptance/giro-019-fake-api';

// Round 020 review: when the second reorder fails, the list goes back to the order the server
// already accepted with the first one, not to the one before it.

test.use({ locale: 'it-IT', timezoneId: 'Europe/Rome' });

test('a failed second reorder goes back to the first accepted order', async ({ page, context }) => {
  const api = new FakeApi(page, context);
  await api.install();
  await api.openSession(GIULIA);
  await page.clock.setFixedTime(new Date(MONDAY));
  let calls = 0;
  await page.route('**/api/families/*/tasks/*/items/order', async (route: Route) => {
    calls += 1;
    if (calls === 1) {
      await new Promise((done) => setTimeout(done, 700));
      await route.fallback();
    } else {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    }
  });
  await page.goto(`/list?family=${PRINCIPALE}&task=${LISTA_ID}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(LISTA);

  const items = page.getByRole('list', { name: 'Da prendere', exact: true }).getByRole('listitem');
  const down = page.getByRole('button', { name: 'Sposta giù «Latte»', exact: true });
  await down.click();
  await down.click();
  await expect(items).toHaveText([/Pane/, /Mele/, /Latte/, /Biscotti/]);

  await expect(
    page.getByRole('alert').filter({ hasText: 'Qualcosa non ha funzionato' }),
  ).toBeVisible({
    timeout: 5000,
  });
  await expect(items).toHaveText([/Pane/, /Latte/, /Mele/, /Biscotti/]);
});
