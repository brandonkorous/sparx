// What the studio's status badge says — the pure decision, kept out of the component.
//
// SAVED IS NOT LIVE. Two different facts share this badge, and conflating them is
// the bug this exists to fix: the toolbar used to go green on "All changes saved"
// while visitors were still being served the last PUBLISHED version — so an author
// reasonably read "saved" as "done" and walked away from a site that never changed.
// (It cost days of confusion on our own dogfood tenant before anyone realised the
// editor was telling the truth about the wrong thing.)
//
// So: saving/failure is transient and wins the badge while it's happening, because
// it needs action now. Once persistence settles, the badge reports the DURABLE
// truth — whether what visitors see matches what the author has built.
//
// Plain .ts, no JSX: the dashboard's vitest runs in a node environment with no JSX
// transform, and this decision is exactly the part worth unit-testing.

import type { BadgeColor } from '@wizeworks/silicaui-react';

/** The host-side persistence state — distinct from the engine's own local-edit
 *  tracking. `idle` = nothing to save yet. */
export type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

/** The publish facts the toolbar renders. The studio owns them: the server seeds
 *  them at load, then edits and publishes update them in place (no re-polling). */
export interface PublishView {
  hasUnpublished: boolean;
  lastPublishedAt: string | null;
  neverPublished: boolean;
}

export interface BadgeView {
  label: string;
  color: BadgeColor;
  /** The sentence beside the label — what this state means for the author's visitors. */
  detail?: string;
}

/** How long ago, in words a non-technical author reads without decoding. Deliberately
 *  not the terse "5m ago" used in dense list views — this is the one place that
 *  answers "is my site current?", and it should read like a sentence. */
export function publishedAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return `on ${new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`;
}

/** The badge + its one-line explanation. `null` when there is genuinely nothing to
 *  report (a freshly-opened session on a site with no publish history). */
export function badgeView(save: SaveState, publish: PublishView): BadgeView | null {
  // Transient states win: they're about THIS moment and may need a retry.
  if (save === 'error')
    return {
      label: 'Couldn’t save',
      color: 'danger',
      detail: 'We’ll keep trying. Don’t close this tab yet.',
    };
  if (save === 'saving') return { label: 'Saving…', color: 'info' };
  if (save === 'unsaved') return { label: 'Saving in a moment…', color: 'info' };

  // Settled. Now the question that actually matters: do visitors see this?
  if (publish.neverPublished)
    return {
      label: 'Not published yet',
      color: 'warning',
      detail: 'Your site isn’t visible to anyone until you publish it.',
    };
  if (publish.hasUnpublished)
    return {
      label: 'Saved — not live yet',
      color: 'warning',
      detail: publish.lastPublishedAt
        ? `Visitors still see the version you published ${publishedAgo(publish.lastPublishedAt)}.`
        : 'Visitors still see the previously published version.',
    };
  if (save === 'idle' && !publish.lastPublishedAt) return null;
  return {
    label: 'Live',
    color: 'success',
    detail: publish.lastPublishedAt
      ? `Published ${publishedAgo(publish.lastPublishedAt)}.`
      : undefined,
  };
}
