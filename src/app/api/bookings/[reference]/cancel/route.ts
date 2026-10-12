import { z } from "zod";
import { body, handle } from "@/server/http";
import { transact } from "@/server/store";
import { bookingView, cancelByCustomer } from "@/server/core/booking";

const input = z.object({ accessKey: z.string().min(10).max(200) });

export const POST = handle<{ params: Promise<{ reference: string }> }>(async (req, { params }) => {
  const { reference } = await params;
  const { accessKey } = await body(req, input);
  return transact((db, now) => bookingView(db, cancelByCustomer(db, now, reference, accessKey)));
});
