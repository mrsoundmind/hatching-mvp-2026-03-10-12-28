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
        /resilience\.spec\.ts/,
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
    // Phase 36 frozen-rubric deliverable iteration smoke —
    // RUBR-02 (auto-revert), RUBR-04 (breakdown), FBK-03 (impressionCount), FBK-04 (verified via unit test).
    // Cases 2-3 drive the iterate path which calls into Groq judge (forced via /api/dev/force-judge-score
    // so deterministic). Case 4 has an explicit 6s sleep to walk past the impression dedupe window.
    // Same 2-min budget as phase-35 — sufficient headroom for the slowest case (case 4).
    {
      name: 'phase-36',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/session.json',
      },
      dependencies: ['setup'],
      testMatch: /phase-36-rubric-iteration\.spec\.ts/,
      timeout: 120000,
    },
    // Phase 37 git-style run tree smoke —
    // TREE-03 (tree visualization), TREE-04 (click → deliverable version, W-4),
    // TREE-05 (backfill marker surfaced in UI). Uses 3 DEV-only endpoints
    // (/api/dev/seed-run-tree, /api/dev/reset-run-tree, /api/dev/mark-flat-historical)
    // to build deterministic tree state. Per saved memory rule feedback_verify_in_runtime,
    // the spec runs on a LIVE FRESHLY-RESTARTED dev server. 2-min budget mirrors phase-36.
    {
      name: 'phase-37',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/session.json',
      },
      dependencies: ['setup'],
      testMatch: /phase-37-run-tree\.spec\.ts/,
      timeout: 120000,
    },
    // Phase 38 "Never Stop, Never Ask" autonomy prompt —
    // ALWY-01 (prompt change reaches wire), ALWY-02 (no clarification at level 4 —
    // via captured-prompt assertions), ALWY-03 (snapshot-at-task-boundary).
    // Uses 3 DEV-only endpoints (/api/dev/set-autonomy-level, /api/dev/captured-prompts,
    // /api/dev/clear-captured-prompts) and a "capture" LLM provider that records the
    // assembled wire-level prompt onto a module-scope in-memory buffer.
    // Per saved memory rule feedback_verify_in_runtime, the spec runs against a
    // LIVE FRESHLY-RESTARTED dev server. Run order:
    //   1. Ctrl-C any running dev server
    //   2. LLM_MODE=test TEST_LLM_PROVIDER=capture npm run dev
    //   3. npx playwright test --project=phase-38
    // 2-min budget mirrors phase-37.
    {
      name: 'phase-38',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/session.json',
      },
      dependencies: ['setup'],
      testMatch: /phase-38-never-stop-never-ask\.spec\.ts/,
      timeout: 120000,
    },
    // Agent-action probe — diagnostic, not a regression gate. Records whether
    // imperative chat commands trigger real DB side effects or just clarifying Qs.
    {
      name: 'agent-probe',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/session.json',
      },
      dependencies: ['setup'],
      testMatch: /agent-action-probe\.spec\.ts/,
      timeout: 240000,
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
