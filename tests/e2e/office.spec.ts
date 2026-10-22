import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Runs against the dev-only fixture route (DEMO data, SIMULATED presence), so it needs no database.
// In a production build, start the server with ENABLE_DEV_PREVIEW=1.

async function openOffice(page: Page) {
  await page.goto("/dev/office");
  await expect(page.getByRole("heading", { name: "Main Office (Demo)" })).toBeVisible();
}

const tag = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}, `) });

test.describe("virtual office (fixture)", () => {
  test("labels demo data and simulated presence honestly", async ({ page }) => {
    await openOffice(page);
    await expect(page.getByText("Demo data")).toBeVisible();
    await expect(page.getByText("Simulated (dev fixture)")).toBeVisible();
  });

  test("shows everyone as a name tag, connected people first", async ({ page }) => {
    await openOffice(page);
    await expect(page.getByText("11 people")).toBeVisible();
    await expect(page.locator("main section li")).toHaveCount(11);
    const here = page.getByRole("heading", { name: /In the office now/ });
    const away = page.getByRole("heading", { name: /Not connected/ });
    await expect(here).toBeVisible();
    await expect(away).toBeVisible();
    expect((await here.boundingBox())!.y).toBeLessThan((await away.boundingBox())!.y);
  });

  test("keyboard: search the board and open a profile", async ({ page }) => {
    await openOffice(page);
    const search = page.getByRole("searchbox", { name: "Search people, titles or desks" });
    await search.focus();
    await page.keyboard.type("tariq");
    await expect(page.getByText("1 person")).toBeVisible();
    await tag(page, "Tariq Mansour").focus();
    await page.keyboard.press("Enter");

    const profile = page.getByRole("region", { name: "Profile of Tariq Mansour" });
    await expect(profile).toBeVisible();
    await expect(profile.getByText("Online · Desk DEV-1")).toBeVisible();
    // Unbuilt actions are visibly disabled with the reason, never faked.
    const screenShare = profile.getByRole("button", { name: /Screen share/ });
    await expect(screenShare).toHaveAttribute("aria-disabled", "true");
    await expect(screenShare).toContainText("During calls");

    await page.keyboard.press("Escape");
    await expect(profile).toHaveCount(0);
  });

  test("department filter narrows the board", async ({ page }) => {
    await openOffice(page);
    await page.getByRole("radio", { name: /Development/ }).click();
    await expect(page.getByText("3 people")).toBeVisible();
    await expect(page.locator("main section li")).toHaveCount(3);
  });

  test("calls on a tag explain why they're unavailable without a backend", async ({ page }) => {
    await openOffice(page);
    const card = page.locator("main section li").filter({ has: tag(page, "Hamdan Zayed") });
    await expect(card.getByRole("button", { name: /^Voice call/ })).toHaveAttribute("aria-disabled", "true");
    await expect(card.getByRole("button", { name: /^Video call/ })).toHaveAttribute("aria-disabled", "true");
  });

  test("list view shows the same people as rows", async ({ page }) => {
    await openOffice(page);
    await page.getByRole("radio", { name: "List" }).click();
    await expect(page.locator("main section li")).toHaveCount(11);
    await tag(page, "Hamdan Zayed").click();
    await expect(page.getByRole("region", { name: "Profile of Hamdan Zayed" })).toBeVisible();
  });

  test("search view: type, move with arrows, Enter opens the profile, and the choice is remembered", async ({ page }) => {
    await openOffice(page);
    await page.getByRole("radio", { name: "Search" }).click();
    const box = page.getByRole("searchbox", { name: "Search people, titles or desks" });
    await expect(box).toBeFocused();
    await expect(page.getByRole("heading", { name: "Connected now" })).toBeVisible();
    await page.keyboard.type("za");
    await expect(page.getByText("3 matches")).toBeVisible(); // Zaid Chen, Zayd Benali, Hamdan Zayed
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Profile of Zayd Benali" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("radio", { name: "Search" })).toHaveAttribute("data-state", "on");
  });

  test("is accessible in every view", async ({ page }) => {
    await openOffice(page);
    for (const view of ["Grid", "List", "Search"]) {
      await page.getByRole("radio", { name: view }).click();
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
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

    const zaydTag = admin.getByRole("button", { name: /^Zayd Benali, / });
    await expect(admin.getByText("Live", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(zaydTag).toHaveAccessibleName("Zayd Benali, Online", { timeout: 15_000 });

    await zayd.getByRole("button", { name: /Your availability/ }).click();
    await zayd.getByRole("menuitemradio", { name: "Busy" }).click();
    await expect(zaydTag).toHaveAccessibleName("Zayd Benali, Busy", { timeout: 15_000 });

    // Restore the seeded default before leaving.
    await zayd.getByRole("button", { name: /Your availability/ }).click();
    await zayd.getByRole("menuitemradio", { name: "Online" }).click();
    await zaydContext.close();
    await expect(zaydTag).toHaveAccessibleName("Zayd Benali, Offline", { timeout: 30_000 });
  });
});
