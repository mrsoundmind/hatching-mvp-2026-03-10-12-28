import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially within files for stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: 'line',
  timeout: 60000, // 60s per test
  expect: {
    timeout: 15000, // 15s for expect assertions
  },
  use: {
    baseURL: 'http://localhost:5001',
    trace: 'on-first-retry',
    actionTimeout: 15000, // 15s for clicks, fills, etc.
    navigationTimeout: 30000, // 30s for page.goto
  },
  projects: [
    // Auth setup — runs first, saves session cookies + creates test project
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      timeout: 60000,
    },
    // Public pages — no auth needed, lightweight
    {
      name: 'public',
      testMatch: /public-.+\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Lightweight authenticated tests — no AI calls, run first for max pass count
    {
      name: 'chromium-light',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/session.json',
      },
      dependencies: ['setup'],
      testMatch: [
        /app-layout\.spec\.ts/,
        /right-sidebar\.spec\.ts/,
        /accessibility-visual\.spec\.ts/,
        /deliverables\.spec\.ts/,
        /modals-onboarding\.spec\.ts/,
        /chat-redesign\.spec\.ts/,
        /v3-local-gap-audit\.spec\.ts/,
        /stop-button\.spec\.ts/,
      ],
    },
    // AI-heavy authenticated tests — send messages, wait for LLM responses
    {
      name: 'chromium-ai',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/session.json',
      },
      dependencies: ['setup'],
      testMatch: [
        /chat-system\.spec\.ts/,
        /persona-.+\.spec\.ts/,
        /goal-runner\.spec\.ts/,
        /maya-fallback\.spec\.ts/,
      ],
      timeout: 120000, // 2 min per test for AI-heavy tests
    },
    // Phase 35 production hotfix smoke — LEGAL-01 + LLMUX-02/03 + AUDIT-01.
    // Needs authenticated session for cases 3-4 (ensureAppLoaded → chat page).
    // Cases 3-4 exercise the WS round-trip path so we give it the same 2-min
    // budget as chromium-ai. Cases 1a-2c are fast page loads.
    {
      name: 'phase-35',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/session.json',
      },
      dependencies: ['setup'],
      testMatch: /phase-35-production-hotfix\.spec\.ts/,
      timeout: 120000,
    },
    // Mobile viewport — authenticated
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        storageState: 'tests/e2e/.auth/session.json',
      },
      dependencies: ['setup'],
      testMatch: /mobile-.+\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5001',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
