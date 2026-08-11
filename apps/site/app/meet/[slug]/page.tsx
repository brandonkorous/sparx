// The page a customer books a meeting on (docs/144 §12).
//
// A booking link is an ADDRESS, not a second booking system. Everything about
// how long the meeting is, when the host is free, how much notice they need and
// what happens on a cancellation belongs to the bookable service, and this page
// renders the same widget `/book/[serviceId]` does against that same service.
// What the link adds is a name a customer recognises, whose calendar it fills,
// and the fact that the booking lands on the contact's timeline rather than only
// in a calendar.
//
// Like the signing page and unlike the rest of the storefront, this is NOT an
// editable silica shell. It is reached only from a link somebody was sent, it
// exists for exactly one action, and a tenant restyling it could only get in the
// way of that action.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getBookableService, getMeetingLink } from '@/lib/scheduling';
import { resolveSite } from '@/lib/site-context';
import { MeetingPanel } from './meeting-panel';

// Availability is the one storefront read where a stale answer is visible to the
// customer as a slot they can pick and not actually get — the same reason /book
// keeps this.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Book a time',
  // A booking link belongs in an email signature, not in a search index: the
  // tenant chooses who gets it, and an indexed one is a calendar anybody can
  // fill.
  robots: { index: false, follow: false },
};

export default async function MeetPage({ params }: { params: Promise<{ slug: string }> }) {
  const site = await resolveSite();
  if (!site) notFound();
  const { slug } = await params;

  // Both resolved here rather than in the browser, so the page arrives knowing
  // what it is — a link that has been retired should not flash a booking form
  // first, and a booking form is the one thing on this page anybody came for.
  const link = await getMeetingLink(slug);
  const service = link ? await getBookableService(link.serviceId) : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <MeetingPanel tenantSlug={site.slug} slug={slug} link={link} service={service} />
    </div>
  );
}
