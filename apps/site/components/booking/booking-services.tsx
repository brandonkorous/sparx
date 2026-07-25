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
      <header className="mb-7 grid gap-1.5">
        <h1 className="text-base-content text-4xl font-semibold tracking-tight">Book with us</h1>
        <p className="text-base-content">
          Choose a service to see open times and reserve your spot.
        </p>
      </header>

      {services.length === 0 ? (
        <EmptyState
          icon="🗓"
          title="No services are bookable yet"
          description="Once services are open for online booking, they'll appear here."
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4 p-0">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/book/${s.id}`}
                className="card border-base-300 hover:border-primary flex h-full flex-col gap-1.5 border p-5 no-underline transition-colors"
              >
                <span className="text-base-content text-2xl font-semibold">{s.name}</span>
                {s.description ? <span className="text-base-content">{s.description}</span> : null}
                <span className="text-base-content flex gap-4 text-sm font-medium">
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
