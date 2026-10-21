import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Full-stack tests need `supabase start` + seeded demo data + .env.local; set E2E_SUPABASE=1 to run them.
const withSupabase = process.env.E2E_SUPABASE === "1";

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.describe("document", () => {
  test("sets lang and dir from the active locale", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("unknown routes render the localized 404", async ({ page }) => {
    // With Supabase configured, signed-out visitors are sent to sign-in first (covered below, signed in).
    test.skip(withSupabase, "signed-out unknown routes redirect to sign-in when auth is configured");
    await page.goto("/sign-in"); // establish a session-less context first
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("design-system gallery is accessible", async ({ page }) => {
    await page.goto("/dev/ui");
    await expect(page.getByRole("heading", { name: "Design system" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});

test.describe("sign-in", () => {
  test("is accessible", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("invalid invitation links fail closed", async ({ page }) => {
    await page.goto("/invite/not-a-real-token");
    await expect(page.getByText(/isn't valid|not configured/)).toBeVisible();
  });
});

test.describe("authenticated flows", () => {
  test.skip(!withSupabase, "requires local Supabase (E2E_SUPABASE=1)");

  async function signIn(page: Page, email: string) {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("demo-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
  }

  test("unknown routes render the localized 404 when signed in", async ({ page }) => {
    await signIn(page, "zayd.benali@demo.teamverse.local");
    await expect(page).toHaveURL(/\/comms$/);
    const response = await page.goto("/definitely-not-a-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Page not found")).toBeVisible();
  });

  test("protected pages redirect to sign-in and back", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin/);
  });

  test("rejects wrong credentials", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@demo.teamverse.local");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
  });

  test("owner lands on the office and can open the organization page", async ({ page }) => {
    await signIn(page, "admin@demo.teamverse.local");
    await expect(page).toHaveURL(/\/office$/);
    await expect(page.getByRole("complementary").getByText("Demo data")).toBeVisible();
    await page.getByRole("link", { name: "Organization" }).click();
    await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("member lands on comms and cannot open the organization page", async ({ page }) => {
    await signIn(page, "zayd.benali@demo.teamverse.local");
    await expect(page).toHaveURL(/\/comms$/);
    await expect(page.getByRole("link", { name: "Organization" })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/forbidden$/);
  });

  test("availability is user-chosen and persists", async ({ page }) => {
    // Hamdan is used by no other test: the presence test changes Zayd's availability in parallel.
    await signIn(page, "hamdan.zayed@demo.teamverse.local");
    await expect(page).toHaveURL(/\/comms$/);
    await page.getByRole("button", { name: /Your availability/ }).click();
    await page.getByRole("menuitemradio", { name: "Busy" }).click();
    const trigger = page.getByRole("button", { name: /Your availability: Busy/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).not.toHaveAttribute("aria-busy", "true"); // saved before reloading
    await page.reload();
    await expect(page.getByRole("button", { name: /Your availability: Busy/ })).toBeVisible();
    // restore
    await page.getByRole("button", { name: /Your availability/ }).click();
    await page.getByRole("menuitemradio", { name: "Online" }).click();
  });

  test("admin can create an invitation that a new user accepts", async ({ page, browser }) => {
    test.setTimeout(60_000); // two browser sessions and an account creation
    await signIn(page, "admin@demo.teamverse.local");
    await expect(page).toHaveURL(/\/office$/); // session cookie is set before navigating on
    await page.goto("/admin");
    const email = `new-${Date.now()}@demo.teamverse.local`;
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Create invitation link" }).click();
    const link = await page.locator("code").filter({ hasText: "/invite/" }).textContent();
    expect(link).toBeTruthy();

    const invitee = await (await browser.newContext()).newPage();
    await invitee.goto(new URL(link!).pathname);
    await expect(invitee.getByText(email)).toBeVisible();
    await invitee.getByLabel("Your name").fill("New Teammate");
    await invitee.getByLabel("Choose a password").fill("a-long-password-123");
    await invitee.getByRole("button", { name: "Accept and join" }).click();
    await expect(invitee).toHaveURL(/\/comms$/);

    // The link is single-use.
    await invitee.goto(new URL(link!).pathname);
    await expect(invitee.getByText(/already been used/)).toBeVisible();
  });
});
