import { defineConfig, devices } from '@playwright/test'
import { loadTestEnv } from './tests/config/test-environment'

// Use existing test environment system
const testEnv = loadTestEnv({ mode: 'integration' })

export default defineConfig({
  testDir: './tests/e2e-browser',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // Keep it simple, avoid flakiness
  
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',  // Save videos on CI failures
    trace: 'on-first-retry',     // Debug info for failed tests
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: process.env.CI ? 'npm run build && npm start' : 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      E2E_TEST: '1', // Critical: Mark as E2E test for proper storage selection
      PLAYWRIGHT_TEST: '1',
    },
  },
})