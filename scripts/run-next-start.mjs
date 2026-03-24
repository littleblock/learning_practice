import { execSync, spawn } from "node:child_process";

import { printAppUrls } from "./app-url-utils.mjs";

function ensureUtf8Console() {
  if (process.platform !== "win32") {
    return;
  }

  try {
    execSync("chcp 65001 >NUL", {
      stdio: "ignore",
      shell: "cmd.exe",
    });
  } catch {
    // 忽略控制台无法切换编码的情况。
  }
}

ensureUtf8Console();
printAppUrls();

const packageManagerExecPath = process.env.npm_execpath;

if (!packageManagerExecPath) {
  throw new Error("Package manager entrypoint not found; cannot start Next server.");
}

const child = spawn(process.execPath, [packageManagerExecPath, "exec", "next", "start"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
