import { describe, expect, it } from 'vitest';
import { rankEntries, rankRecords, recordRank, scoreQuery, type Entry } from './launcher-match';

/** A record row, shaped the way `useRecordEntries` builds one. */
function record(label: string, group: string, subtitle?: string): Entry {
  return {
    id: `record:${label}`,
    group,
    label,
    ...(subtitle === undefined ? {} : { subtitle }),
    run: () => undefined,
  };
}

describe('ranking record results against what was typed', () => {
  it('puts the person she named above a page whose letters happen to match', () => {
    // Measured on P03: typing "Priya" returned Privacy Policy first — two edits
    // away, and the search server is typo-tolerant on purpose — then a segment,
    // then the three customers actually called Priya. The highlight starts on the
    // first row and Enter takes it, so a policy page opened.
    const ranked = rankRecords(
      [
        record('Privacy Policy', 'Pages', 'privacy-policy'),
        record('B2B Fleet', 'Segments', 'b2b-fleet'),
        record('Priya Nandakumar', 'Customers', 'Loom & Larder'),
        record('Priya Anand', 'Customers', 'priya.anand@example.com'),
      ],
      'priya'
    );

    expect(ranked.map((row) => row.label)).toEqual([
      'Priya Nandakumar',
      'Priya Anand',
      'Privacy Policy',
      'B2B Fleet',
    ]);
  });

  it('puts a customer above the text of a review she wrote', () => {
    // The same shape with a different query: "Marguerite" returned her review's
    // opening line first and Marguerite herself second.
    const ranked = rankRecords(
      [
        record(
          'Sized down and it still swallows me, in a good way',
          'Reviews',
          'The Ash Overshirt'
        ),
        record('Marguerite Adeyemi', 'Customers', 'marguerite.adeyemi@example.com'),
        record('#O-000014', 'Orders', 'Marguerite Adeyemi · placed'),
      ],
      'marguerite'
    );

    expect(ranked[0]?.label).toBe('Marguerite Adeyemi');
    // The order still matches, on its subtitle, so it outranks the review — but
    // it stays below the person, which is who was asked for.
    expect(ranked[1]?.label).toBe('#O-000014');
  });

  it('keeps rows it cannot score at all, in the order the server sent them', () => {
    // Typo tolerance is why a mistyped query finds anything, so a row the client
    // sees no reason for is demoted, never dropped.
    const ranked = rankRecords(
      [record('Alpha', 'Pages'), record('Beta', 'Pages'), record('Priya Anand', 'Customers')],
      'priya'
    );
    expect(ranked.map((row) => row.label)).toEqual(['Priya Anand', 'Alpha', 'Beta']);
  });

  it('does not reorder anything when nothing was typed', () => {
    const rows = [record('Alpha', 'Pages'), record('Beta', 'Pages')];
    expect(rankRecords(rows, '   ')).toEqual(rows);
  });

  it('rates the row’s own name above the line under it', () => {
    const byName = record('Marlow Knit', 'Products', 'marlow-knit');
    const bySubtitle = record('#O-000014', 'Orders', 'Marlow Knit · placed');
    expect(recordRank(byName, 'marlow')).toBeGreaterThan(recordRank(bySubtitle, 'marlow'));
  });

  it('ignores the group, which on a record is just the entity’s own name', () => {
    // `score` counts a group match for SURFACES on purpose — typing "customers"
    // should reach the Customers app. On a record it would score every order in
    // the shop equally and say nothing about which one was meant.
    expect(recordRank(record('#O-000014', 'Orders', 'Marguerite · placed'), 'orders')).toBe(0);
  });

  it('needs every meaningful word of a phrase, like the surface ladder does', () => {
    const row = record('Priya Nandakumar', 'Customers', 'Loom & Larder');
    expect(recordRank(row, 'priya nandakumar')).toBeGreaterThan(0);
    expect(recordRank(row, 'priya adeyemi')).toBe(0);
  });
});

