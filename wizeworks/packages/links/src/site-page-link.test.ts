// A site page found in search opens in the editor, on that page, on its own site
// (sparx persona issue 130).

import { describe, expect, it } from 'vitest';
import { recordDestination, routeForEntity } from './resolve';

const PAGE = '0b7f6a52-4c1e-4e43-9d55-1f2b3c4d5e6f';
const SITE = '7d1e2f3a-5b6c-4d7e-8f90-a1b2c3d4e5f6';

describe('a site page in search', () => {
  it('has a home and a heading in the results', () => {
    expect(routeForEntity('builder_page')).toMatchObject({
      surface: 'builder.studio',
      entityLabel: 'Site pages',
    });
  });

  it('opens the editor on that page and names its site', () => {
    expect(recordDestination('builder_page', PAGE, `/builder?pageId=${PAGE}&site=${SITE}`)).toEqual(
      { surface: 'builder.studio', params: { pageId: PAGE }, site: SITE }
    );
  });

  it('never opens a page the address does not name', () => {
    const other = '11111111-2222-4333-8444-555555555555';
    expect(
      recordDestination('builder_page', PAGE, `/builder?pageId=${other}&site=${SITE}`)
    ).toEqual({ surface: 'builder.studio', params: {} });
  });
});
