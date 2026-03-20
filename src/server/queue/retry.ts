import { JobStatus } from "@prisma/client";

export function resolveRetryStatus(attempts: number, maxAttempts: number) {
  return attempts >= maxAttempts ? JobStatus.FAILED : JobStatus.PENDING;
}
