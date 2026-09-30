// Which sites a page is on, said in a table cell (issue 870).
//
// Three cases, and the whole point is that they stay three. "All sites" is the
// EMPTY list, a pinned page is a NON-empty list, and a row whose scope never
// arrived is NEITHER. Collapsing the third into the first is the tempting bug:
// `propertyIds ?? []` reads as "every site" and would put that claim on every
// row of a stale cache.

import { describe, expect, it } from 'vitest';

import { showSiteColumn, siteScopeCell } from './content-sites';

const SITES: Record<string, string> = {
  a: 'Juniper Row Journal',
  b: 'Juniper Row Press',
  c: 'Juniper Row Lookbook',
};
const nameOf = (id: string) => SITES[id];

describe('the three cases stay three', () => {
  it('says nothing when the scope never arrived', () => {
    expect(siteScopeCell(undefined, nameOf)).toBeNull();
  });

  it('calls the empty list every site, and marks it', () => {
    expect(siteScopeCell([], nameOf)).toEqual({ text: 'All sites', everySite: true });
  });

  it('never marks a pinned page as every site', () => {
    expect(siteScopeCell(['a'], nameOf)?.everySite).toBe(false);
    expect(siteScopeCell(['a', 'b'], nameOf)?.everySite).toBe(false);
    expect(siteScopeCell(['a', 'b', 'c'], nameOf)?.everySite).toBe(false);
  });
});

describe('naming the sites', () => {
  it('names one', () => {
    expect(siteScopeCell(['a'], nameOf)?.text).toBe('Juniper Row Journal');
  });

  it('names two, joined in words', () => {
    expect(siteScopeCell(['a', 'b'], nameOf)?.text).toBe(
      'Juniper Row Journal and Juniper Row Press'
    );
  });

  it('counts three or more, because the names stop fitting a cell', () => {
    expect(siteScopeCell(['a', 'b', 'c'], nameOf)?.text).toBe('3 sites');
  });

  it('counts rather than invents when a site is not known', () => {
    // A page pinned to a site that has since been removed is still pinned to
    // something. Naming only the survivor would under-report the scope.
    expect(siteScopeCell(['a', 'gone'], nameOf)?.text).toBe('2 sites');
    expect(siteScopeCell(['gone'], nameOf)?.text).toBe('1 site');
  });

  it('counts rather than prints a blank name', () => {
    expect(siteScopeCell(['blank'], (id) => (id === 'blank' ? '' : undefined))?.text).toBe(
      '1 site'
    );
  });

  it('gets the singular right', () => {
    expect(siteScopeCell(['gone'], nameOf)?.text).not.toContain('sites');
  });
});

describe('whether the column belongs on screen', () => {
  it('is hidden for a business with one website, because there is no choice', () => {
    expect(showSiteColumn(1)).toBe(false);
    expect(showSiteColumn(0)).toBe(false);
  });

  it('is shown as soon as there are two', () => {
    expect(showSiteColumn(2)).toBe(true);
    expect(showSiteColumn(7)).toBe(true);
  });
});
