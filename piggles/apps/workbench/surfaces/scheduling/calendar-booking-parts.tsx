'use client';

// The pieces the diary's quick-look modal is built from. Split out of
// calendar-booking-modal.tsx so that file states the SHAPE of the modal and this
// one states what each block looks like (RULE #0.5).

import { Badge, DialogTitle, Heading, Text } from '@wizeworks/silicaui-react';

import {
  bookingResourceLabel,
  bookingStateMeta,
  bookingTypeLabel,
  bookingWhoLabel,
  formatClock,
  formatWhen,
  type Booking,
} from './bookings-data';

/** A labelled group inside the modal.
 *
 *  The full pane groups with `FormSection`, whose `card bg-base-100` box lifts off
 *  the pane's recessed `base-200` shell. A dialog is itself `base-100`, so that same
 *  card lands box-on-box — card-in-card, the patchwork look. This is the flat
 *  equivalent: the SAME heading rank and underline rhythm the pane uses (so the two
 *  still read as one feature), minus the box, matching the gold-standard modal's
 *  flat sections. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
        <Heading level={2} className="text-lg font-semibold">
          {title}
        </Heading>
        {description ? <Text className="text-sm">{description}</Text> : null}
      </div>
      {children}
    </section>
  );
}

/** A booking's length in plain words, e.g. "45 min" or "1 hr 30 min". */
function durationLabel(booking: Booking): string {
  const minutes = Math.round(
    (new Date(booking.endAt).getTime() - new Date(booking.startAt).getTime()) / 60000
  );
  if (minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  if (rest === 0) return `${String(hours)} hr`;
  return `${String(hours)} hr ${String(rest)} min`;
}

/** Identity, when, who, and where it stands. The same block the full pane opens
 *  with, so the two read as one feature.
 *
 *  Who comes from `bookingWhoLabel`, which is the ladder the pane and the list
 *  both use: a walk-in's written-down name counts as knowing who it is for. This
 *  read the customer record alone, so the two bookings taken by name in act 10
 *  were "For" nobody here while the rest of the app named them (issue 135). */
export function ModalHeader({ booking }: { booking: Booking }) {
  const state = bookingStateMeta(booking.status);
  const duration = durationLabel(booking);
  const who = bookingWhoLabel(booking);
  const facts = [
    bookingTypeLabel(booking.bookingType),
    `With ${bookingResourceLabel(booking)}`,
    `For ${who}`,
  ].join(' · ');
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <DialogTitle className="text-xl font-semibold break-words">
          {booking.service.name}
        </DialogTitle>
        <Text className="text-base">
          {formatWhen(booking.startAt, booking.timezone)} –{' '}
          {formatClock(booking.endAt, booking.timezone)}
          {duration ? ` · ${duration}` : ''}
        </Text>
        <Text className="text-sm break-words">{facts}</Text>
      </div>
      <Badge color={state.tone} variant="soft" size="sm" className="shrink-0">
        {state.label}
      </Badge>
    </div>
  );
}

/** The one primary next step for where this booking stands. Usually just one
 *  applies — a single, module-colored action, never a rainbow row. */
