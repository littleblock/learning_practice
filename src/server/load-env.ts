import * as nextEnv from "@next/env";

let loaded = false;

export function ensureProcessEnvLoaded() {
  if (loaded) {
    return;
  }

  const envModule = nextEnv as typeof nextEnv & {
    default?: typeof nextEnv;
    "module.exports"?: typeof nextEnv;
  };

  const loadEnvConfig =
    envModule.loadEnvConfig ??
    envModule.default?.loadEnvConfig ??
    envModule["module.exports"]?.loadEnvConfig;

  if (!loadEnvConfig) {
    throw new Error("Failed to load loadEnvConfig from @next/env");
  }

  loadEnvConfig(process.cwd());
  loaded = true;
}
