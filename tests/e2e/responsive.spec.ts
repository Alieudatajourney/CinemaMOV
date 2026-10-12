import { expect, test, type Page } from "@playwright/test";
import { collectConsoleErrors, pickScreening, resetDemo } from "./helpers";

test.beforeAll(async ({ request }) => {
  await resetDemo(request);
});

async function noHorizontalOverflow(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, "page should not scroll horizontally").toBeLessThanOrEqual(iw);
}

test("mobile: pages fit the viewport and the seat bar never covers seats", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await noHorizontalOverflow(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#mobile-nav").getByRole("link", { name: "My Tickets" })).toBeVisible();

  const id = await pickScreening(page, 0);
  await noHorizontalOverflow(page);
  await page.goto(`/book/${id}`);
  await noHorizontalOverflow(page);

  const bar = page.getByLabel("Booking summary").last();
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("button", { name: "Continue" })).toBeDisabled();

  // Tap targets are at least 28px.
  const box = await page.locator("button.seat").first().boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(28);

  const seat = page.locator('button.seat[data-state="available"]').first();
  await seat.tap();
  await expect(bar.getByText("1 seat")).toBeVisible();
  await expect(bar.getByRole("button", { name: "Continue" })).toBeEnabled();

  // Scroll to the bottom: the last seat row must sit above the sticky bar.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const lastRow = await page.locator('[role="group"][aria-label^="Row"]').last().boundingBox();
  const barBox = await bar.boundingBox();
  expect(lastRow!.y + lastRow!.height).toBeLessThanOrEqual(barBox!.y);

  await bar.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/snacks\//);
  await expect(page.getByRole("heading", { name: "Snacks & drinks" })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.getByRole("button", { name: "Add combo" }).tap();
  await expect(page.getByLabel("Order total").getByText(/\+ 1 snack/)).toBeVisible();
  await page.getByLabel("Order total").getByRole("button", { name: "Continue" }).tap();
  await expect(page).toHaveURL(/\/checkout\//);
  await expect(page.getByLabel("Full name")).toBeVisible();
  await noHorizontalOverflow(page);

  // Sticky pay bar: visible without scrolling, and it submits the form (validation appears).
  const payBar = page.getByLabel("Payment summary");
  await expect(payBar.getByRole("button", { name: "Pay (demo)" })).toBeInViewport();
  await payBar.getByRole("button", { name: "Pay (demo)" }).tap();
  await expect(page.getByText("Please check your details")).toBeVisible();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("reduced motion: seat selection still works", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const id = await pickScreening(page, 1);
  await page.goto(`/book/${id}`);
  const seatId = await page.locator('button.seat[data-state="available"]').first().getAttribute("data-seat");
  await page.locator(`#seat-${seatId}`).tap();
  await expect(page.locator(`#seat-${seatId}`)).toHaveAttribute("data-state", "selected");
});

test("keyboard: arrow keys move between seats and Enter selects", async ({ page }) => {
  const id = await pickScreening(page, 0);
  await page.goto(`/book/${id}`, { waitUntil: "networkidle" });
  const first = page.locator('button.seat[tabindex="0"]');
  await first.focus();
  const startId = await first.getAttribute("data-seat");
  await page.keyboard.press("ArrowRight");
  const moved = await page.evaluate(() => document.activeElement?.getAttribute("data-seat"));
  expect(moved).not.toBe(startId);
  const state = await page.locator(`#seat-${moved}`).getAttribute("data-state");
  await page.keyboard.press("Enter");
  if (state === "available") await expect(page.locator(`#seat-${moved}`)).toHaveAttribute("aria-pressed", "true");
  else await expect(page.getByText(/already booked|being held/).first()).toBeVisible();
});
