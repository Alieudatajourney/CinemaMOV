import { z } from "zod";
import { body, handle } from "@/server/http";
import { transact } from "@/server/store";
import { bookingView, resolvePendingPayment } from "@/server/core/booking";

const input = z.object({ accessKey: z.string().min(10).max(200), action: z.enum(["confirm", "fail"]) });

/** DEMO ONLY: simulates the payment gateway's asynchronous callback for a pending payment. */
export const POST = handle<{ params: Promise<{ reference: string }> }>(async (req, { params }) => {
  const { reference } = await params;
  const { accessKey, action } = await body(req, input);
  return transact((db, now) => bookingView(db, resolvePendingPayment(db, now, reference, accessKey, action)));
});
