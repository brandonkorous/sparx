// ADDING A DESIGN TO A SITE WITH PAGES REPLACES THEM.
//
// The install path syncs the design with `allowReplace: true`, and every page the
// site had is deleted. This pane said "Your existing pages and products are left
// exactly as they are" whichever site was chosen. The sentence is now sized to
// the site from the sites list's page count, and an uncounted site is never
// described as empty.

import { describe, expect, it } from 'vitest';

import { installImpact } from './blueprints-data';

describe('installImpact', () => {
  it('is an ordinary add on a site with no pages', () => {
    const impact = installImpact('Savory Donuts', 0);
    expect(impact.replaces).toBe(false);
    expect(impact.sentence).toContain('no pages yet');
  });

  it('names how many pages go on a site that has some', () => {
    const impact = installImpact('Savory Donuts', 9);
    expect(impact.replaces).toBe(true);
    expect(impact.pages).toBe(9);
    expect(impact.sentence).toContain('replaces all 9 of its pages');
    expect(impact.sentence).toContain('cannot be undone');
  });

  it('never calls an uncounted site empty', () => {
    const impact = installImpact('Savory Donuts', undefined);
    expect(impact.replaces).toBe(true);
    expect(impact.pages).toBeNull();
    expect(impact.sentence).not.toContain('no pages');
  });

  it('says what is kept, so the warning is not read as losing everything', () => {
    expect(installImpact('Savory Donuts', 1).sentence).toContain(
      'products, articles, customers and orders are not touched'
    );
  });
});
