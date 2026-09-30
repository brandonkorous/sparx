// A name typed into a picker, split into the two boxes the form has. Issue 745.
//
// Pinned because the first version shipped with `/s+/` instead of `/\s+/`, which
// matches a literal letter s and nothing else. "Orla Beaumont" went into the
// first-name box whole, the surname box stayed empty, and every check was green:
// a regex that matches nothing is still a valid regex. Only opening the screen
// showed it. [[feedback_test_as_a_business_owner]]

import { describe, it, expect } from 'vitest';

import { splitTypedName } from './customer-display';

describe('splitTypedName', () => {
  it('splits an ordinary two-word name', () => {
    expect(splitTypedName('Orla Beaumont')).toEqual({
      firstName: 'Orla',
      lastName: 'Beaumont',
    });
  });

  it('keeps a middle name with the first, not the last', () => {
    // A surname is one word far more often than a first name is.
    expect(splitTypedName('Mary Jane Vale')).toEqual({
      firstName: 'Mary Jane',
      lastName: 'Vale',
    });
  });

  it('treats one word as a first name with no surname', () => {
    expect(splitTypedName('Tamsin')).toEqual({ firstName: 'Tamsin', lastName: '' });
  });

  it('survives the spacing people actually type', () => {
    expect(splitTypedName('  Orla   Beaumont  ')).toEqual({
      firstName: 'Orla',
      lastName: 'Beaumont',
    });
  });

  it('gives two empty boxes for an empty search', () => {
    expect(splitTypedName('')).toEqual({ firstName: '', lastName: '' });
    expect(splitTypedName('   ')).toEqual({ firstName: '', lastName: '' });
  });

  it('keeps an apostrophe and a hyphen where they belong', () => {
    // Real names, and the reason RULE #2 says never to test with placeholders.
    expect(splitTypedName("Niamh O'Doherty")).toEqual({
      firstName: 'Niamh',
      lastName: "O'Doherty",
    });
    expect(splitTypedName('Rosa Delgado-Pike')).toEqual({
      firstName: 'Rosa',
      lastName: 'Delgado-Pike',
    });
  });

  it('does not split on the letter s', () => {
    // The exact shape of the original defect: `/s+/` splits "Tamsin Vale" into
    // "Tam" and "in Vale" and leaves "Orla Beaumont" whole.
    expect(splitTypedName('Tamsin Vale')).toEqual({ firstName: 'Tamsin', lastName: 'Vale' });
  });
});
