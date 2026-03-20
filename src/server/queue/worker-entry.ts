import os from "node:os";

import { ensureProcessEnvLoaded } from "@/server/load-env";
import { startWorkerLoop } from "@/server/queue/worker";

ensureProcessEnvLoaded();

const workerId = `${os.hostname()}-${process.pid}`;

startWorkerLoop(workerId).catch((error) => {
  console.error("Worker startup failed", error);
  process.exit(1);
});
