import { spawn } from "node:child_process";

const packageManagerExecPath = process.env.npm_execpath;

if (!packageManagerExecPath) {
  throw new Error("Package manager entrypoint not found; cannot start dev processes.");
}

const children = [];
let exiting = false;

function runScript(scriptName) {
  const child = spawn(process.execPath, [packageManagerExecPath, "run", scriptName], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (exiting) {
      return;
    }

    if (code !== 0 || signal) {
      exiting = true;
      for (const current of children) {
        if (!current.killed) {
          current.kill("SIGTERM");
        }
      }
      process.exit(code ?? 1);
    }
  });
}

function shutdown() {
  if (exiting) {
    return;
  }

  exiting = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Starting web and worker dev processes...");
runScript("dev:web");
runScript("worker:dev");
