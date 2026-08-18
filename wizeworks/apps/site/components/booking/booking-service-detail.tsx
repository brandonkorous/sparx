// The bookable-service DETAIL experience as ONE self-contained server component — the
// pinned `scheduling.service-detail` core (docs/122). It shows one service's header and
// its LIVE time-picker (the interactive booking widget). The /book/[serviceId] route drops
// it into an editable silica shell via a host node, so a tenant surrounds the booking flow
// (policies, prep instructions, trust badges) without touching the widget. Self-contained:
// given the service id, it resolves the service + tenant itself, so the core needs only the
// id the route passes through host context.
//
// Extracted from the old app/book/[serviceId]/page.tsx body. The route still 404s for an
// unknown/off-module service; this core renders a plain notice if the id ever resolves to
// nothing (defensive — the route guards it first).

import Link from 'next/link';

import { activeTenantSlug, getBookableService } from '@/lib/scheduling';
import { BookingWidget } from '@/components/booking/booking-widget';
import { ClassBookingWidget } from '@/components/booking/class-booking-widget';

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export async function BookingServiceDetail({ serviceId }: { serviceId: string }) {
  const [service, tenantSlug] = await Promise.all([
    getBookableService(serviceId),
    activeTenantSlug(),
  ]);

  if (!service || !tenantSlug) {
    return (
      <div className="grid max-w-[40rem] gap-6">
        <Link href="/book" className="link link-primary text-sm">
          ← All services
        </Link>
        <p className="text-base-content">This service isn’t available for booking right now.</p>
      </div>
    );
  }

  return (
    <div className="grid max-w-[40rem] gap-6">
      <Link href="/book" className="link link-primary text-sm">
        ← All services
      </Link>
      <header className="grid gap-1.5">
        <h1 className="text-base-content text-4xl font-semibold tracking-tight">{service.name}</h1>
        <p className="text-base-content flex gap-4 text-sm font-medium">
          <span>{duration(service.durationMinutes)}</span>
          {service.priceCents > 0 ? (
            <span>{money(service.priceCents, service.currency)}</span>
          ) : null}
        </p>
        {service.description ? <p className="text-base-content">{service.description}</p> : null}
      </header>

      {service.bookingType === 'class' ? (
        <ClassBookingWidget tenantSlug={tenantSlug} service={service} />
      ) : (
        <BookingWidget tenantSlug={tenantSlug} service={service} />
      )}
    </div>
  );
}
