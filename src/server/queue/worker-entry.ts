import os from "node:os";
import { execSync } from "node:child_process";

import { ensureProcessEnvLoaded } from "@/server/load-env";
import { startWorkerLoop } from "@/server/queue/worker";

if (process.platform === "win32") {
  try {
    execSync("chcp 65001 >NUL", {
      stdio: "ignore",
      shell: "cmd.exe",
    });
  } catch {
    // 控制台不支持时继续使用当前编码。
  }
}

ensureProcessEnvLoaded();

const workerId = `${os.hostname()}-${process.pid}`;

startWorkerLoop(workerId).catch((error) => {
  console.error("Worker startup failed", error);
  process.exit(1);
});