describe('a phrase that says what to do', () => {
  const discounts: Entry = {
    id: 'commerce.discounts.list',
    group: 'Selling',
    label: 'Discounts',
    keywords: ['promotions', 'coupons', 'sale'],
    run: () => undefined,
  };

  it('finds the screen when the phrase starts with "new", "add" or "create"', () => {
    // sparx persona issue 036: "new discount" found nothing.
    expect(scoreQuery(discounts, 'new discount')).toBeGreaterThan(0);
    expect(scoreQuery(discounts, 'add a discount')).toBeGreaterThan(0);
    expect(scoreQuery(discounts, 'create coupon')).toBeGreaterThan(0);
  });

  it('still needs the noun to match', () => {
    expect(scoreQuery(discounts, 'new supplier')).toBe(0);
    expect(scoreQuery(discounts, 'new')).toBe(0);
  });
});

describe('a phrase that asks to make one', () => {
  const posts: Entry = {
    id: 'social.posts',
    group: 'Social',
    label: 'Posts',
    run: () => undefined,
  };
  const newPost: Entry = {
    id: 'create:social.posts',
    group: 'Social',
    label: 'New post',
    keywords: ['Posts'],
    run: () => undefined,
  };

  it('puts the row that makes one above the list', () => {
    // sparx persona issue 036: "new social post" offered Posts and Cadence first.
    expect(scoreQuery(newPost, 'new social post')).toBeGreaterThan(
      scoreQuery(posts, 'new social post')
    );
  });

  it('leaves the list first when nobody asked to make anything', () => {
    expect(scoreQuery(posts, 'posts')).toBeGreaterThan(scoreQuery(newPost, 'posts'));
  });
});

describe('a dash is a space to whoever typed it', () => {
  // The task reads "waiting for your sign-off: approve or reject it under
  // Approvals", the Approvals screen was tagged "sign off", and typing the
  // task's own word found nothing but another module's screen (sparx persona
  // issue 086).
  const approvals: Entry = {
    id: 'surface:b2b.approvals',
    group: 'Wholesale',
    label: 'Approvals',
    keywords: ['approval queue', 'sign off', 'credit limit'],
    run: () => undefined,
  };

  it('finds a screen tagged "sign off" when "sign-off" is typed', () => {
    expect(scoreQuery(approvals, 'sign-off')).toBeGreaterThan(0);
  });

  it('finds an order by its number with or without the dash', () => {
    const order = record('O-000012', 'Orders', 'Dana Whitcomb-Nguyen');
    expect(recordRank(order, 'o-000012')).toBe(100);
    expect(recordRank(order, 'o 000012')).toBe(100);
  });
});

describe('a number in what was typed', () => {
  const units: Entry = {
    id: 'inventory.units',
    group: 'Inventory',
    label: 'Units',
    run: () => undefined,
  };

  it('has to match like any other word', () => {
    // "Units 31" listed the Units screen, which matched one word, above the task
    // "Quote Dana the Cheetah turbos ..., Units 31 and 34", which matched both
    // (sparx persona issue 091).
    expect(scoreQuery(units, 'Units 31')).toBe(0);
  });

  it('still leaves short filler words out', () => {
    expect(scoreQuery(units, 'a units')).toBeGreaterThan(0);
  });
});

describe('a phrase some screens answer whole', () => {
  const screen = (id: string, group: string, label: string): Entry => ({
    id,
    group,
    label,
    run: () => undefined,
  });
  const entries = [
    screen('inventory.planning', 'Stock', 'Planning settings'),
    screen('inventory.setup', 'Stock', 'Set up your stock'),
    screen('commerce.settings', 'Sell', 'Selling settings'),
    screen('workbench.welcome', 'Home', 'Get set up'),
  ];

  it('leaves out screens that only match one leftover word', () => {
    // Piggles persona issue 935: "set up" drops "up" as filler, and "set" alone started
    // every "settings" screen, so Get set up came sixteenth.
    const labels = rankEntries(entries, 'set up').map((entry) => entry.label);
    expect(labels).toEqual(['Set up your stock', 'Get set up']);
  });

  it('still goes word by word when nothing holds the whole phrase', () => {
    const labels = rankEntries(entries, 'stock planning').map((entry) => entry.label);
    expect(labels).toEqual(['Planning settings']);
  });
});
