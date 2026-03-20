import { spawn } from "node:child_process";

const packageManagerExecPath = process.env.npm_execpath;

if (!packageManagerExecPath) {
  throw new Error("Package manager entrypoint not found; cannot start Next dev.");
}

const child = spawn(process.execPath, [packageManagerExecPath, "exec", "next", "dev"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_DIST_DIR: ".next-dev",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
