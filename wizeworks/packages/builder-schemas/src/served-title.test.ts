// The title a search result shows (sparx persona issue 134).

import { describe, expect, it } from 'vitest';
import { servedPageTitle, servedTitle } from './served-title';

const SITE = 'Gillett Diesel Service';

describe('servedTitle', () => {
  it('adds the business name to a page title, as the site serves it', () => {
    expect(servedTitle('About Gillett Diesel: Bluffdale diesel shop since 1986', SITE)).toBe(
      'About Gillett Diesel: Bluffdale diesel shop since 1986 · Gillett Diesel Service'
    );
  });

  it('adds nothing to a title that already names the business', () => {
    expect(servedTitle('About Gillett Diesel Service, Bluffdale, Utah', SITE)).toBe(
      'About Gillett Diesel Service, Bluffdale, Utah'
    );
  });

  it('serves the home page title as written', () => {
    expect(servedTitle('Diesel parts and service in Bluffdale, Utah', SITE, { home: true })).toBe(
      'Diesel parts and service in Bluffdale, Utah'
    );
  });
});

describe('servedPageTitle', () => {
  it('shows the business name for a home page with no search title', () => {
    expect(servedPageTitle({ seoTitle: '', pageName: 'Home', siteName: SITE, home: true })).toBe(
      SITE
    );
  });

  it('shows the page name with the business name for any other page', () => {
    expect(
      servedPageTitle({ seoTitle: null, pageName: 'About', siteName: SITE, home: false })
    ).toBe('About · Gillett Diesel Service');
  });
});
