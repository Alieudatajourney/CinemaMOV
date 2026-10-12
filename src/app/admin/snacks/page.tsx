import type { Metadata } from "next";
import { requirePageRole } from "@/server/auth";
import { readDb } from "@/server/store";
import { AdminHeader } from "@/components/admin/ui";
import { SnackMenuManager } from "@/components/admin/SnackMenuManager";

export const metadata: Metadata = { title: "Snacks" };

export default async function AdminSnacks() {
  await requirePageRole(["admin"], "/admin/snacks");
  const { menu, sold } = await readDb((db) => {
    const sold: Record<string, number> = {};
    for (const b of db.bookings) {
      if (b.paymentStatus !== "paid") continue;
      for (const c of b.concessions ?? []) sold[c.itemId] = (sold[c.itemId] ?? 0) + c.qty;
    }
    return { menu: db.concessions, sold };
  });
  return (
    <>
      <AdminHeader
        eyebrow="Concessions"
        title="Snacks & drinks"
        description="The menu customers see between seat selection and payment. Prices are sample values; changes apply to new orders only."
      />
      <SnackMenuManager menu={menu} sold={sold} />
    </>
  );
}
