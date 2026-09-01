// A design control has to say what the value IS.
//
// Found on a real About page: its column was set to `max-w-2xl` at the base size, so
// the page sat 240px narrower than every other page on the site — and "Don't get
// wider than", opened on desktop, showed six plain buttons with nothing marked. The
// answer was in the control's own hand and it drew none of it.

import { describe, expect, it } from 'vitest';
import { chipEmphasis } from './design-tab';

describe('chipEmphasis', () => {
  it('marks the value declared at this size, solidly', () => {
    expect(chipEmphasis({ value: 'max-w-2xl' }, 'max-w-2xl')).toEqual({ color: 'primary' });
  });

  it('STILL marks a value inherited from a smaller size — softly', () => {
    expect(chipEmphasis({ value: 'max-w-2xl', inherited: true }, 'max-w-2xl')).toEqual({
      color: 'primary',
      variant: 'soft',
    });
  });

  it('tells the two apart, so clicking a soft chip is visibly a change', () => {
    const here = chipEmphasis({ value: 'max-w-6xl' }, 'max-w-6xl');
    const from = chipEmphasis({ value: 'max-w-6xl', inherited: true }, 'max-w-6xl');
    expect(here).not.toEqual(from);
  });

  it('leaves every other option plain', () => {
    expect(chipEmphasis({ value: 'max-w-2xl', inherited: true }, 'max-w-6xl')).toEqual({});
    expect(chipEmphasis({ value: 'max-w-2xl' }, 'max-w-6xl')).toEqual({});
  });

  it('marks nothing when no value is in force anywhere', () => {
    expect(chipEmphasis({}, 'max-w-6xl')).toEqual({});
    expect(chipEmphasis({ value: undefined, inherited: true }, 'max-w-6xl')).toEqual({});
  });
});
