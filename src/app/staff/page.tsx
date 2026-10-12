import type { Metadata } from "next";
import { TicketValidator } from "@/components/staff/TicketValidator";
import { requirePageRole } from "@/server/auth";

export const metadata: Metadata = { title: "Staff check-in", robots: { index: false } };

export default async function StaffPage() {
  await requirePageRole(["staff", "admin"], "/staff");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <p className="eyebrow">Entrance</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">Ticket check-in</h1>
      <p className="mb-8 mt-2 max-w-2xl text-fg-muted">Scan or enter a ticket. Valid tickets are admitted once; repeat scans are rejected.</p>
      <TicketValidator />
    </div>
  );
}
