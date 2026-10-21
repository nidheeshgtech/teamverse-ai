import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phone layout (iPhone 14-sized viewport, touch) against the DEMO fixture routes: no database needed.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const C = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude("canvas").analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.describe("phone layout", () => {
  test("app chrome: compact top bar and bottom tab bar, no sidebar", async ({ page }) => {
    await page.goto("/dev/comms");
    const tabs = page.getByRole("navigation", { name: "Main navigation" }).filter({ has: page.getByRole("link", { name: "Chats" }) });
    await expect(tabs).toBeVisible();
    for (const name of ["Office", "Chats", "People"]) await expect(tabs.getByRole("link", { name })).toBeVisible();
    await expect(page.getByRole("complementary").filter({ hasText: "Virtual Office" })).toBeHidden(); // desktop sidebar
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yViolations(page);
  });

  test("chats: list, full-screen thread, back", async ({ page }) => {
    await page.goto("/dev/comms");
    const list = page.getByRole("navigation", { name: "Conversations" });
    await list.getByRole("link", { name: /Sara Al-Hashimi/ }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Sara Al-Hashimi" })).toBeVisible();
    await expect(list).toBeHidden();
    // Full screen like a messenger: the tab bar is gone, the composer sits at the bottom.
    await expect(page.getByRole("link", { name: "Chats" })).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Write a message" })).toBeInViewport();
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Show details" }).click();
    await expect(page.getByRole("dialog", { name: "Conversation details" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("link", { name: "Back to conversations" }).click();
    await expect(list).toBeVisible();
    await expect(page.getByRole("link", { name: "Chats" })).toBeVisible();
  });

  test("sending from the phone composer", async ({ page }) => {
    await page.goto(`/dev/comms/${C(7)}`);
    const box = page.getByRole("textbox", { name: "Write a message" });
    await box.fill("Sent from my phone");
    await page.getByRole("button", { name: "Send" }).tap();
    await expect(page.getByRole("log").getByRole("article").last().getByText("Sent", { exact: true })).toBeVisible();
  });

  test("More sheet holds the remaining sections", async ({ page }) => {
    await page.goto("/dev/comms");
    await page.getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "More" });
    for (const name of ["Conferences", "Voice Notes", "AI Assistant", "Settings"]) await expect(sheet.getByRole("link", { name })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("office: stacked panels, 2D plan by default, profile as a sheet", async ({ page }) => {
    await page.goto("/dev/office");
    await expect(page.getByRole("heading", { name: "Main Office (Demo)" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /2D plan/ })).toHaveAttribute("data-state", "on");
    await expectNoHorizontalScroll(page);

    await page.getByRole("region", { name: "People", exact: true }).getByRole("button", { name: /Tariq Mansour/ }).click();
    await expect(page.getByRole("dialog", { name: "Profile of Tariq Mansour" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test("directory: one column, no sideways scroll", async ({ page }) => {
    await page.goto("/dev/directory");
    const first = page.getByRole("listitem").filter({ hasText: "Demo Admin" }).first();
    const second = page.getByRole("listitem").filter({ hasText: "Fatima Rashid" }).first();
    const [a, b] = [await first.boundingBox(), await second.boundingBox()];
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1); // stacked, not side by side
    await expectNoHorizontalScroll(page);
  });
});
