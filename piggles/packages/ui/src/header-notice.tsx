'use client';

// The bar above everything — one sentence, an optional button, an optional way
// to close it.
//
// ── WHY IT IS A CLIENT COMPONENT ────────────────────────────────────────────
//
// Only for the close. The sentence is server-rendered and arrives in the HTML,
// so a visitor with no JavaScript still reads it and a crawler still indexes it.
// What needs the browser is remembering that THIS visitor closed THIS notice —
// which is a per-person fact with no account behind it, so localStorage is the
// only place it can live.
//
// The dismissal is keyed on the notice's ID, not on a single "banner dismissed"
// flag. Closing an offer must not silence next month's outage notice, and a flag
// would do exactly that, silently, to the people most likely to have closed one
// before.
//
// A visitor who has already dismissed it sees the bar for one frame before the
// effect runs. That is the trade for keeping the sentence in the server HTML,
// and it is the right way round: the flash costs a dismisser a moment, while
// client-only rendering would cost everyone else the content and the layout.

import * as React from 'react';

export interface HeaderNoticeData {
  id: string;
  message: string;
  linkLabel: string | null;
  linkHref: string | null;
  tone: 'primary' | 'info' | 'success' | 'warning' | 'danger';
  dismissible: boolean;
}

/** Tone → the silica fill and its matching ink. A PAIR, always: `bg-primary`
 *  without `text-primary-content` is how a bar ends up with dark text on a dark
 *  fill in one theme and nobody notices until somebody screenshots it. */
const TONE_CLASS: Record<HeaderNoticeData['tone'], string> = {
  primary: 'bg-primary text-primary-content',
  info: 'bg-info text-info-content',
  success: 'bg-success text-success-content',
  warning: 'bg-warning text-warning-content',
  danger: 'bg-danger text-danger-content',
};

const storageKey = (id: string) => `piggles.notice.dismissed.${id}`;

export function HeaderNotice({ notice }: { notice: HeaderNoticeData | null }) {
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (!notice?.dismissible) return;
    try {
      if (window.localStorage.getItem(storageKey(notice.id))) setDismissed(true);
    } catch {
      // A browser with storage blocked simply keeps showing it. Better than a
      // page that throws over a banner.
    }
  }, [notice?.id, notice?.dismissible]);

  if (!notice || dismissed) return null;

  function close() {
    if (!notice) return;
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey(notice.id), '1');
    } catch {
      // Not remembered across pages; still closed on this one.
    }
  }

  return (
    <aside
      // `role` is deliberately absent. This is not an alert — an alert
      // interrupts a screen reader mid-sentence, and an offer is not worth that.
      // As a landmark with a name it is reachable on purpose and ignorable by
      // default, which is what a banner should be.
      aria-label="Announcement"
      className={`${TONE_CLASS[notice.tone]} relative px-4 py-2.5 text-center sm:px-12`}
    >
      <p className="text-base font-medium">
        {notice.message}
        {notice.linkLabel && notice.linkHref ? (
          <>
            {' '}
            <a href={notice.linkHref} className="font-bold underline underline-offset-2">
              {notice.linkLabel}
            </a>
          </>
        ) : null}
      </p>

      {notice.dismissible ? (
        <button
          type="button"
          onClick={close}
          aria-label="Close this notice"
          // Absolute, so closing it never reflows the sentence it sits beside —
          // and `-translate-y-1/2` rather than a matched padding, because the
          // bar's height changes the moment the message wraps on a phone.
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full px-2 py-1 text-xl leading-none font-bold opacity-70 transition-opacity hover:opacity-100"
        >
          &times;
        </button>
      ) : null}
    </aside>
  );
}
