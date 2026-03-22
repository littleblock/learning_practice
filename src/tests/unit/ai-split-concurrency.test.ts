import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

function applyTestEnv(overrides?: Record<string, string>) {
  process.env = {
    ...originalEnv,
    DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
    SESSION_SECRET: "test-session-secret",
    AI_SPLIT_CONCURRENCY_INITIAL: "2",
    AI_SPLIT_CONCURRENCY_MIN: "1",
    AI_SPLIT_CONCURRENCY_MAX: "4",
    AI_SPLIT_SCALE_UP_SUCCESS_THRESHOLD: "2",
    AI_SPLIT_RATE_LIMIT_COOLDOWN_MS: "1000",
    ...overrides,
  };
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("AiSplitConcurrencyController", () => {
  it("会在连续成功达到阈值后逐步升高并发", async () => {
    applyTestEnv();

    const { AiSplitConcurrencyController } = await import(
      "@/server/services/ai-split-concurrency"
    );
    const controller = new AiSplitConcurrencyController();

    expect(controller.getLimit()).toBe(2);

    await controller.recordSuccess();
    expect(controller.getLimit()).toBe(2);

    await controller.recordSuccess();
    expect(controller.getLimit()).toBe(3);
  });

  it("命中限流后会降并发，并在冷却结束后允许重新升高", async () => {
    vi.useFakeTimers();
    applyTestEnv({
      AI_SPLIT_CONCURRENCY_INITIAL: "4",
      AI_SPLIT_CONCURRENCY_MAX: "6",
      AI_SPLIT_SCALE_UP_SUCCESS_THRESHOLD: "2",
    });

    const { AiSplitConcurrencyController } = await import(
      "@/server/services/ai-split-concurrency"
    );
    const controller = new AiSplitConcurrencyController();

    expect(controller.getLimit()).toBe(4);

    await controller.recordRateLimit();
    expect(controller.getLimit()).toBe(2);

    const waitPromise = controller.waitForCooldown();
    await vi.advanceTimersByTimeAsync(1000);
    await waitPromise;

    await controller.recordSuccess();
    await controller.recordSuccess();

    expect(controller.getLimit()).toBe(3);
  });

  it("任务池会遵守当前并发上限", async () => {
    applyTestEnv({
      AI_SPLIT_CONCURRENCY_INITIAL: "2",
      AI_SPLIT_CONCURRENCY_MAX: "2",
      AI_SPLIT_SCALE_UP_SUCCESS_THRESHOLD: "10",
    });

    const { AiSplitConcurrencyController, mapWithAdaptiveConcurrency } =
      await import("@/server/services/ai-split-concurrency");
    const controller = new AiSplitConcurrencyController();
    let inFlight = 0;
    let maxInFlight = 0;

    const results = await mapWithAdaptiveConcurrency(
      [1, 2, 3, 4],
      controller,
      async (item) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return item * 2;
      },
    );

    expect(results).toEqual([2, 4, 6, 8]);
    expect(maxInFlight).toBe(2);
  });
});
