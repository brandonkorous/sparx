'use client';

// What a customer sees at a booking link (docs/144 §12).
//
// THREE STATES, and two of them are the reason this is not a 404:
//
//   · taking bookings — who they are meeting, how long, and the real widget.
//   · no longer in use — the link was retired. Say so, and say what to do.
//   · we cannot find it — a mistyped or truncated address.
//
// The booking itself is the SAME widget the storefront's /book pages use, on the
// same service, hitting the same endpoints. Nothing about scheduling is
// reimplemented here; the link only decides which service and adds the sentence
// above it. Afterwards it tells the CRM the booking came through this link,
// which is what puts the meeting on the contact's timeline.

import { useState } from 'react';

import { BookingWidget } from '@/components/booking/booking-widget';
import type { PublicService } from '@/lib/scheduling';
import type { PublicMeetingLink } from '@/lib/scheduling';
import { attachBooking } from '@/lib/meeting-link-client';

export function MeetingPanel({
  tenantSlug,
  slug,
  link,
  service,
}: {
  tenantSlug: string;
  slug: string;
  link: PublicMeetingLink | null;
  service: PublicService | null;
}) {
  const [attached, setAttached] = useState(false);

  if (link === null) {
    return (
      <div className="card border-base-300 grid gap-2 border p-8 text-center">
        <h1 className="text-base-content text-2xl font-semibold">
          We could not find that booking link
        </h1>
        <p className="text-base-content">
          Check the address in the email you were sent — links are sometimes cut short on their way
          through a message. If it keeps happening, reply and ask for a fresh one.
        </p>
      </div>
    );
  }

  // A retired link, or one whose service has since been removed. Both are the
  // same thing to the person holding it: it worked once and does not now.
  if (!link.active || service === null) {
    return (
      <div className="card border-base-300 grid gap-2 border p-8 text-center">
        <h1 className="text-base-content text-2xl font-semibold">
          This booking link is no longer in use
        </h1>
        <p className="text-base-content">
          {link.hostName === ''
            ? 'Reply to the email you received and ask for a current one — whoever sent it can still book you in.'
            : `Reply to the email ${link.hostName} sent you and ask for a current one — they can still book you in.`}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 className="text-base-content text-2xl font-semibold">{link.name}</h1>
        <p className="text-base-content">
          {link.hostName === ''
            ? `${String(link.durationMinutes)} minutes. Pick a time that suits you.`
            : `${String(link.durationMinutes)} minutes with ${link.hostName}. Pick a time that suits you.`}
        </p>
        {link.description !== null && link.description !== '' ? (
          <p className="text-base-content">{link.description}</p>
        ) : null}
      </header>

      <BookingWidget
        tenantSlug={tenantSlug}
        service={service}
        onBooked={(bookingId) => {
          // Fire and forget, once. The meeting is already booked; this only adds
          // the note on the contact's record, and its failure is not the
          // customer's problem to hear about.
          if (attached) return;
          setAttached(true);
          void attachBooking(tenantSlug, slug, bookingId);
        }}
      />
    </div>
  );
}
