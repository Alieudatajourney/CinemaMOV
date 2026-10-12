# Monrovia Cinema Plus — client presentation script (3–5 minutes)

**Before the meeting (5 minutes)**

1. `npm run build && npm start` (or `npm run dev`), then open `http://localhost:3000`.
2. Sign in as admin → **Settings → Reset demo data** (type `RESET`). This gives a fresh five-day schedule starting today.
3. Sign out. Keep two browser tabs ready: **Tab A** for the customer (normal window) and **Tab B** for staff/admin (a private window works well).
4. Optional: have a phone ready to open the ticket, or to scan it with the staff camera.
5. **Internet is needed for trailers** (official YouTube embeds). Film posters, backdrops and snack photos are stored locally and work offline. Play one trailer before the meeting to check the venue's connection.

---

### 1. Homepage (≈30 s)
> "This is Monrovia Cinema Plus at Monrovia Super Mall. A customer lands on a cinematic homepage: this season's real releases, today's showtimes and what's coming soon. The films are real; the showtimes and prices are sample data for the demo."

- Let the hero rotate once. Point out the **Book tickets** button.
- Scroll to **Now Showing**. Tap a **date shortcut** (e.g. *Tomorrow*), type in **Search** ("lions"), then clear it.

### 2. Film and showtime (≈30 s)
- Open a film card → details page: synopsis, cast, runtime, rating and **Watch trailer**, which plays the studio's official trailer.
- > "Dates with no shows are greyed out; each showtime shows the hall, format, prices and seats left."
- Choose an **evening showtime in the Grand Hall**.

### 3. Seat selection: the signature moment (≈60 s)
> "Here's the auditorium itself: the curved screen, the aisles, and VIP recliners at the back."

- The page asks **"How many tickets?"**. Tap **2**: the best seats together pop in, already chosen.
  > "Most people just want two good seats together, so it's one tap."
- Use **+** to change it to 3; the suggestion updates. Then show manual control: tap a different seat and a **VIP** seat. Watch the **total count up** and the **seat chips animate in**.
- Tap one again to **deselect** it.
- Tap an **occupied** seat (×): it shakes and explains *"already booked"*. Point out a **held** seat (striped, clock): *"another customer is checking out right now."*
- Mention: keyboard accessible, reduced-motion friendly, and on a phone the summary becomes a sticky bottom bar.
- **Continue to checkout.**

### 3b. Snacks & drinks (≈20 s)
> "Before paying, guests can pre-order snacks and skip the concession queue."

- Point out the **Movie Night Combo** suggested for the party size. Add it, switch Butter Popcorn to **Large** and add one, then watch the order total update.
- > "It's optional: one tap on **Skip snacks** goes straight to payment."
- **Continue to payment.** The snacks appear later on the ticket and on the staff check-in screen.

### 4. Checkout (≈45 s)
> "The seats are now held for eight minutes, so no one else can take them. The price is recalculated by the system, not trusted from the browser."

- Point out the **countdown**, the itemised total, and the **payment options**: Pay at Cinema, the clearly-labelled **DEMO** online payment, and Orange Money / MTN MoMo shown as *Coming soon — not connected*.
- Press Pay once with empty fields to show **validation**. Enter a name and a Liberian mobile number (e.g. `0770 123 456`).
- Optional, 15 s: choose **Decline** → *Payment not completed*, seats still held → **Retry** with **Approve**.
- Otherwise choose **Approve** → **Pay (demo)**.

### 5. Digital ticket (≈30 s)
- Success animation → **ticket with QR code**, booking reference, seats, hall, Monrovia time, and the **DEMO** label.
- > "The QR holds only an unguessable token, no personal or payment data."
- Click **Print ticket** (print preview shows just the ticket) or **Download ticket**. Mention **My Tickets**: customers can retrieve a booking with the reference plus their phone number.

### 6. Staff check-in (≈30 s)
- **Tab B** → `/staff` → sign in as **Box office** (or admin).
- Type the booking reference (or scan the QR from the phone) → big green **Valid — admit**, with seats, screening and any pre-ordered snacks.
  - If you booked a showtime on a **later day**, the screen correctly says **Different day**: tickets can't be used up early. Tap **Admit anyway (manager override)** to continue. For the smoothest demo, book a showtime later **today**.
- **Scan next** → enter the same code again → red **Already redeemed**, showing when and by whom.
- > "Each ticket gets in exactly once, checked against the real booking record rather than just the QR format."

### 7. Management (≈45 s)
- Go to **Management** (admin account).
- **Overview:** today's bookings, tickets sold, demo revenue, occupancy, revenue for the last 7 days, upcoming screenings and recent bookings. The booking just made appears at the top.
- **Bookings:** search the reference → open it → show the seat breakdown and *Admitted*. (Cancellation needs explicit confirmation and releases seats immediately.)
- **Screenings:** briefly show **New screening** and mention overlap protection per auditorium.
- **Settings:** booking rules, demo payment behaviour, and live **seat layout editing** with preview.

### Close (≈15 s)
> "Everything you saw, from browsing to the door to the dashboard, runs on the same booking records. The next steps toward launch are real payment integration with Orange Money and MTN MoMo, a production database, and verified cinema details. Those are listed in our production checklist."

---

**If something goes wrong:** if a showtime has closed (late in the evening), pick tomorrow's date. If the schedule looks empty, reset the demo data in Settings. If the camera isn't available, use manual entry, which is the reliable path anyway.
