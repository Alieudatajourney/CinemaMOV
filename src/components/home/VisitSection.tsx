import { Clock, MapPin, Mail, Phone, Car, Accessibility } from "lucide-react";
import type { CinemaSettings } from "@/lib/types";

export function VisitSection({ settings }: { settings: CinemaSettings }) {
  return (
    <section id="visit" aria-labelledby="visit-title" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
      <div className="surface relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />
        <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow">Visit us</p>
            <h2 id="visit-title" className="font-display mt-3 text-4xl sm:text-5xl">
              {settings.name}
            </h2>
            <p className="mt-3 text-lg text-fg-muted">{settings.addressLine}</p>
            <p className="mt-6 max-w-lg leading-relaxed text-fg-muted">
              Find us inside Monrovia Super Mall. Collect Pay-at-Cinema bookings at the box office, or go straight to the entrance with your
              digital ticket.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {settings.mapUrl && (
                <a href={settings.mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  <MapPin className="h-4 w-4" aria-hidden /> Open map
                </a>
              )}
              <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`} className="btn btn-ghost">
                <Phone className="h-4 w-4" aria-hidden /> Call the box office
              </a>
            </div>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info icon={<MapPin className="h-5 w-5" />} label="Location" value={settings.addressLine} />
            <Info icon={<Clock className="h-5 w-5" />} label="Opening hours" value={settings.hours} />
            <Info icon={<Phone className="h-5 w-5" />} label="Phone" value={settings.phone} />
            <Info icon={<Mail className="h-5 w-5" />} label="Email" value={settings.email} />
            <Info icon={<Car className="h-5 w-5" />} label="Getting here" value="Mall parking available (placeholder)" />
            <Info icon={<Accessibility className="h-5 w-5" />} label="Accessibility" value="Wheelchair spaces in every auditorium" />
          </dl>
        </div>
        {settings.contactIsPlaceholder && (
          <p className="border-t border-white/[0.06] px-6 py-3 text-xs text-warning-400 sm:px-10">
            Contact details, hours and parking information are configurable placeholders and have not been verified with the cinema.
          </p>
        )}
      </div>
    </section>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-ink-900/60 p-4">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-fg-subtle">
        <span className="text-gold-400" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-2 text-sm text-fg">{value}</dd>
    </div>
  );
}
