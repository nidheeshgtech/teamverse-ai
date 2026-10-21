import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Runs against the dev-only fixture route (DEMO data, SIMULATED presence), so it needs no database.
// In a production build, start the server with ENABLE_DEV_PREVIEW=1.

async function openOffice(page: Page, view: "3d" | "2d") {
  await page.addInitScript((v) => window.localStorage.setItem("tv.office.view", v), view);
  await page.goto("/dev/office");
  await expect(page.getByRole("heading", { name: "Main Office (Demo)" })).toBeVisible();
}

test.describe("virtual office (fixture)", () => {
  test("labels demo data and simulated presence honestly", async ({ page }) => {
    await openOffice(page, "2d");
    await expect(page.getByText("Demo data")).toBeVisible();
    await expect(page.getByText("Simulated (dev fixture)")).toBeVisible();
    await expect(page.getByText("Presence is ephemeral")).toBeVisible();
  });

  test("renders the 3D scene with a label for every room", async ({ page }) => {
    await openOffice(page, "3d");
    await expect(page.getByTestId("office-canvas").locator("canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Placeholder 3D — final office assets pending")).toBeVisible();
    for (const room of ["Development", "Design & UX", "Marketing & Growth", "PM & Ops", "Meeting Room"]) {
      await expect(page.locator(`[data-anchor^="room:"]`, { hasText: room })).toBeVisible();
    }
  });

  test("keyboard: search the people list and open a profile", async ({ page }) => {
    await openOffice(page, "2d");
    const search = page.getByRole("searchbox", { name: "Search people, titles or desks" });
    await search.focus();
    await page.keyboard.type("tariq");
    await expect(page.getByText("1 person")).toBeVisible();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    const profile = page.getByRole("region", { name: "Profile of Tariq Mansour" });
    await expect(profile).toBeVisible();
    await expect(profile.getByText("Online · Desk DEV-1")).toBeVisible();
    // Unbuilt actions are visibly disabled with the reason, never faked.
    const screenShare = profile.getByRole("button", { name: /Screen share/ });
    await expect(screenShare).toHaveAttribute("aria-disabled", "true");
    await expect(screenShare).toContainText("During calls");
    await expect(screenShare).toHaveAttribute("title", "Only during an active call, after you choose to share.");

    await page.keyboard.press("Escape");
    await expect(profile).toHaveCount(0);
  });

  test("department filter narrows rooms and people", async ({ page }) => {
    await openOffice(page, "2d");
    await page.getByRole("radio", { name: /Development/ }).click();
    await expect(page.getByText("3 people").first()).toBeVisible();
    const list = page.getByRole("region", { name: "People", exact: true }).getByRole("listitem");
    await expect(list).toHaveCount(3);
  });

  test("2D plan exposes every seated person as a button", async ({ page }) => {
    await openOffice(page, "2d");
    const plan = page.getByRole("region", { name: "2D plan" });
    await expect(plan.getByRole("button")).toHaveCount(10);
    await plan.getByRole("button", { name: /Hamdan Zayed/ }).click();
    await expect(page.getByRole("region", { name: "Profile of Hamdan Zayed" })).toBeVisible();
  });

  test("is accessible in both views", async ({ page }) => {
    for (const view of ["2d", "3d"] as const) {
      await openOffice(page, view);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude("canvas").analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), view).toEqual([]);
    }
  });
});

test.describe("team directory (fixture)", () => {
  test("search and open a profile", async ({ page }) => {
    await page.goto("/dev/directory");
    await page.getByRole("searchbox").fill("design");
    await page.getByRole("button", { name: /Sara Al-Hashimi/ }).click();
    await expect(page.getByRole("region", { name: "Profile of Sara Al-Hashimi" })).toBeVisible();
  });
});

test.describe("live presence (Supabase)", () => {
  test.skip(process.env.E2E_SUPABASE !== "1", "requires local Supabase (E2E_SUPABASE=1)");

  async function signIn(page: Page, email: string) {
    await page.addInitScript(() => window.localStorage.setItem("tv.office.view", "2d"));
    await page.goto("/sign-in?next=%2Foffice");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("demo-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/office$/);
  }

  test("two people see each other's chosen availability, and offline when they leave", async ({ browser }) => {
    const admin = await (await browser.newContext()).newPage();
    const zaydContext = await browser.newContext();
    const zayd = await zaydContext.newPage();
    await signIn(admin, "admin@demo.teamverse.local");
    await signIn(zayd, "zayd.benali@demo.teamverse.local");

    const people = admin.getByRole("region", { name: "People", exact: true });
    await expect(admin.getByText("Live", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(people.getByRole("button", { name: /Zayd Benali/ })).toContainText("Online", { timeout: 15_000 });

    await zayd.getByRole("button", { name: /Your availability/ }).click();
    await zayd.getByRole("menuitemradio", { name: "Busy" }).click();
    await expect(people.getByRole("button", { name: /Zayd Benali/ })).toContainText("Busy", { timeout: 15_000 });

    // Restore the seeded default before leaving.
    await zayd.getByRole("button", { name: /Your availability/ }).click();
    await zayd.getByRole("menuitemradio", { name: "Online" }).click();
    await zaydContext.close();
    await expect(people.getByRole("button", { name: /Zayd Benali/ })).toContainText("Offline", { timeout: 30_000 });
  });
});
