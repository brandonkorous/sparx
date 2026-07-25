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
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 text-sm',
        className
      )}
    >
      <span className="text-base-content font-semibold">Add to calendar</span>
      <a
        className="border-primary/40 text-primary hover:border-primary border-b no-underline transition-colors"
        href={links.google}
        target="_blank"
        rel="noopener noreferrer"
      >
        Google
      </a>
      <a
        className="border-primary/40 text-primary hover:border-primary border-b no-underline transition-colors"
        href={links.outlook}
        target="_blank"
        rel="noopener noreferrer"
      >
        Outlook
      </a>
      {/* The .ics download covers Apple Calendar, Outlook desktop, and any other client. */}
      <a
        className="border-primary/40 text-primary hover:border-primary border-b no-underline transition-colors"
        href={links.ics}
      >
        Apple / .ics
      </a>
    </div>
  );
}
