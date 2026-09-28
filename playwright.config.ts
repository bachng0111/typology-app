import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Use a pre-installed Chromium when available (e.g. sandboxed CI images).
const localChromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1400, height: 900 },
        launchOptions: existsSync(localChromium) ? { executablePath: localChromium } : {},
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
