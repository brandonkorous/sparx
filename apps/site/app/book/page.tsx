import { notFound } from 'next/navigation';
import Link from 'next/link';

import { listBookableServices } from '../../lib/scheduling';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Book an appointment' };

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

export default async function BookIndexPage() {
  const services = await listBookableServices();
  if (services.length === 0) notFound();

  return (
    <section className="st-container st-section">
      <header className="st-booking__header">
        <h1 className="st-h1">Book with us</h1>
        <p className="st-muted">Choose a service to see open times and reserve your spot.</p>
      </header>

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
    </section>
  );
}
