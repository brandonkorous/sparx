'use client';

// THE CHANGE HISTORY — one booking's story, in plain words.
//
// A read-only log of everything that has happened to a booking: taken, confirmed,
// moved (with the old time it moved FROM, which the booking row no longer keeps),
// edited, cancelled. It reads the audit trail through `useBookingTimeline` and
// renders each entry with `describeTimelineEntry`, so the wording lives in the
// data layer and this file is only presentation.
//
// It is the SAME component in two homes — the quick-look modal opened from the
// diary, and the full booking pane — so the two can never drift apart. Neither
// place supplies its own heading; each wraps this in its own section chrome.
//
// Newest-first: the most recent change is the one someone opening the history is
// almost always looking for. Nothing here is ever fabricated — an empty trail is
// a real empty state, not a seeded "created" line.

import { Button, Text } from '@wizeworks/silicaui-react';
import {
  describeTimelineEntry,
  formatRelativeTime,
  timelineActorLabel,
  useBookingTimeline,
} from './bookings-data';

interface BookingTimelineProps {
  bookingId: string;
  /** The booking's own time zone — moved-time details are shown in it. */
  timezone?: string | null;
}

export function BookingTimeline({ bookingId, timezone }: BookingTimelineProps) {
  const { data, isPending, isError, refetch } = useBookingTimeline(bookingId);

  if (isPending) {
    return (
      <Text className="text-sm" role="status">
        Loading the history…
      </Text>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Text className="text-sm">
          The history could not be loaded just now. Nothing about the booking has changed.
        </Text>
        <Button
          size="sm"
          variant="soft"
          color="neutral"
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  // The server returns oldest-first; a history reads newest-first.
  const entries = [...(data ?? [])].reverse();

  if (entries.length === 0) {
    return (
      <Text className="text-sm">
        No changes yet. Everything that happens to this booking — confirming it, moving it,
        cancelling it — is recorded here.
      </Text>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) => {
        const { label, detail } = describeTimelineEntry(entry, timezone);
        return (
          <li key={entry.id} className="flex gap-3">
            {/* A quiet marker so the log scans as a column of events, not a
                paragraph. Decorative — the words carry the meaning. */}
            <span className="bg-base-300 mt-2 size-2 shrink-0 rounded-full" aria-hidden />
            <div className="flex min-w-0 flex-col gap-0.5">
              <Text className="font-medium">{label}</Text>
              {detail ? <Text className="break-words">{detail}</Text> : null}
              <Text className="text-sm">
                {timelineActorLabel(entry)} · {formatRelativeTime(entry.createdAt)}
              </Text>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default BookingTimeline;
