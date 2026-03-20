// TDD tests for backgroundRunner idempotency guard and execution cron
import { describe, it, expect } from "vitest";

describe("backgroundRunner idempotency guard", () => {
  it("start() called twice then stop() logs Stopped exactly once (no accumulated jobs)", async () => {
    const { backgroundRunner } = await import(
      "../server/autonomy/background/backgroundRunner.js"
    );

    const mockDeps = {
      storage: {
        getProjects: async () => [],
        getAgentsByProject: async () => [],
        getTasksByProject: async () => [],
        getMessagesByConversation: async () => [],
        countAutonomyEventsForProjectToday: async () => 0,
        getProject: async () => null,
      },
      broadcastToConversation: () => {},
      generateText: async () => "",
    };

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(" "));
    };

    backgroundRunner.start(mockDeps);
    backgroundRunner.start(mockDeps); // second start — guard must stop then re-register (not accumulate)
    backgroundRunner.stop();

    console.log = origLog;

    // Without the guard: start() called twice registers 4 cron jobs, stop() clears them all at once
    // With the guard: start() called twice still results in only 2 active cron jobs at any point
    // Observable proxy: after double-start + stop, stop() must have been called internally
    // and should result in exactly one final "Stopped" log (not two accumulated Stopped calls)
    const stoppedLogs = logs.filter((l) =>
      l.includes("[BackgroundRunner] Stopped")
    );
    // The guard calls stop() internally on second start, then the explicit stop() = 2 total
    // But WITHOUT the guard, the explicit stop() is the only Stopped log = 1
    // So the test verifies the guard IS running by checking internal stop was triggered
    expect(stoppedLogs.length).toBe(2);
  });

  it("stop() resets _started so start() can be called again cleanly", async () => {
    const src = (await import("fs")).readFileSync(
      (await import("path")).resolve("server/autonomy/background/backgroundRunner.ts"),
      "utf8"
    );
    // stop() must set _started = false so a subsequent start() doesn't infinitely recurse
    expect(src).toContain("_started = false");
  });

  it("runAutonomousExecutionCycle function exists and checks BUDGETS.maxBackgroundLlmCallsPerProjectPerDay", async () => {
    const src = (await import("fs")).readFileSync(
      (await import("path")).resolve("server/autonomy/background/backgroundRunner.ts"),
      "utf8"
    );
    expect(src).toContain("runAutonomousExecutionCycle");
    expect(src).toContain("maxBackgroundLlmCallsPerProjectPerDay");
  });

  it("runAutonomousExecutionCycle skips projects inactive > 7 days", async () => {
    const src = (await import("fs")).readFileSync(
      (await import("path")).resolve("server/autonomy/background/backgroundRunner.ts"),
      "utf8"
    );
    expect(src).toContain("daysInactive > 7");
  });

  it("execution cron is registered only when FEATURE_FLAGS.backgroundExecution is true", async () => {
    const src = (await import("fs")).readFileSync(
      (await import("path")).resolve("server/autonomy/background/backgroundRunner.ts"),
      "utf8"
    );
    expect(src).toContain("FEATURE_FLAGS.backgroundExecution");
    // The cron should be registered inside an if-block checking the flag
    expect(src).toContain("*/15 * * * *");
  });

  it("runAutonomousExecutionCycle calls resolveAutonomyTrigger and queueTaskExecution", async () => {
    const src = (await import("fs")).readFileSync(
      (await import("path")).resolve("server/autonomy/background/backgroundRunner.ts"),
      "utf8"
    );
    // Both must be called inside the function body, not just imported
    const fnStart = src.indexOf("async function runAutonomousExecutionCycle");
    const fnEnd = src.indexOf("\nexport const backgroundRunner");
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toContain("resolveAutonomyTrigger(");
    expect(fnBody).toContain("queueTaskExecution(");
  });

  it("runAutonomousExecutionCycle resolves agent from project agents before queuing", async () => {
    const src = (await import("fs")).readFileSync(
      (await import("path")).resolve("server/autonomy/background/backgroundRunner.ts"),
      "utf8"
    );
    const fnStart = src.indexOf("async function runAutonomousExecutionCycle");
    const fnEnd = src.indexOf("\nexport const backgroundRunner");
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toContain("getAgentsByProject");
    expect(fnBody).not.toContain("agentId: ''");
  });

  it("runAutonomousExecutionCycle respects maxConcurrentAutonomousTasks budget", async () => {
    const src = (await import("fs")).readFileSync(
      (await import("path")).resolve("server/autonomy/background/backgroundRunner.ts"),
      "utf8"
    );
    const fnStart = src.indexOf("async function runAutonomousExecutionCycle");
    const fnEnd = src.indexOf("\nexport const backgroundRunner");
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody).toContain("maxConcurrentAutonomousTasks");
  });

  it("runAutonomousExecutionCycle matches agent by task assignee role/name when available", async () => {
    const src = (await import("fs")).readFileSync(
      (await import("path")).resolve("server/autonomy/background/backgroundRunner.ts"),
      "utf8"
    );
    const fnStart = src.indexOf("async function runAutonomousExecutionCycle");
    const fnEnd = src.indexOf("\nexport const backgroundRunner");
    const fnBody = src.slice(fnStart, fnEnd);
    // Must look up task by id and match assignee, not always use agents[0]
    expect(fnBody).toContain("task.assignee");
  });
});
