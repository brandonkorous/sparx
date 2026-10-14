import { describe, expect, it } from 'vitest';
import { catalogFor } from './catalog-scope';

const keys = (scope: ReturnType<typeof catalogFor>) =>
  (scope.extend ?? []).flatMap((group) => group.items.map((item) => item.key));
const groups = (scope: ReturnType<typeof catalogFor>) =>
  (scope.extend ?? []).map((group) => group.key);

// P09: a journal that switched Selling and Bookings off was still offered Products, a
// Buy box, a Cart and a list of services to put on its pages.
describe('catalogFor', () => {
  it('offers everything on a site that switched nothing off', () => {
    const page = catalogFor('page');
    expect(groups(page)).toContain('commerce');
    expect(keys(page)).toContain('host:commerce.cart');
    expect(keys(page)).toContain('host:scheduling.services');
  });

  it('leaves out what the site switched off', () => {
    const page = catalogFor('page', ['commerce', 'scheduling']);
    expect(groups(page)).not.toContain('commerce');
    expect(keys(page).filter((key) => /^host:(commerce|scheduling)\./.test(key))).toEqual([
      // Site search finds writing too, and sign-in is the reader's account, so both stay.
      'host:commerce.search',
      'host:commerce.auth',
    ]);
    expect(groups(page)).toContain('writing');
  });

  it('keeps the writing on a site that switched off only selling', () => {
    expect(keys(catalogFor('page', ['commerce']))).toContain('host:cms.archive');
  });
});
