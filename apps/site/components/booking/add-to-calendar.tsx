'use client';

// "Add to calendar" links for a booking (docs/79 §8.1) — the per-booking `.ics`
// download (Apple / Outlook desktop / any client) plus Google/Outlook web deep
// links. Shown on the booking confirmation and on each upcoming portal booking.

import { cn } from '@/lib/cn';

export interface CalendarLinks {
  ics: string;
  google: string;
  outlook: string;
}

export function AddToCalendar({ links, className }: { links: CalendarLinks; className?: string }) {
  return (
    <div className={cn('st-add-to-cal', className)}>
      <span className="st-add-to-cal__label">Add to calendar</span>
      <a
        className="st-add-to-cal__link"
        href={links.google}
        target="_blank"
        rel="noopener noreferrer"
      >
        Google
      </a>
      <a
        className="st-add-to-cal__link"
        href={links.outlook}
        target="_blank"
        rel="noopener noreferrer"
      >
        Outlook
      </a>
      {/* The .ics download covers Apple Calendar, Outlook desktop, and any other client. */}
      <a className="st-add-to-cal__link" href={links.ics}>
        Apple / .ics
      </a>
    </div>
  );
}
