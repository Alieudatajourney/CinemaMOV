import type { Metadata } from "next";
import { requirePageRole } from "@/server/auth";
import { readDb } from "@/server/store";
import { AdminHeader } from "@/components/admin/ui";
import { SettingsForm, AuditoriumEditor, ResetDemo } from "@/components/admin/Settings";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettings() {
  await requirePageRole(["admin"], "/admin/settings");
  const { settings, auditoriums, seededAt } = await readDb((db) => ({ settings: db.settings, auditoriums: db.auditoriums, seededAt: db.seededAt }));
  return (
    <>
      <AdminHeader eyebrow="Configuration" title="Settings" description="Cinema details, booking rules, demo payment behaviour and auditorium layouts." />
      <div className="space-y-8">
        <SettingsForm settings={settings} />
        {auditoriums.map((a) => (
          <AuditoriumEditor key={a.id} auditorium={a} />
        ))}
        <ResetDemo seededAt={seededAt} />
      </div>
    </>
  );
}
