// WHAT PUBLISHING MEANS WHILE THE SITE IS NOT BEING SERVED.
//
// The publish pane is written entirely in terms of VISITORS, which is the right
// frame and the whole reason the screen reads well:
//
//     2 pages have changes that visitors are not seeing yet.
//     Everything you have saved is live.
//     This is what visitors see.
//     Visitors will see the site exactly as it was on Saturday, straight away.
//
// A suspended account's public site serves the "Temporarily unavailable · Back
// soon" overlay instead of its pages, so there are no visitors to speak of and
// every one of those four sentences is false. Measured the day this was found:
// 32 of the 113 tenants on the platform are past their grace window.
//
// Publishing still WORKS while the lights are off — the version changes, and it
// is the version the site comes back with. So the actions stay exactly as they
// are and only the sentences move, from what a stranger is seeing to what the
// site will carry when it is served again.
//
// Pure, so the words can be tested without the query stack behind them.

export interface PublishState {
  neverPublished: boolean;
  hasUnpublished: boolean;
  unpublishedPages: number;
  frameUnpublished: boolean;
}

/** What is outstanding, in one sentence someone can act on. */
export function waitingLine(state: PublishState, siteIsDark = false): string {
  if (state.neverPublished) {
    return 'Your website has never been published. Nobody can see it yet.';
  }

  if (!state.hasUnpublished) {
    return siteIsDark
      ? 'Everything you have saved is published. Your site is offline right now, so this is what it comes back with.'
      : 'Everything you have saved is live.';
  }

  const parts: string[] = [];
  if (state.unpublishedPages > 0) {
    parts.push(
      `${String(state.unpublishedPages)} ${state.unpublishedPages === 1 ? 'page has' : 'pages have'} changes`
    );
  }
  if (state.frameUnpublished) parts.push('your header and footer have changes');
  const what = parts.join(', and ');

  return siteIsDark
    ? `${what} that are not published yet, so they are not part of what your site comes back with.`
    : `${what} that visitors are not seeing yet.`;
}

/** The marker beside the version that is currently published. */
export function currentReleaseLabel(siteIsDark = false): string {
  return siteIsDark ? 'This is what your site comes back with' : 'This is what visitors see';
}

/**
 * The confirm shown before putting the site back to an older version.
 *
 * The "straight away / no publish step" half is true whatever the billing says —
 * the restore is immediate either way — so it is kept in both. What changes is
 * the claim that somebody is looking.
 */
export function restoreConfirmDetail(when: string, siteIsDark = false): string {
  const lead = siteIsDark
    ? `Your site will be exactly as it was on ${when}. It is offline right now, so this is the version it comes back with when it is online again.`
    : `Visitors will see the site exactly as it was on ${when}, straight away.`;
  return `${lead} There is no publish step after this. Everything you have been working on since stays where it is, unpublished.`;
}
