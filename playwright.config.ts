import type { PlaywrightTestConfig } from '@playwright/test'
import { devices } from '@playwright/test'

try {
  process.loadEnvFile()
} catch {
  // .env file is optional
}

const isInCi = !!process.env.CI
const port = process.env.APP_SERVICE_PORT ?? '9090'
const baseURL = `http://localhost:${port}`

const config: PlaywrightTestConfig = {
  forbidOnly: isInCi,
  testDir: 'e2e',
  fullyParallel: true,
  retries: isInCi ? 2 : 0,
  reporter: isInCi ? 'github' : 'line',
  timeout: 60 * 60 * 1000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      threshold: 0.3,
    },
  },
  use: {
    trace: 'on-first-retry',
    baseURL,
  },
  webServer: {
    command: 'yarn start:service',
    url: baseURL,
    reuseExistingServer: !isInCi,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
}
export default config
