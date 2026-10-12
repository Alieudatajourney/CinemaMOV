import type { Metadata } from "next";
import { MyTickets } from "@/components/ticket/MyTickets";

export const metadata: Metadata = { title: "My Tickets" };

export default function MyTicketsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <p className="eyebrow">Your bookings</p>
      <h1 className="font-display mt-2 text-5xl sm:text-6xl">My Tickets</h1>
      <p className="mb-10 mt-3 max-w-2xl text-fg-muted">Retrieve a booking at any time with its reference, view your digital ticket, or print it again.</p>
      <MyTickets />
    </div>
  );
}
