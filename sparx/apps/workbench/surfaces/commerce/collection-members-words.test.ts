// "NO PRODUCTS MATCH" MUST NOT BE SAID ABOUT RULES THAT MATCHED.
//
// A maker’s "New arrivals" group matched five products, all of them jewelry and
// fragrance on their other websites. The old sentence said "5 products matched"
// over a group page holding nothing; the naive new one would say "No products
// match these conditions yet", which would send the author to rewrite working rules.

import { describe, expect, it } from 'vitest';

import { filedInGroup, membershipLine } from './collection-members-words';

describe('when nothing matched anywhere', () => {
  it('says the conditions found nothing, or no check has run', () => {
    const said = membershipLine({ shown: 0, hidden: 0 });
    expect(said).toContain('No products match these conditions yet');
    expect(said).toContain('worked out in the background');
  });
});

describe('the split group: the rules worked and the results are elsewhere', () => {
  it('never says the conditions matched nothing', () => {
    const said = membershipLine({ shown: 0, hidden: 5 });
    expect(said).not.toContain('No products match');
  });

  it('says how many matched, and that none of them is on this site', () => {
    expect(membershipLine({ shown: 0, hidden: 5 })).toBe(
      '5 products match these conditions, but none of them is on this website: ' +
        'archived, still a draft, or kept for one of your other sites.'
    );
  });

  it('reads as one thing when it is one thing, and still says NOT', () => {
    // The sentence turns on that word. Dropping it while fixing the plural
    // would say the exact opposite and read as fine.
    expect(membershipLine({ shown: 0, hidden: 1 })).toBe(
      '1 product matches these conditions, but it is not on this website: ' +
        'archived, still a draft, or kept for one of your other sites.'
    );
  });
});

describe('the ordinary case', () => {
  it('says what matched when everything matched is here', () => {
    expect(membershipLine({ shown: 3, hidden: 0 })).toBe(
      '3 products matched when membership was last worked out. ' +
        'It refreshes in the background after a change.'
    );
  });

  it('counts one product as one', () => {
    expect(membershipLine({ shown: 1, hidden: 0 })).toContain('1 product matched');
  });
});

describe('when it is split across her sites', () => {
  it('gives both numbers and says why the second is missing', () => {
    expect(membershipLine({ shown: 2, hidden: 3 })).toBe(
      '2 products on this website matched when membership was last worked out, and 3 more ' +
        'matched but are not shown here: archived, still a draft, or kept for one of your other sites.'
    );
  });
});

describe('what a delete has to account for', () => {
  it('counts every site, because the delete reaches every site', () => {
    // Offering "the products in it are kept" over the count visible HERE would
    // name a number that is not the number kept.
    expect(filedInGroup({ shown: 2, hidden: 3 })).toBe(5);
    expect(filedInGroup({ shown: 0, hidden: 5 })).toBe(5);
  });
});
