import { describe, expect, it } from 'vitest';
import { searchFigureNote } from './seo-words';

/**
 * "CONNECT GOOGLE TO SEE", ABOVE "THERE IS NOTHING FOR YOU TO SWITCH ON".
 *
 * Get Found -> How people find you, 2026-09-16. Two figures read:
 *
 *     Visits from search      —      connect Google to see
 *     Average position        —      connect Google to see
 *
 * And six inches below them, on the same screen:
 *
 *     Coming soon
 *     Google's own search numbers are not ready on this side yet. It is nothing
 *     to do with your account or your plan, and there is nothing for you to
 *     switch on.
 *
 * Both cannot be true. The card was right: Search Console is not set up on this
 * side, so there is nothing for a business to connect to. The figures above it
 * sent her looking for a switch that does not exist.
 *
 * The card checked `configured` (does the platform have it at all?) as well as
 * `connected` (has this business linked theirs?). The figures only ever looked
 * at the second.
 */
describe('searchFigureNote', () => {
  const connectedState = { configured: true, connected: true };
  const canConnect = { configured: true, connected: false };
  const nothingToConnect = { configured: false, connected: false };

  it('describes the window when the figure is real', () => {
    expect(searchFigureNote(connectedState, 'in the last 28 days')).toBe('in the last 28 days');
  });

  it('offers the connection only when there is something to connect to', () => {
    expect(searchFigureNote(canConnect, 'in the last 28 days')).toBe('connect Google to see');
  });

  it('never tells someone to connect when there is nothing to connect to', () => {
    // The whole defect, in one assertion.
    expect(searchFigureNote(nothingToConnect, 'in the last 28 days')).not.toContain('connect');
    expect(searchFigureNote(nothingToConnect, 'in the last 28 days')).toBe('not ready yet');
  });

  it('says the same thing for both figures when blank', () => {
    // One question, one answer, whichever figure is asking.
    expect(searchFigureNote(nothingToConnect, 'in the last 28 days')).toBe(
      searchFigureNote(nothingToConnect, 'in Google results')
    );
    expect(searchFigureNote(canConnect, 'in the last 28 days')).toBe(
      searchFigureNote(canConnect, 'in Google results')
    );
  });
});
