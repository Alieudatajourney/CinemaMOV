import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3100);
// Set E2E_BASE_URL to test an already-deployed site (no local server is started).
const EXTERNAL = process.env.E2E_BASE_URL;
// Uses an installed Google Chrome by default (no browser download needed).
// Set PW_CHANNEL="" to use Playwright's bundled Chromium after `npx playwright install chromium`.
const channel = process.env.PW_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: EXTERNAL ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: "desktop", testIgnore: /responsive\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...(channel ? { channel } : {}) } },
    { name: "mobile", use: { ...devices["Pixel 7"], ...(channel ? { channel } : {}) }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: EXTERNAL
    ? undefined
    : {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      MCP_DATA_FILE: ".data/e2e/monrovia-cinema-plus.json",
      NODE_ENV: "production",
      MCP_DISABLE_RATE_LIMIT: "1",
    },
  },
});
