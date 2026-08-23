// What the bar looks like, shown to the operator writing it.
//
// A SECOND implementation of the same bar, and that is deliberate rather than
// sloppy. The one customers see lives in `@piggles/ui`, and this app may not
// import it: `wizeworks/apps/admin` is shared platform code that serves both
// brands, and reaching into `piggles/` would make one product undeletable
// without the other (piggles/CLAUDE.md RULE #0). Both are built from the same
// silica classes, so they follow a token change together.
//
// Keep them in step by shape, not by copying: the bar is a tone-filled strip, a
// sentence, an optional link, and an optional close. If one grows a part, the
// other needs it, or the preview starts lying about the thing it exists to show.

import type { OperatorAnnouncementTone } from '@wizeworks/operator';

/** Tone → the silica fill + its resolved ink. Nothing here is a color value —
 *  `bg-<color>` and `text-<color>-content` are a matched pair the theme owns. */
const TONE_CLASS: Record<OperatorAnnouncementTone, string> = {
  primary: 'bg-primary text-primary-content',
  info: 'bg-info text-info-content',
  success: 'bg-success text-success-content',
  warning: 'bg-warning text-warning-content',
  danger: 'bg-danger text-danger-content',
};

export function AnnouncementPreview({
  message,
  linkLabel,
  tone,
  dismissible,
}: {
  message: string;
  linkLabel?: string | null;
  tone: OperatorAnnouncementTone;
  dismissible: boolean;
}) {
  return (
    <div
      className={`rounded-box flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2.5 text-center ${TONE_CLASS[tone]}`}
    >
      <span className="text-base font-medium">{message}</span>
      {linkLabel ? <span className="text-base font-bold underline">{linkLabel}</span> : null}
      {dismissible ? (
        <span aria-hidden className="text-lg leading-none font-bold opacity-70">
          ×
        </span>
      ) : null}
    </div>
  );
}
