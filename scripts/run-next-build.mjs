import { execSync, spawn } from "node:child_process";

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
    // 本地终端不支持切换编码时，继续沿用当前控制台配置。
  }
}

ensureUtf8Console();

const packageManagerExecPath = process.env.npm_execpath;

if (!packageManagerExecPath) {
  throw new Error("Package manager entrypoint not found; cannot start Next build.");
}

const child = spawn(
  process.execPath,
  [packageManagerExecPath, "exec", "next", "build"],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_BUILD_CPUS: process.env.NEXT_BUILD_CPUS || "1",
      NEXT_WEBPACK_BUILD_WORKER:
        process.env.NEXT_WEBPACK_BUILD_WORKER || "false",
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
