// The bookable-services index as ONE self-contained server component — the pinned
// `scheduling.services` core (docs/122). It lists every service open for online booking,
// each linking to /book/[serviceId] (the live time-picker, a per-record template). The
// /book route drops it into an editable silica shell via a host node, so a tenant
// surrounds the list (intro copy, policies, trust badges) without touching the booking
// logic. Self-contained — `listBookableServices` resolves the tenant from the request
// host, so the core needs nothing from route context.
//
// Extracted from the old app/book/page.tsx body. Unlike that route (which 404'd when no
// service was bookable), the editable shell always renders: an empty state stands in when
// scheduling is on but nothing is bookable yet, so the tenant can style the page first.

import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { listBookableServices } from '@/lib/scheduling';

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export async function BookingServices() {
  const services = await listBookableServices();

  return (
    <>
      <header className="st-booking__header">
        <h1 className="st-h1">Book with us</h1>
        <p className="st-muted">Choose a service to see open times and reserve your spot.</p>
      </header>

      {services.length === 0 ? (
        <EmptyState
          icon="🗓"
          title="No services are bookable yet"
          description="Once services are open for online booking, they'll appear here."
        />
      ) : (
        <ul className="st-booking__service-list">
          {services.map((s) => (
            <li key={s.id}>
              <Link href={`/book/${s.id}`} className="st-card st-booking__service-card">
                <span className="st-booking__service-name st-h3">{s.name}</span>
                {s.description ? <span className="st-muted">{s.description}</span> : null}
                <span className="st-booking__service-meta">
                  <span>{duration(s.durationMinutes)}</span>
                  {s.priceCents > 0 ? <span>{money(s.priceCents, s.currency)}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
