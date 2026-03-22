import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  outputDir: "./output/playwright/test-results",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel: "msedge",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx pnpm@10.8.0 dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
  },
});
