import { defineConfig, devices } from '@playwright/test';

// The web bundle is exported beforehand (`npx expo export --platform web`) and served from dist.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://localhost:8081' },
  webServer: {
    command: 'npx expo serve --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
