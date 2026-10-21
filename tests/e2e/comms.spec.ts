import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

const C = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

// ---------------------------------------------------------------------------------------------
// Fixture: /dev/comms uses DEMO data and an in-memory transport (no database).
// ---------------------------------------------------------------------------------------------
test.describe("communications (fixture)", () => {
  const composer = (page: Page) => page.getByRole("textbox", { name: "Write a message" });
  const log = (page: Page) => page.getByRole("log");

  test("lists conversations, opens a thread and labels demo data", async ({ page }) => {
    await page.goto(`/dev/comms/${C(1)}`);
    const nav = page.getByRole("navigation", { name: "Conversations" });
    await expect(nav.getByRole("link", { name: /eng-architecture/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /Sara Al-Hashimi/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "eng-architecture" })).toBeVisible();
    await expect(page.getByText("Demo transport: nothing leaves this browser.")).toBeVisible();
    await expect(log(page).getByText("Kicking off the architecture review")).toBeVisible();
    // Unbuilt features are visibly disabled, never faked.
    await expect(page.getByRole("button", { name: "Huddle" })).toHaveAttribute("aria-disabled", "true");
    await expectNoSeriousA11yViolations(page);
  });

  test("sends with safe markdown and never renders message HTML", async ({ page }) => {
    await page.goto(`/dev/comms/${C(1)}`);
    await composer(page).fill('**Ship it** <img src=x onerror="window.__xss=1"> https://example.com');
    await composer(page).press("Enter");

    const sent = log(page).getByRole("article").last();
    await expect(sent.locator("strong")).toHaveText("Ship it");
    await expect(sent.getByRole("link", { name: "https://example.com" })).toHaveAttribute("rel", /noopener/);
    await expect(sent).toContainText("<img src=x");
    await expect(sent.locator("img")).toHaveCount(0);
    await expect(sent.getByText("Sent")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("edits and deletes your own message", async ({ page }) => {
    await page.goto(`/dev/comms/${C(6)}`);
    await composer(page).fill("Draft that needs fixing");
    await composer(page).press("Enter");
    const mine = log(page).getByRole("article").last();
    await expect(mine.getByText("Sent")).toBeVisible();

    await mine.hover();
    await mine.getByRole("button", { name: "Message actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const edit = mine.getByRole("textbox", { name: "Edit message" });
    await edit.fill("Fixed message");
    await edit.press("Enter");
    await expect(mine.getByText("Fixed message")).toBeVisible();
    await expect(mine.getByText("(edited)")).toBeVisible();

    await mine.hover();
    await mine.getByRole("button", { name: "Message actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog", { name: "Delete this message?" }).getByRole("button", { name: "Delete" }).click();
    await expect(mine.getByText("This message was deleted.")).toBeVisible();
  });

  test("rejects unsupported files before uploading", async ({ page }) => {
    await page.goto(`/dev/comms/${C(1)}`);
    await page.locator('input[type="file"]').setInputFiles({ name: "page.html", mimeType: "text/html", buffer: Buffer.from("<b>x</b>") });
    await expect(page.getByRole("region", { name: "eng-architecture" }).getByRole("alert")).toContainText("page.html isn't a supported file type.");
  });

  test("a message sent offline fails visibly, then goes out when back online", async ({ page, context }) => {
    await page.goto(`/dev/comms/${C(7)}`);
    await expect(log(page).getByText("Deploy of the staging build is done.")).toBeVisible();
    await context.setOffline(true);
    await composer(page).fill("Queued while offline");
    await composer(page).press("Enter");
    const queued = log(page).getByRole("article").last();
    await expect(queued.getByText("Not sent")).toBeVisible();
    await context.setOffline(false);
    await expect(queued.getByText("Sent")).toBeVisible();
  });

  test("starts a conversation from the keyboard", async ({ page }) => {
    await page.goto("/dev/comms");
    await expect(page.getByRole("heading", { level: 1, name: "Select a conversation" })).toBeVisible();
    await page.getByRole("button", { name: "New message" }).click();
    const dialog = page.getByRole("dialog", { name: "New message" });
    await page.keyboard.type("noor k");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await expect(dialog.getByRole("option", { name: /Noor Khalid/ })).toHaveAttribute("aria-selected", "true");
    await dialog.getByRole("button", { name: "Message Noor Khalid" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Noor Khalid" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------
// Full stack: two independent browser sessions against local Supabase (seeded demo data).
// Run with E2E_SUPABASE=1 after `npx supabase start && npm run db:reset`.
// ---------------------------------------------------------------------------------------------
test.describe("communications (Supabase)", () => {
  test.skip(process.env.E2E_SUPABASE !== "1", "requires local Supabase (E2E_SUPABASE=1)");
  test.describe.configure({ mode: "serial" });

  async function signIn(browser: Browser, email: string, next = "/comms") {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("demo-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`${next.replace(/[/]/g, "\\/")}$`));
    return { context, page };
  }

  const dmZaydTariq = `/comms/${C(7)}`;

  test("delivers in real time with typing, unread and read receipts", async ({ browser }) => {
    test.setTimeout(60_000); // two sign-ins plus deliberately slow typing
    const zayd = await signIn(browser, "zayd.benali@demo.teamverse.local", dmZaydTariq);
    const tariq = await signIn(browser, "tariq.mansour@demo.teamverse.local", "/comms");

    // Tariq has not opened the DM: it shows as unread in his list.
    const tariqList = tariq.page.getByRole("navigation", { name: "Conversations" });
    await expect(tariqList.getByRole("link", { name: /Zayd Benali/ })).toContainText(/unread/);

    const text = `Realtime check ${Date.now()}`;
    await tariq.page.goto(dmZaydTariq);
    await expect(tariq.page.getByRole("log")).toBeVisible();
    // Type slowly across the 2.5 s typing throttle so at least one event lands after Tariq subscribed.
    const box = zayd.page.getByRole("textbox", { name: "Write a message" });
    await box.pressSequentially(text, { delay: 150 });
    await expect(tariq.page.getByText("Zayd Benali is typing…")).toBeVisible({ timeout: 10_000 });
    await box.press("Enter");

    // Arrives without a reload; Tariq reading it flips Zayd's receipt to "Seen".
    await expect(tariq.page.getByRole("log").getByText(text)).toBeVisible({ timeout: 10_000 });
    const mine = zayd.page.getByRole("log").getByRole("article").last();
    await expect(mine.getByText("Seen")).toBeVisible({ timeout: 10_000 });

    await zayd.context.close();
    await tariq.context.close();
  });

  test("respects read-receipt opt-out", async ({ browser }) => {
    // Layla (seeded with read receipts off) reads Zayd's message; Zayd must not see "Seen".
    const dm = `/comms/${C(2)}`;
    const zayd = await signIn(browser, "zayd.benali@demo.teamverse.local", dm);
    const layla = await signIn(browser, "layla.nour@demo.teamverse.local", dm);
    const text = `Receipt check ${Date.now()}`;
    await zayd.page.getByRole("textbox", { name: "Write a message" }).fill(text);
    await zayd.page.getByRole("textbox", { name: "Write a message" }).press("Enter");
    await expect(layla.page.getByRole("log").getByText(text)).toBeVisible({ timeout: 10_000 });
    const mine = zayd.page.getByRole("log").getByRole("article").last();
    await expect(mine.getByText("Sent")).toBeVisible();
    await zayd.page.waitForTimeout(2000);
    await expect(mine.getByText("Seen")).toHaveCount(0);
    await zayd.context.close();
    await layla.context.close();
  });

  test("admins cannot open a DM they are not in", async ({ browser }) => {
    const admin = await signIn(browser, "tariq.mansour@demo.teamverse.local", "/comms");
    await admin.page.goto(`/comms/${C(2)}`);
    await expect(admin.page.getByRole("heading", { name: "Conversation not found" })).toBeVisible();
    await expect(admin.page.getByText("Hi Layla")).toHaveCount(0);
    await admin.context.close();
  });

  test("members can browse and join public channels", async ({ browser }) => {
    const noor = await signIn(browser, "noor.khalid@demo.teamverse.local", "/comms");
    await noor.page.getByRole("button", { name: "Create or browse channels" }).click();
    const dialog = noor.page.getByRole("dialog", { name: "Channels" });
    await expect(dialog.getByText("client-showcase")).toHaveCount(0); // private: never listed
    await dialog.getByRole("listitem").filter({ hasText: "design-critique" }).getByRole("button", { name: "Join" }).click();
    await expect(noor.page.getByRole("heading", { level: 1, name: "design-critique" })).toBeVisible();
    await expect(noor.page.getByRole("log").getByText("First pass at the onboarding empty states.")).toBeVisible();
    await noor.page.getByRole("button", { name: "Leave channel" }).click();
    await noor.context.close();
  });

  test("recovers messages missed while offline", async ({ browser }) => {
    const zayd = await signIn(browser, "zayd.benali@demo.teamverse.local", dmZaydTariq);
    const tariq = await signIn(browser, "tariq.mansour@demo.teamverse.local", dmZaydTariq);
    await tariq.context.setOffline(true);
    await expect(tariq.page.getByText("You're offline.")).toBeVisible();
    const text = `While you were away ${Date.now()}`;
    await zayd.page.getByRole("textbox", { name: "Write a message" }).fill(text);
    await zayd.page.getByRole("textbox", { name: "Write a message" }).press("Enter");
    await expect(zayd.page.getByRole("log").getByRole("article").last().getByText(/Sent|Seen/)).toBeVisible();
    await tariq.context.setOffline(false);
    await expect(tariq.page.getByRole("log").getByText(text)).toBeVisible({ timeout: 30_000 });
    await zayd.context.close();
    await tariq.context.close();
  });
});
