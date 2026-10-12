import { expect, test } from "@playwright/test";
import { STAFF, chooseSeats, collectConsoleErrors, fillCustomer, login, pickScreening, resetDemo, toCheckout, tomorrowKey } from "./helpers";

test.beforeAll(async ({ request }) => {
  await resetDemo(request);
});

test("complete pitch flow: browse → seats → checkout → ticket → staff validation → admin", async ({ page }) => {
  const errors = collectConsoleErrors(page);

  // 1–2. Home and browse
  await page.goto("/");
  await expect(page).toHaveTitle(/Monrovia Cinema Plus/);
  await expect(page.getByRole("heading", { name: "Now Showing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coming Soon" })).toBeVisible();
  await page.getByPlaceholder("Search title, genre or cast").fill("digger");
  await expect(page.locator("#showtimes article")).toHaveCount(1);
  await page.locator("#showtimes article").first().getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Digger" })).toBeVisible();

  // 3. Showtime (tomorrow) → seat map
  const tomorrow = tomorrowKey();
  const tomorrowLabel = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Monrovia", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${tomorrow}T12:00:00Z`));
  await page.locator("#showtimes").getByRole("button", { name: tomorrowLabel }).click();
  const showtime = page.locator('#showtimes a[href^="/book/"]').first();
  const time = (await showtime.locator("p").first().textContent())!.trim();
  await showtime.click();
  await expect(page).toHaveURL(/\/book\//);
  const bookPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1, name: "Digger" })).toBeVisible();
  await expect(page.getByText(time).first()).toBeVisible();

  // 4–6. Select, deselect, occupied rejection, live price
  const total = page.locator("aside").getByText(/^\$\d+\.\d{2}$/).last();
  const seats = page.locator('button.seat[data-state="available"][data-category="standard"]');
  const a = (await seats.nth(0).getAttribute("data-seat"))!;
  const b = (await seats.nth(3).getAttribute("data-seat"))!;
  const c = (await seats.nth(6).getAttribute("data-seat"))!;
  await page.locator(`#seat-${a}`).click();
  await page.locator(`#seat-${b}`).click();
  await page.locator(`#seat-${c}`).click();
  await expect(page.locator(`#seat-${a}`)).toHaveAttribute("aria-pressed", "true");
  await page.locator(`#seat-${c}`).click(); // deselect
  await expect(page.locator(`#seat-${c}`)).toHaveAttribute("data-state", "available");
  const chips = page.getByRole("list", { name: "Selected seats" });
  await expect(chips.getByText(a, { exact: true })).toBeVisible();
  await expect(chips.getByText(c, { exact: true })).toHaveCount(0);
  const occupied = page.locator('button.seat[data-state="occupied"]').first();
  const occId = (await occupied.getAttribute("data-seat"))!;
  await occupied.click({ force: true });
  await expect(page.getByText(`Seat ${occId} is already booked`).first()).toBeVisible();
  await expect(occupied).toHaveAttribute("data-state", "occupied");
  await expect(page.locator("aside").getByText("2 seats")).toBeVisible();
  await expect(total).toHaveText(/\$\d+\.\d{2}/);
  const seatTotal = await page.locator("aside .sr-only").filter({ hasText: /^\$/ }).first().textContent();

  // 7a. Snacks step: add the featured combo and two large popcorns
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/snacks\//);
  await expect(page.getByText("Perfect for 2 guests")).toBeVisible();
  await page.getByRole("button", { name: "Add combo" }).click();
  const popcorn = page.getByRole("article", { name: "Butter Popcorn" });
  await popcorn.getByRole("radio", { name: /Large/ }).click();
  await popcorn.getByRole("button", { name: "Add Large Butter Popcorn" }).click();
  await popcorn.getByRole("button", { name: "Add one more Large Butter Popcorn" }).click();
  const order = page.getByRole("list", { name: "Snacks in your order" });
  await expect(order.getByText("1 × Movie Night Combo")).toBeVisible();
  await expect(order.getByText("2 × Butter Popcorn (Large)")).toBeVisible();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  // 7b. Checkout with validation, demo approval
  await expect(page).toHaveURL(/\/checkout\//);
  await expect(page.getByText("2 × Butter Popcorn (Large)")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout\//);
  await expect(page.getByText("Seats held for")).toBeVisible();
  await expect(page.getByText(`${a}, ${b}`).or(page.getByText(`${b}, ${a}`))).toBeVisible();
  await expect(page.getByText("Coming soon — not connected")).toHaveCount(2);
  await page.getByRole("button", { name: /\(demo\)/ }).click();
  await expect(page.getByText("Please check your details")).toBeVisible();
  await fillCustomer(page, { name: "Musu Kollie", phone: "+231 77 123 4567", email: "musu@example.com" });
  await expect(page.getByText(seatTotal!).first()).toBeVisible();
  await page.getByRole("radio", { name: "Approve" }).click();
  await page.getByRole("button", { name: /\(demo\)/ }).click();

  // 8. Digital ticket
  await expect(page).toHaveURL(/\/booking\/MCP-/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /You're all set, Musu/ })).toBeVisible();
  const reference = (await page.locator("p.font-mono").first().textContent())!.trim();
  expect(reference).toMatch(/^MCP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(page.getByRole("img", { name: `Ticket QR code for booking ${reference}` })).toBeVisible();
  await expect(page.getByText("DEMO TICKET")).toBeVisible();
  await expect(page.getByText("Snacks — collect at the concession counter")).toBeVisible();
  await expect(page.getByText("1 × Movie Night Combo")).toBeVisible();
  await expect(page.getByText("Monrovia Super Mall, Monrovia, Liberia").first()).toBeVisible();

  // Persistence across refresh
  await page.reload();
  await expect(page.getByText(reference).first()).toBeVisible();
  await expect(page.getByText("Confirmed").first()).toBeVisible();

  // 9. Download ticket (SVG endpoint requires the access key)
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ticket" }).click();
  expect((await download).suggestedFilename()).toContain(reference);
  const ticketUrl = new URL(page.url());
  const svg = await page.request.get(`/api/bookings/${reference}/ticket?k=${ticketUrl.searchParams.get("k")}`);
  expect(svg.headers()["content-type"]).toContain("image/svg+xml");
  expect((await page.request.get(`/api/bookings/${reference}/ticket?k=wrong-key-wrong-key`)).status()).toBe(404);

  // Back navigation must not create a second booking. Checkout replaces itself in history, so
  // Back lands on the snacks step, which sees the completed hold and returns to the same ticket.
  const bookingUrl = page.url();
  await page.goBack();
  await expect(page).toHaveURL(/\/booking\//);
  await expect(page.getByText(reference).first()).toBeVisible();
  await page.goto(bookPath);
  await expect(page.locator(`#seat-${a}`)).toHaveAttribute("data-state", "occupied");
  await expect(page.locator(`#seat-${b}`)).toHaveAttribute("data-state", "occupied");
  await page.goto(bookingUrl);
  await expect(page.getByText("Confirmed").first()).toBeVisible();

  // My Tickets lookup with contact verification
  await page.goto("/my-tickets");
  await expect(page.getByText(reference)).toBeVisible(); // saved on this device
  await page.getByLabel("Booking reference").fill(reference);
  await page.getByLabel("Phone number or email").fill("someone.else@example.com");
  await page.getByRole("button", { name: "Find my tickets" }).click();
  await expect(page.getByText(/couldn't find a booking/)).toBeVisible();
  await page.getByLabel("Phone number or email").fill("0771234567");
  await page.getByRole("button", { name: "Find my tickets" }).click();
  await expect(page).toHaveURL(new RegExp(`/booking/${reference}`));

  // 10–11. Staff validation: admit once, reject the repeat
  await login(page, STAFF, "/staff");
  await expect(page).toHaveURL(/\/staff/);
  await page.getByLabel(/Manual entry/).fill(reference);
  await page.getByRole("button", { name: "Validate" }).click();
  // The booking is for tomorrow: refused unless a manager overrides.
  await expect(page.locator('[data-outcome="not_today"]')).toBeVisible();
  await page.getByRole("button", { name: "Admit anyway (manager override)" }).click();
  await expect(page.locator('[data-outcome="admitted"]')).toBeVisible();
  await expect(page.locator("[data-outcome]").getByText("Valid — admit")).toBeVisible();
  await expect(page.locator("[data-outcome]").getByText("Pre-ordered snacks")).toBeVisible();
  await page.getByRole("button", { name: "Scan next" }).click();
  await page.getByLabel(/Manual entry/).fill(reference);
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.locator('[data-outcome="already_redeemed"]')).toBeVisible();
  await page.getByRole("button", { name: "Scan next" }).click();
  await page.getByLabel(/Manual entry/).fill("MCP1:this-is-not-a-real-ticket-token-000");
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.locator('[data-outcome="invalid"]')).toBeVisible();

  // Staff accounts cannot open management
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin&denied=1/);

  // 12. Admin sees the same booking
  await login(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.goto(`/admin/bookings?q=${reference}`);
  await expect(page.getByRole("button", { name: reference })).toBeVisible();
  await expect(page.locator("tbody").getByText("Admitted")).toBeVisible();

  // The only expected browser error is the deliberate wrong-contact lookup (HTTP 404) above.
  const unexpected = errors.filter((e) => !(e.includes("status of 404") && e.includes("/api/lookup")));
  expect(unexpected, unexpected.join("\n")).toEqual([]);
});

test("declined demo payment keeps the hold and can be retried; pending payment can be confirmed", async ({ page }) => {
  const screeningId = await pickScreening(page, 1);
  await chooseSeats(page, screeningId, 1);
  await toCheckout(page);
  await fillCustomer(page);
  await page.getByRole("radio", { name: "Decline" }).click();
  await page.getByRole("button", { name: /\(demo\)/ }).click();
  await expect(page.getByText("Payment not completed")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout\//);
  await page.getByRole("radio", { name: "Approve" }).click();
  await page.getByRole("button", { name: /Retry demo payment/ }).click();
  await expect(page).toHaveURL(/\/booking\//, { timeout: 15_000 });
  await expect(page.getByText("Booking confirmed")).toBeVisible();

  // Pending → confirm via the simulated gateway
  await chooseSeats(page, screeningId, 1);
  await toCheckout(page);
  await fillCustomer(page);
  await page.getByRole("radio", { name: "Pending" }).click();
  await page.getByRole("button", { name: /\(demo\)/ }).click();
  await expect(page.getByRole("heading", { name: "Waiting for payment confirmation" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("QR code appears once payment is confirmed")).toBeVisible();
  await page.getByRole("button", { name: "Confirm payment" }).click();
  await expect(page.getByText("Booking confirmed")).toBeVisible();
});

test("pay at cinema: unpaid at the door, collect payment, then admit", async ({ page }) => {
  const screeningId = await pickScreening(page, 2);
  await chooseSeats(page, screeningId, 2);
  await toCheckout(page);
  await fillCustomer(page);
  await page.getByRole("radio", { name: /Pay at Cinema/ }).click();
  await page.getByRole("button", { name: /Reserve — pay at cinema/ }).click();
  await expect(page.getByText("Seats reserved · Pay at cinema")).toBeVisible({ timeout: 15_000 });
  const reference = (await page.locator("p.font-mono").first().textContent())!.trim();

  await login(page, STAFF, "/staff");
  await page.getByLabel(/Manual entry/).fill(reference);
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.locator('[data-outcome="not_today"]')).toBeVisible();
  await page.getByRole("button", { name: "Admit anyway (manager override)" }).click();
  await expect(page.locator('[data-outcome="unpaid"]')).toBeVisible();
  await page.getByRole("button", { name: /Collect .* & admit/ }).click();
  await expect(page.locator('[data-outcome="admitted"]')).toBeVisible();
});

test("cancel and release: customer cancels a reservation and its seats become free", async ({ page }) => {
  const screeningId = await pickScreening(page, 3);
  const seats = await chooseSeats(page, screeningId, 1);
  await toCheckout(page);
  await fillCustomer(page);
  await page.getByRole("radio", { name: /Pay at Cinema/ }).click();
  await page.getByRole("button", { name: /Reserve — pay at cinema/ }).click();
  await expect(page.getByText("Seats reserved · Pay at cinema")).toBeVisible({ timeout: 15_000 });
  let states = (await (await page.request.get(`/api/screenings/${screeningId}/seats`)).json()).states;
  expect(states[seats[0]]).toBe("occupied");
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  await page.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByRole("heading", { name: "This booking is no longer active" })).toBeVisible();
  states = (await (await page.request.get(`/api/screenings/${screeningId}/seats`)).json()).states;
  expect(states[seats[0]]).toBeUndefined();
});

test("releasing a hold from checkout frees the seats immediately", async ({ page }) => {
  const screeningId = await pickScreening(page, 4);
  const seats = await chooseSeats(page, screeningId, 2);
  await toCheckout(page);
  await expect(page.getByText("Seats held for")).toBeVisible();
  let states = (await (await page.request.get(`/api/screenings/${screeningId}/seats`)).json()).states;
  expect(states[seats[0]]).toBe("held");
  await page.getByRole("button", { name: "Cancel and release seats" }).click();
  await expect(page).toHaveURL(/\/movies\//);
  states = (await (await page.request.get(`/api/screenings/${screeningId}/seats`)).json()).states;
  expect(states[seats[0]]).toBeUndefined();
});

test("how many tickets → best available seats, adjustable, then continue", async ({ page }) => {
  const screeningId = await pickScreening(page, 5);
  await page.goto(`/book/${screeningId}`, { waitUntil: "networkidle" });
  await expect(page.getByText("How many tickets?")).toBeVisible();
  await page.getByRole("button", { name: "3 tickets" }).click();

  const selected = page.locator('button.seat[data-state="selected"]');
  await expect(selected).toHaveCount(3);
  const ids = await selected.evaluateAll((els) => els.map((e) => e.getAttribute("data-seat")!));
  // Same row, consecutive numbers (seated together).
  expect(new Set(ids.map((id) => id.replace(/\d+$/, ""))).size).toBe(1);
  const nums = ids.map((id) => Number(id.replace(/^[A-Z]+/, ""))).sort((a, b) => a - b);
  expect(nums[2] - nums[0]).toBe(2);
  await expect(page.getByText(/Best available: .* seated together/)).toBeVisible();

  // Stepper re-picks while the selection is still the suggestion.
  await page.getByRole("button", { name: "One more ticket" }).click();
  await expect(selected).toHaveCount(4);

  // A manual change keeps the customer's choice and shows progress toward the count.
  await selected.first().click();
  await expect(selected).toHaveCount(3);
  await expect(page.locator("aside").getByText("Select 1 more seat")).toBeVisible();

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/snacks\//);
  await expect(page.getByText("Perfect for 3 guests")).toBeVisible();
});
