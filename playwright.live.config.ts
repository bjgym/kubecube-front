import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 180_000,
  expect: { timeout: 60_000 },
  reporter: 'list',
  use: {
    baseURL: process.env.KUBECUBE_LIVE_BASE_URL || 'http://127.0.0.1:4331',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
