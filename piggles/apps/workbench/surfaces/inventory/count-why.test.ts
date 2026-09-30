import { describe, expect, it } from 'vitest';

import { askWhy, whyFieldLabel, whyIntro, whyPlaceholder, type WhyFacts } from './count-why';

const facts = (over: Partial<WhyFacts> = {}): WhyFacts => ({
  counted: null,
  difference: null,
  hasWords: false,
  ...over,
});

describe('askWhy', () => {
  it('asks nothing of a line nobody has counted yet', () => {
    expect(askWhy(facts())).toBe(false);
    expect(askWhy(facts({ counted: null, difference: null }))).toBe(false);
  });

  it('asks on a line that came out different', () => {
    expect(askWhy(facts({ counted: 6, difference: 6 }))).toBe(true);
    expect(askWhy(facts({ counted: 2, difference: -4 }))).toBe(true);
  });

  it('leaves a line that matched alone', () => {
    expect(askWhy(facts({ counted: 12, difference: 0 }))).toBe(false);
  });

  // An item on the shelf that was not on the list. Expected is null, so the
  // difference cannot be worked out, and this is exactly the case somebody
  // needs to write a sentence about.
  it('asks when nothing at all was expected', () => {
    expect(askWhy(facts({ counted: 3, difference: null }))).toBe(true);
  });

  // A blind count withholds the expected number from the counter, so every one
  // of its lines carries a null difference until the count is submitted. This
  // is the case above arriving by a different road, and it is why `askWhy` has
  // no branch of its own for blind counts.
  it('asks every counted line while a blind count is open', () => {
    expect(askWhy(facts({ counted: 12, difference: null }))).toBe(true);
    expect(askWhy(facts({ counted: 0, difference: null }))).toBe(true);
  });

  // The one that matters most. Somebody types "four went to the market", then
  // realises they miscounted and corrects 8 back to 12. Without this the box
  // disappears mid-sentence and takes the sentence with it.
  it('never takes away a box that is holding words', () => {
    expect(askWhy(facts({ counted: 12, difference: 0, hasWords: true }))).toBe(true);
    expect(askWhy(facts({ counted: null, hasWords: true }))).toBe(true);
  });
});

describe('what it says', () => {
  // A blind count hides the expected number from the counter on purpose. Asking
  // them why a line is different tells them that it is.
  it('never mentions a difference on a blind count', () => {
    expect(whyIntro(true)).not.toMatch(/match|different/i);
    expect(whyFieldLabel(true, 'ASH-OVERSHIRT')).not.toMatch(/different/i);
    expect(whyPlaceholder(true)).not.toMatch(/different/i);
  });

  it('names the difference when the counter is allowed to see it', () => {
    expect(whyIntro(false)).toMatch(/match/i);
    expect(whyFieldLabel(false, 'ASH-OVERSHIRT')).toMatch(/different/i);
  });

  // Read out a hundred times down a full count, a label that does not name the
  // item identifies nothing.
  it('names the item in the label a screen reader reads', () => {
    expect(whyFieldLabel(false, 'ASH-OVERSHIRT')).toContain('ASH-OVERSHIRT');
    expect(whyFieldLabel(true, 'ASH-OVERSHIRT')).toContain('ASH-OVERSHIRT');
  });

  // The promise is the reason somebody bothers to type one. It has to survive
  // both wordings.
  it('promises the words are kept and are the team’s own, either way', () => {
    for (const intro of [whyIntro(true), whyIntro(false)]) {
      expect(intro).toMatch(/only your team/i);
      expect(intro).toMatch(/stay on the count/i);
    }
  });
});
