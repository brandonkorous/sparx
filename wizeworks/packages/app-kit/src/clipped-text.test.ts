import { describe, expect, it } from 'vitest';

import { type ClipMetrics, clippedTitleFor } from './clipped-text';

/** A line of text that fits its box exactly. */
function fits(overrides: Partial<ClipMetrics> = {}): ClipMetrics {
  return {
    scrollWidth: 100,
    clientWidth: 100,
    scrollHeight: 20,
    clientHeight: 20,
    text: 'Brass belt hardware, antique',
    existingTitle: null,
    ...overrides,
  };
}

describe('clipped text is worth revealing only when it is actually clipped', () => {
  it('reveals a line cut off on the right', () => {
    // The real measurement from the purchase order pane: 203px of name in a
    // 101px column, showing "Brass belt h…".
    expect(clippedTitleFor(fits({ scrollWidth: 203, clientWidth: 101 }))).toBe(
      'Brass belt hardware, antique'
    );
  });

  it('reveals a paragraph cut off at the bottom', () => {
    // `line-clamp-2` clips vertically, and the part below the fold is just as
    // unreachable as the part past the right edge.
    expect(clippedTitleFor(fits({ scrollHeight: 60, clientHeight: 40 }))).toBe(
      'Brass belt hardware, antique'
    );
  });

  it('says nothing about text that fits', () => {
    expect(clippedTitleFor(fits())).toBeNull();
  });

  it('ignores a single pixel of rounding', () => {
    // Sub-pixel layout rounds `scrollWidth` up past `clientWidth` on lines that
    // are plainly whole. Without the slack, every such line would grow a tooltip
    // repeating what is already on screen — which is how a tooltip stops meaning
    // anything.
    expect(clippedTitleFor(fits({ scrollWidth: 101, clientWidth: 100 }))).toBeNull();
    expect(clippedTitleFor(fits({ scrollHeight: 21, clientHeight: 20 }))).toBeNull();
  });

  it('never overwrites a title the author wrote', () => {
    // Their sentence says something the visible text does not. Replacing it
    // would lose it, and the clipped line is the lesser of the two.
    expect(
      clippedTitleFor(
        fits({ scrollWidth: 203, clientWidth: 101, existingTitle: 'Open this purchase order' })
      )
    ).toBe(null);
  });

  it('says nothing about an empty box', () => {
    // An icon or a spacer can overflow its box and has no text to reveal. A
    // tooltip of "" is a tooltip that flickers over nothing.
    expect(clippedTitleFor(fits({ scrollWidth: 203, clientWidth: 101, text: '   ' }))).toBeNull();
  });

  it('reads as one line, not as the source indentation', () => {
    // JSX leaves newlines and padding between elements; a tooltip has to be the
    // sentence a person would say.
    expect(
      clippedTitleFor(
        fits({ scrollWidth: 203, clientWidth: 101, text: '\n  Brass belt\n  hardware  \n' })
      )
    ).toBe('Brass belt hardware');
  });
});
