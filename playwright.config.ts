import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.ts",
  timeout: 60000,
  outputDir: ".local/test-results",
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1440, height: 1050 },
    channel: process.env.BROWSER_CHANNEL || "msedge",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
