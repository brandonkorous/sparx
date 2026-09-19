// A MEASURED ZERO IS NOT AN UNKNOWN.
//
// The counts map holds one row per type that HAS entries. The cell read
// `counts?.get(key)` and treated "no row" the same as "no map", so a type nobody
// has used printed an empty cell under a column headed "Entries" — and the
// "No entries yet" wording could never reach the screen it was written for.
//
// The delete sentences read the SITE count while the server refuses tenant-wide,
// which is the other half: "3 entries use this type" over a refusal counting 21.

import { describe, expect, it } from 'vitest';

import {
  deleteTypeWarning,
  entriesElsewhereLabel,
  entriesHereLabel,
  type EntryCounts,
} from './content-type-usage-words';

const counts = (rows: Record<string, EntryCounts>) => new Map(Object.entries(rows));

describe('while the numbers have not arrived', () => {
  it('says nothing rather than guessing zero', () => {
    expect(entriesHereLabel(undefined, 'testimonial')).toBe('');
    expect(entriesElsewhereLabel(undefined, 'testimonial')).toBe(null);
  });
});

describe('a type nobody has used', () => {
  it('says so, instead of leaving the cell blank', () => {
    // The case on screen: a hand-made Testimonial type, absent from the
    // server's groups because it has no rows to group.
    const map = counts({ blog_post: { here: 3, allSites: 21 } });
    expect(entriesHereLabel(map, 'testimonial')).toBe('No entries yet');
  });

  it('does not invent a sentence about her other sites', () => {
    const map = counts({ blog_post: { here: 3, allSites: 21 } });
    expect(entriesElsewhereLabel(map, 'testimonial')).toBe(null);
  });
});

describe('a type with entries on this site', () => {
  it('counts them, and agrees with itself in the singular', () => {
    expect(entriesHereLabel(counts({ page: { here: 1, allSites: 1 } }), 'page')).toBe('1 entry');
    expect(entriesHereLabel(counts({ page: { here: 6, allSites: 6 } }), 'page')).toBe('6 entries');
  });

  it('names what is on the other sites when the two numbers differ', () => {
    const map = counts({ blog_post: { here: 3, allSites: 21 } });
    expect(entriesHereLabel(map, 'blog_post')).toBe('3 entries');
    expect(entriesElsewhereLabel(map, 'blog_post')).toBe('18 on your other sites');
  });

  it('stays quiet for a business whose entries are all on this site', () => {
    const map = counts({ page: { here: 6, allSites: 6 } });
    expect(entriesElsewhereLabel(map, 'page')).toBe(null);
  });
});

describe('a type whose entries all live on her OTHER sites', () => {
  it('says none here AND says where they are, so a refused delete makes sense', () => {
    // Without the second line the pane says "No entries yet" over a Delete the
    // server refuses tenant-wide.
    const map = counts({ case_study: { here: 0, allSites: 4 } });
    expect(entriesHereLabel(map, 'case_study')).toBe('No entries yet');
    expect(entriesElsewhereLabel(map, 'case_study')).toBe('4 on your other sites');
  });
});

describe('the Delete warning', () => {
  it('never says "for good" while the numbers are still unknown', () => {
    // The server refuses tenant-wide. Reading "not loaded" as zero promises a
    // delete that is then refused — issue 389 through the loading door.
    const line = deleteTypeWarning(undefined, 'blog_post', 'Blog post');
    expect(line).toContain('could not check');
    expect(line).toContain('refused');
  });

  it('promises the delete only when it has counted nothing anywhere', () => {
    const map = counts({ blog_post: { here: 3, allSites: 21 } });
    expect(deleteTypeWarning(map, 'testimonial', 'Testimonial')).toBe(
      'This removes the “Testimonial” type and its fields for good. This cannot be undone.'
    );
  });

  it('counts every site, because that is what the refusal counts', () => {
    const map = counts({ blog_post: { here: 3, allSites: 21 } });
    expect(deleteTypeWarning(map, 'blog_post', 'Blog post')).toBe(
      '21 entries use this type. 18 of them are on your other sites. You cannot delete it ' +
        'until those are removed: archiving them is not enough. This cannot be undone.'
    );
  });

  it('drops the other-sites clause for a tenant with one site', () => {
    const map = counts({ page: { here: 6, allSites: 6 } });
    expect(deleteTypeWarning(map, 'page', 'Page')).toBe(
      '6 entries use this type. You cannot delete it until those are removed: archiving ' +
        'them is not enough. This cannot be undone.'
    );
  });

  it('agrees with itself at one entry, and at one elsewhere', () => {
    expect(deleteTypeWarning(counts({ page: { here: 1, allSites: 1 } }), 'page', 'Page')).toContain(
      '1 entry uses this type.'
    );
    expect(deleteTypeWarning(counts({ page: { here: 0, allSites: 1 } }), 'page', 'Page')).toContain(
      '1 of them is on your other sites.'
    );
  });
});
