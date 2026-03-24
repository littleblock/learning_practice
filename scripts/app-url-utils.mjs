import os from "node:os";

function normalizeBasePath(value) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function resolvePort() {
  const rawPort = process.env.PORT || process.env.port;
  const parsed = Number.parseInt(rawPort ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3000;
}

function resolveNetworkHosts() {
  const result = [];
  const interfaces = os.networkInterfaces();

  for (const items of Object.values(interfaces)) {
    for (const item of items ?? []) {
      if (item.family !== "IPv4" || item.internal) {
        continue;
      }

      result.push(item.address);
    }
  }

  return [...new Set(result)];
}

function buildAppUrl(origin, basePath, pathname) {
  return `${origin}${basePath}${pathname}`;
}

export function printAppUrls() {
  const port = resolvePort();
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  const localOrigin = `http://localhost:${port}`;
  const learnerPath = "/m/login";
  const adminPath = "/admin/login";

  console.log("");
  console.log("App URLs");
  console.log("--------");
  console.log(
    `Local learner login: ${buildAppUrl(localOrigin, basePath, learnerPath)}`,
  );
  console.log(
    `Local admin login:   ${buildAppUrl(localOrigin, basePath, adminPath)}`,
  );

  for (const host of resolveNetworkHosts()) {
    const networkOrigin = `http://${host}:${port}`;
    console.log(
      `LAN learner login:   ${buildAppUrl(networkOrigin, basePath, learnerPath)}`,
    );
    console.log(
      `LAN admin login:     ${buildAppUrl(networkOrigin, basePath, adminPath)}`,
    );
  }

  console.log("");
}
