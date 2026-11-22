import { defineConfig } from "@playwright/test";

export default defineConfig({
  testMatch: "tests/**/*.spec.ts",
  use: { baseURL: "http://127.0.0.1:3191" },
  webServer: {
    command: "node --import tsx tests/browser-server.ts",
    url: "http://127.0.0.1:3191/api/products",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
