import { notFound } from 'next/navigation';
import Link from 'next/link';

import { activeTenantSlug, getBookableService } from '../../../lib/scheduling';
import { BookingWidget } from '../../../components/booking/booking-widget';

export const dynamic = 'force-dynamic';

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

interface Props {
  params: Promise<{ serviceId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { serviceId } = await params;
  const service = await getBookableService(serviceId);
  return { title: service ? `Book ${service.name}` : 'Book an appointment' };
}

export default async function BookServicePage({ params }: Props) {
  const { serviceId } = await params;
  const [service, tenantSlug] = await Promise.all([
    getBookableService(serviceId),
    activeTenantSlug(),
  ]);
  if (!service || !tenantSlug) notFound();

  return (
    <section className="st-container st-section">
      <div className="st-booking__detail">
        <Link href="/book" className="st-link st-booking__back">
          ← All services
        </Link>
        <header className="st-booking__header">
          <h1 className="st-h1">{service.name}</h1>
          <p className="st-booking__service-meta st-muted">
            <span>{duration(service.durationMinutes)}</span>
            {service.priceCents > 0 ? (
              <span>{money(service.priceCents, service.currency)}</span>
            ) : null}
          </p>
          {service.description ? <p className="st-muted">{service.description}</p> : null}
        </header>

        <BookingWidget tenantSlug={tenantSlug} service={service} />
      </div>
    </section>
  );
}
