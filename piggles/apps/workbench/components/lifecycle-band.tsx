'use client';

// The bar that says a business is about to stop working.
//
// ── WHY IT EXISTS WHEN THE RAIL ALREADY HAS A CARD ──────────────────────────
//
// `rail/plan-card.tsx` says the same thing, and it says it well. It is also
// mounted behind `expanded ? … : null` inside the rail, which means it is
// invisible to two whole populations:
//
//   · anybody who collapsed the rail, which is an ordinary thing to do for
//     screen space, and
//   · everybody on a phone, where there is NO rail at all.
//
// Piggles' own audience is named as including a 61-year-old on a phone in a
// workshop. On that phone the console showed nothing whatsoever about a trial
// ending, and then the site went dark. The rail's own comment claimed "the same
// information is one click away in the account menu"; the account menu carries
// an unchanging "Your plan and billing" link and no state at all, so it was not.
//
// This sits in the `HeaderNotice` slot, which both shells already mount, above
// everything, and cannot be collapsed away.

import { Button } from '@wizeworks/silicaui-react';
import { useLifecycle, type LifecycleTone } from '@/lib/billing/lifecycle';

/** Tone → the silica fill and its matching ink. A PAIR, always — `bg-warning`
 *  without `text-warning-content` is how a bar ends up with dark text on a dark
 *  fill in one theme and nobody notices. Same table as @piggles/ui's
 *  HeaderNotice, because this is the same bar in the same slot.
 *
 *  `calm` is `info`, not neutral: a countdown means something, and grey would
 *  say it means nothing. */
const TONE_CLASS: Record<LifecycleTone, string> = {
  calm: 'bg-info text-info-content',
  warning: 'bg-warning text-warning-content',
  danger: 'bg-danger text-danger-content',
};

export function LifecycleBand({
  accountOrigin,
  /** Whether the rail's plan card is on screen saying this quietly. False on a
   *  phone, where there is no rail to say it. */
  railCardVisible,
}: {
  accountOrigin: string;
  railCardVisible: boolean;
}) {
  const life = useLifecycle();
  if (!life) return null;

  // A healthy-enough countdown, already stated in the open rail, does not also
  // need a bar across the top; that would be nagging somebody about a trial with
  // a fortnight left. Anything past calm gets both, because a site going offline
  // is worth saying twice.
  if (railCardVisible && life.tone === 'calm') return null;

  return (
    <aside
      // A landmark with a name, not `role="alert"`. An alert interrupts a screen
      // reader mid-sentence on every render, and this bar is present for days.
      aria-label="Your account"
      className={`${TONE_CLASS[life.tone]} flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-center`}
    >
      <p className="text-base font-medium">{life.sentence}</p>
      <Button
        // No `color`: the bar is already the tone. A colored button on a colored
        // fill paints its own background over it and stops being legible on one
        // of the two themes.
        variant="outline"
        size="sm"
        onClick={() => {
          // Out to the account app, which owns every question this raises and is
          // the only place allowed to answer with numbers.
          window.location.href = `${accountOrigin}/account`;
        }}
      >
        {life.action}
      </Button>
    </aside>
  );
}
