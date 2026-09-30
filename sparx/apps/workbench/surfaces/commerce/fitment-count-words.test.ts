// How a compatibility list counts what sits under an entry.
//
// The row badge pluralized when there was something to count and did not when
// there was nothing, so a Make with no Models read "No model" three lines from
// the branch that reads "4 models" (issue 799).

import { describe, expect, it } from 'vitest';
import { childCountLabel, pluralize } from './fitment-data';

describe('childCountLabel', () => {
  it('pluralizes the empty case, which is where it used to give up', () => {
    expect(childCountLabel('Model', 0)).toBe('No models');
    expect(childCountLabel('Size', 0)).toBe('No sizes');
  });

  it('keeps the singular for exactly one', () => {
    expect(childCountLabel('Model', 1)).toBe('1 model');
  });

  it('counts and pluralizes anything above one', () => {
    expect(childCountLabel('Model', 4)).toBe('4 models');
    expect(childCountLabel('Engine', 12)).toBe('12 engines');
  });

  it('uses the real plural rules on the level names that need them', () => {
    expect(childCountLabel('Body', 0)).toBe('No bodies');
    expect(childCountLabel('Class', 0)).toBe('No classes');
    expect(childCountLabel('Finish', 3)).toBe('3 finishes');
  });

  it('leaves the level word itself to pluralize, so both agree', () => {
    expect(childCountLabel('Model', 0)).toContain(pluralize('model', 2));
  });
});
