// WHY A SEARCH NUMBER IS BLANK — and only ever the true reason.
//
// Two of the figures on "How people find you" come from Google, not from us:
// visits from search and average position. When they are blank there are THREE
// reasons, and only two of them are anything an owner can act on.
//
// The line under each figure knew about ONE. It read "connect Google to see"
// whenever the tenant was not connected, including when there was nothing to
// connect TO — and the card six inches below it, on the same screen, said the
// opposite in full:
//
//     Coming soon
//     Google's own search numbers are not ready on this side yet. It is nothing
//     to do with your account or your plan, and THERE IS NOTHING FOR YOU TO
//     SWITCH ON.
//
// So the screen told a shop owner to go and do a thing, and then told her the
// thing did not exist. The card had the `configured` flag; the figures above it
// only ever looked at `connected` (persona issue 542).
//
// A leaf module so the three cases can be tested, next to the screen that uses
// them.

export interface SearchDataState {
  /** Whether the PLATFORM has Search Console set up at all, so a tenant has
   *  something to connect to. Not about this business. */
  configured: boolean;
  /** Whether THIS business has connected theirs. */
  connected: boolean;
}

/**
 * The line under a Google-sourced figure.
 *
 * `whenConnected` differs per figure ("in the last 28 days" against "in Google
 * results"), so it is passed in; the two blank cases are the same sentence
 * wherever they appear, which is the point of keeping them here.
 */
export function searchFigureNote(state: SearchDataState, whenConnected: string): string {
  if (state.connected) return whenConnected;
  if (state.configured) return 'connect Google to see';
  // Not "connect Google": there is nothing to connect to. Says the same thing as
  // the card below, because a screen may not hold two answers to one question.
  return 'not ready yet';
}
