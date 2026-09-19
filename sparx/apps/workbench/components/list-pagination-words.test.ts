import { describe, expect, it } from 'vitest';
import { pagerHasContent, rangeLabel } from './list-pagination-words';

describe('the range readout', () => {
  it('counts the window against the whole set', () => {
    expect(rangeLabel(25, 1, 312)).toBe('Showing 1–25 of 312');
    expect(rangeLabel(25, 26, 312)).toBe('Showing 26–50 of 312');
  });

  it('never invents a total the server did not send', () => {
    // "1–25 of 0" is a lie the moment an endpoint stops sending a count.
    expect(rangeLabel(25, 1, undefined)).toBe('Showing 1–25');
  });

  it('says so plainly when the window is empty', () => {
    expect(rangeLabel(0, 1, 0)).toBe('Nothing to show');
  });
});

describe('whether the pager is worth a row of the pane', () => {
  it('shows while there are rows on screen', () => {
    expect(pagerHasContent({ shown: 25, cursorMode: false, pageCount: 1 })).toBe(true);
  });

  it('stays out of the way of an empty state', () => {
    // The surface has already said "No payouts yet" in a heading and explained
    // in a paragraph what would be here. A grey "Nothing to show" underneath is
    // the screen repeating itself in a weaker voice, and every other control in
    // this component is already hidden at zero — so the row it leaves behind
    // holds that one sentence and nothing else.
    expect(pagerHasContent({ shown: 0, cursorMode: false, pageCount: 1 })).toBe(false);
  });

  it('will not strand a reader who has paged past the end', () => {
    // Page 5 of a list that just shrank to 2 pages: no rows, and the page
    // numbers are the only way back.
    expect(pagerHasContent({ shown: 0, cursorMode: false, pageCount: 2 })).toBe(true);
  });

  it('will not strand a reader on a quiet window of a cursor feed', () => {
    // A keyset feed has no page numbers and no count. Newer is the way back and
    // it lives in this row.
    expect(pagerHasContent({ shown: 0, cursorMode: true, pageCount: 1 })).toBe(true);
  });
});
