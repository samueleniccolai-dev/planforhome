import { expect, test } from '@playwright/test';

// Round 000, T2: the initial page of the static web export in the language of the device.
// Elements are found by role and accessible name; the texts are the ones decided in the plan.

// Relative to app/, where Playwright runs; the CI uploads this folder.
const SCREENSHOTS = 'e2e-screenshots';

const cases = [
  {
    locale: 'it-IT',
    title: 'Benvenuto in planforhome',
    subtitle: 'Le cose da fare di tutte le tue famiglie, in un posto solo.',
    screenshot: 'home-it.png',
  },
  {
    locale: 'en-US',
    title: 'Welcome to planforhome',
    subtitle: 'The to-dos of all your families, in one place.',
    screenshot: 'home-en.png',
  },
  {
    locale: 'fr-FR',
    title: 'Welcome to planforhome',
    subtitle: 'The to-dos of all your families, in one place.',
    screenshot: null,
  },
];

for (const c of cases) {
  test.describe(`device language ${c.locale}`, () => {
    test.use({ locale: c.locale });

    test(`the home page greets in ${c.title.startsWith('Benvenuto') ? 'Italian' : 'English'}`, async ({
      page,
    }) => {
      const response = await page.goto('/');
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle('planforhome');

      // The prerendered HTML is hydrated in the device language: wait for the final text.
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveCount(1);
      await expect(heading).toHaveText(c.title);
      await expect(page.getByText(c.subtitle, { exact: true })).toBeVisible();

      if (c.screenshot) {
        await page.screenshot({ path: `${SCREENSHOTS}/${c.screenshot}`, fullPage: true });
      }
    });
  });
}
