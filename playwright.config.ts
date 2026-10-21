import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3200);
// Default: test a production build (deterministic; dev compiles on demand and flakes under
// parallel WebGL load). E2E_DEV=1 runs against `next dev` instead.
const useDev = process.env.E2E_DEV === "1";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  // Desktop only for now (mobile deferred by product owner).
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1024 } } }],
  webServer: {
    command: useDev ? `npx next dev -p ${port}` : `npx next build && npx next start -p ${port}`,
    url: `http://localhost:${port}/sign-in`,
    // Fixture routes (/dev/*) must be served by the production build for the office tests.
    env: { ENABLE_DEV_PREVIEW: "1" },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
