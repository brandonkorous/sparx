'use client';

// The bar above everything: one sentence, an optional link, an optional close.
// Server-rendered so it reads without JavaScript; the client part only remembers
// that THIS visitor closed THIS notice (keyed by id, so next month's still shows).

import * as React from 'react';

export interface HeaderNoticeData {
  id: string;
  message: string;
  linkLabel: string | null;
  linkHref: string | null;
  tone: 'primary' | 'info' | 'success' | 'warning' | 'danger';
  dismissible: boolean;
}

/** Tone → the silica fill AND its matching ink, always as a pair. */
const TONE_CLASS: Record<HeaderNoticeData['tone'], string> = {
  primary: 'bg-primary text-primary-content',
  info: 'bg-info text-info-content',
  success: 'bg-success text-success-content',
  warning: 'bg-warning text-warning-content',
  danger: 'bg-danger text-danger-content',
};

const storageKey = (id: string) => `piggles.notice.dismissed.${id}`;

function wasDismissed(notice: HeaderNoticeData): boolean {
  if (!notice.dismissible) return false;
  try {
    return Boolean(window.localStorage.getItem(storageKey(notice.id)));
  } catch {
    return false; // Storage blocked: keep showing it rather than throw over a banner.
  }
}

/** A bar inviting you to the page you are already on says nothing. */
function pointsHere(notice: HeaderNoticeData): boolean {
  return Boolean(notice.linkHref?.startsWith('/')) && notice.linkHref === window.location.pathname;
}

export function HeaderNotice({ notice }: { notice: HeaderNoticeData | null }) {
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    if (notice && (wasDismissed(notice) || pointsHere(notice))) setHidden(true);
  }, [notice]);

  if (!notice || hidden) return null;

  function close() {
    if (!notice) return;
    setHidden(true);
    try {
      window.localStorage.setItem(storageKey(notice.id), '1');
    } catch {
      // Not remembered across pages; still closed on this one.
    }
  }

  return (
    // No `role`: an offer is not worth interrupting a screen reader. A named
    // landmark is reachable on purpose and ignorable by default.
    <aside
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
          // Absolute and centered, so closing never reflows a sentence that wraps.
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full px-2 py-1 text-xl leading-none font-bold opacity-70 transition-opacity hover:opacity-100"
        >
          &times;
        </button>
      ) : null}
    </aside>
  );
}
