import { clsx } from "clsx";
import type { BookingStatus, PaymentStatus } from "@/lib/types";

export function RatingBadge({ rating, className }: { rating: string; className?: string }) {
  return (
    <span
      className={clsx("inline-flex h-6 min-w-8 items-center justify-center rounded-md border border-white/30 px-1.5 text-[0.72rem] font-bold tracking-wide text-fg", className)}
      title={`Age rating ${rating}`}
    >
      {rating}
    </span>
  );
}

const BOOKING_STYLE: Record<BookingStatus, { label: string; cls: string }> = {
  confirmed: { label: "Confirmed", cls: "border-success-400/40 bg-success-700/50 text-success-400" },
  reserved: { label: "Reserved · Pay at cinema", cls: "border-gold-400/40 bg-gold-700/30 text-gold-300" },
  pending_payment: { label: "Payment pending", cls: "border-warning-400/40 bg-warning-700/50 text-warning-400" },
  cancelled: { label: "Cancelled", cls: "border-danger-400/40 bg-danger-700/50 text-danger-400" },
  expired: { label: "Expired", cls: "border-white/15 bg-white/5 text-fg-subtle" },
};

export function BookingStatusBadge({ status, redeemed }: { status: BookingStatus; redeemed?: boolean }) {
  const s = BOOKING_STYLE[status];
  return (
    <span className={clsx("chip", s.cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {redeemed ? "Admitted" : s.label}
    </span>
  );
}

const PAY_LABEL: Record<PaymentStatus, string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded (demo)",
  void: "Void",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const cls =
    status === "paid"
      ? "text-success-400 border-success-400/30"
      : status === "pending" || status === "unpaid"
        ? "text-warning-400 border-warning-400/30"
        : status === "failed"
          ? "text-danger-400 border-danger-400/30"
          : "text-fg-subtle";
  return <span className={clsx("chip", cls)}>{PAY_LABEL[status]}</span>;
}

export function DemoBadge({ children = "DEMO" }: { children?: React.ReactNode }) {
  return <span className="demo-badge">{children}</span>;
}
