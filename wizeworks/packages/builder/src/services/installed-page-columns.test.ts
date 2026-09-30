// A DESIGN GIVES YOU A LOOK. YOUR NAME IS YOURS.
//
// Issue 210 settled that for the brand override, and stopped installs stamping the
// sample company's `businessName` and tagline onto a real business. `seoTitle` and
// `seoDescription` are the same value one table over, and nobody went back for them:
// every one of the 191 shipped designs carries them, 158 name a business that does
// not exist, and 52 PUBLISHED pages across six real sites were wearing one. Two of
// those sites are Juniper Row's — nine pages each titled "Kestrel" and "Vérane",
// with descriptions to match (issue 852).
//
// That is the `<title>`: the browser tab, the search result, the link preview and the
// name a bookmark takes. There is nothing on the page that shows it, so it is the one
// piece of installed content an owner cannot find by looking at her own site.
//
// This is the allow-list both install seams write through, so the rule lives in one
// place and `installSite` and `addPage` cannot drift on it.

import { describe, expect, it } from 'vitest';
import { installedPageColumns } from './site-service';

/** A page exactly as a shipped bundle hands it over. */
function fromBundle(over: Record<string, unknown> = {}) {
  return {
    name: 'About',
    slug: 'about',
    root: { t: 'div' } as never,
    kind: 'singleton',
    seoTitle: 'About Kestrel — clothes that stay',
    seoDescription: 'Why Kestrel keeps the range small: essentials in honest cloth.',
    ...over,
  };
}

describe('installedPageColumns', () => {
  it('refuses the title a design was written around', () => {
    const cols = installedPageColumns(fromBundle());
    expect(cols).not.toHaveProperty('seoTitle');
    expect(JSON.stringify(cols)).not.toContain('Kestrel');
  });

  it('refuses the description too, which names the demo just as often', () => {
    // "Search Kestrel for a product, a collection or a page." Both columns are
    // written about the demo company, so fixing only the title leaves the sentence
    // under it still naming somebody else.
    const cols = installedPageColumns(
      fromBundle({ seoTitle: undefined, seoDescription: 'Search Kestrel for a product.' })
    );
    expect(cols).not.toHaveProperty('seoDescription');
  });

  it('still writes what makes a page a page', () => {
    const cols = installedPageColumns(
      fromBundle({ kind: 'collection', recordType: 'commerce.product', recordSubtype: null })
    );
    expect(cols.kind).toBe('collection');
    expect(cols.recordType).toBe('commerce.product');
    expect(cols.recordSubtype).toBeNull();
  });

  it('nulls the record columns rather than leaving them out', () => {
    // A singleton must CLEAR an incumbent recordType, not skip the column: a page
    // reused across an install would otherwise keep binding to a record type the
    // new design never gave it.
    const cols = installedPageColumns(fromBundle());
    expect(cols.recordType).toBeNull();
    expect(cols.recordSubtype).toBeNull();
  });

  it('carries the three SEO columns that cannot name a business', () => {
    // No bundle ships one today (0 of 191), so this changes nothing now — it is here
    // so a later design that does ship an og image is not quietly dropped along with
    // the two that had to go.
    const cols = installedPageColumns(
      fromBundle({ canonical: 'https://example.test/about', ogImage: 'media-1', noindex: true })
    );
    expect(cols.canonical).toBe('https://example.test/about');
    expect(cols.ogImage).toBe('media-1');
    expect(cols.noindex).toBe(true);
  });

  it('leaves out what the bundle did not mention', () => {
    // `undefined` means "the design said nothing", which must not be written as a
    // clear over a value the owner set herself.
    const cols = installedPageColumns({ name: 'About', slug: 'about', root: {} as never });
    expect(cols).not.toHaveProperty('canonical');
    expect(cols).not.toHaveProperty('ogImage');
    expect(cols).not.toHaveProperty('noindex');
  });

  it('never writes a title under any shape of input', () => {
    // The property, stated once: whatever a bundle hands over, the columns an install
    // writes contain neither of the two an owner cannot see.
    const shapes = [
      fromBundle(),
      fromBundle({ seoTitle: null, seoDescription: null }),
      fromBundle({ seoTitle: '', seoDescription: '' }),
      fromBundle({ kind: 'collection', recordType: 'commerce.product' }),
      { name: 'Home', slug: '', root: {} as never },
    ];
    for (const shape of shapes) {
      const cols = installedPageColumns(shape);
      expect(Object.keys(cols), JSON.stringify(shape)).not.toContain('seoTitle');
      expect(Object.keys(cols), JSON.stringify(shape)).not.toContain('seoDescription');
    }
  });
});
