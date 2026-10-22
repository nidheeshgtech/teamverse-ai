import { expect, test, type Browser } from "@playwright/test";

const C = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// ---------------------------------------------------------------------------------------------
// Full stack: two browsers with fake camera/microphone, local Supabase and a local LiveKit server
// (`docker run … livekit/livekit-server --dev`, LIVEKIT_* in .env.local).
// Run with E2E_SUPABASE=1 E2E_LIVEKIT=1 after `npm run db:reset`.
// ---------------------------------------------------------------------------------------------
// Fake camera/microphone devices (a test pattern and a beep), granted without prompts.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] } });

test.describe("calls (Supabase + LiveKit)", () => {
  test.skip(process.env.E2E_SUPABASE !== "1" || process.env.E2E_LIVEKIT !== "1", "requires local Supabase and LiveKit (E2E_SUPABASE=1 E2E_LIVEKIT=1)");
  test.describe.configure({ mode: "serial" });

  async function signIn(browser: Browser, email: string, next: string) {
    const context = await browser.newContext({ permissions: ["microphone", "camera"] });
    const page = await context.newPage();
    await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("demo-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`${next.replace(/[/]/g, "\\/")}$`));
    return { context, page };
  }

  const dm = `/comms/${C(7)}`; // Zayd <-> Tariq

  test("rings, connects with media, mutes and ends for both", async ({ browser }) => {
    test.setTimeout(90_000);
    const zayd = await signIn(browser, "zayd.benali@demo.teamverse.local", dm);
    const tariq = await signIn(browser, "tariq.mansour@demo.teamverse.local", "/comms");

    await zayd.page.getByRole("button", { name: "Video call" }).first().click();
    const zaydCall = zayd.page.getByRole("dialog", { name: "Call with Tariq Mansour" });
    await expect(zaydCall.getByText("Waiting for Tariq Mansour to answer…")).toBeVisible();

    const ringing = tariq.page.getByRole("alertdialog", { name: /Incoming video call: Zayd Benali/ });
    await expect(ringing).toBeVisible({ timeout: 15_000 });
    await ringing.getByRole("button", { name: "Video" }).click();

    const tariqCall = tariq.page.getByRole("dialog", { name: "Call with Zayd Benali" });
    for (const call of [zaydCall, tariqCall]) {
      await expect(call.getByText("Live", { exact: true })).toBeVisible({ timeout: 20_000 });
      // The other person's camera is on the stage: a playing <video> with real frames.
      await expect
        .poll(() => call.locator("video").evaluateAll((els) => els.some((v) => (v as HTMLVideoElement).videoWidth > 0)), { timeout: 20_000 })
        .toBe(true);
    }

    await tariqCall.getByRole("button", { name: "Mute" }).click();
    await expect(tariqCall.getByRole("button", { name: "Unmute" })).toHaveAttribute("aria-pressed", "true");
    await expect(zaydCall.getByLabel("Muted")).toBeVisible({ timeout: 10_000 });

    await tariqCall.getByRole("button", { name: "Leave" }).click();
    await expect(zaydCall.getByRole("status").filter({ hasText: "Call ended." })).toBeVisible({ timeout: 15_000 });
    await zaydCall.getByRole("button", { name: "Close" }).click();
    await expect(zaydCall).toBeHidden();

    await zayd.context.close();
    await tariq.context.close();
  });

  test("a declined call tells the caller", async ({ browser }) => {
    test.setTimeout(60_000);
    const zayd = await signIn(browser, "zayd.benali@demo.teamverse.local", dm);
    const tariq = await signIn(browser, "tariq.mansour@demo.teamverse.local", "/office");

    await zayd.page.getByRole("button", { name: "Voice call" }).first().click();
    const ringing = tariq.page.getByRole("alertdialog", { name: /Incoming voice call: Zayd Benali/ });
    await expect(ringing).toBeVisible({ timeout: 15_000 });
    await ringing.getByRole("button", { name: "Decline" }).click();
    await expect(ringing).toBeHidden();
    await expect(zayd.page.getByText("Tariq Mansour declined the call.")).toBeVisible({ timeout: 15_000 });

    await zayd.context.close();
    await tariq.context.close();
  });

  test("a channel huddle shows a live banner others can join", async ({ browser }) => {
    test.setTimeout(90_000);
    const channel = `/comms/${C(1)}`; // #eng-architecture: Tariq, Zayd, Sara, Zaid
    const zayd = await signIn(browser, "zayd.benali@demo.teamverse.local", channel);
    const sara = await signIn(browser, "sara.alhashimi@demo.teamverse.local", channel);

    await zayd.page.getByRole("button", { name: "Start huddle" }).click();
    const zaydCall = zayd.page.getByRole("dialog", { name: "Huddle in eng-architecture" });
    await expect(zaydCall.getByText("You're the only one here so far.")).toBeVisible({ timeout: 20_000 });

    const banner = sara.page.getByRole("status").filter({ hasText: "Huddle in progress · 1 person" });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await banner.getByRole("button", { name: "Join huddle" }).click();
    const saraCall = sara.page.getByRole("dialog", { name: "Huddle in eng-architecture" });
    await expect(saraCall.getByText("Live", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(zaydCall.getByText("Sara Al-Hashimi")).toBeVisible({ timeout: 20_000 });

    // Minimize keeps the call running; the header button returns to it.
    await zaydCall.getByRole("button", { name: "Minimize call" }).click();
    await expect(zaydCall).toBeHidden();
    await zayd.page.getByRole("button", { name: "Return to call" }).first().click();
    await expect(zaydCall).toBeVisible();

    await zaydCall.getByRole("button", { name: "Leave" }).click();
    await saraCall.getByRole("button", { name: "Leave" }).click();
    await expect(saraCall.getByRole("status").filter({ hasText: "Call ended." })).toBeVisible();

    await zayd.context.close();
    await sara.context.close();
  });
});
