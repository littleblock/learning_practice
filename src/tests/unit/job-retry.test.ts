import { describe, expect, it } from "vitest";
import { JobStatus } from "@prisma/client";

import { resolveRetryStatus } from "@/server/queue/retry";

describe("resolveRetryStatus", () => {
  it("未达到最大重试次数时返回 pending", () => {
    expect(resolveRetryStatus(1, 3)).toBe(JobStatus.PENDING);
  });

  it("达到最大重试次数时返回 failed", () => {
    expect(resolveRetryStatus(3, 3)).toBe(JobStatus.FAILED);
  });
});
