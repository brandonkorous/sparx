import { describe, expect, it } from 'vitest';
import { withoutBusinessName } from './site-address';

// Persona issue 927: "Juniper Row Lookbook" was offered
// `juniper-row-lookbook.juniper-row.piggles.site`, the business named twice.
describe('the handle a new site is offered', () => {
  const base = 'juniper-row.piggles.site';

  it('drops the business’s name from the front', () => {
    expect(withoutBusinessName('juniper-row-lookbook', base)).toBe('lookbook');
  });

  it('leaves a handle that does not start with it', () => {
    expect(withoutBusinessName('lookbook', base)).toBe('lookbook');
    expect(withoutBusinessName('juniper-rowan', base)).toBe('juniper-rowan');
  });

  it('never leaves nothing, or the main site’s reserved handle', () => {
    expect(withoutBusinessName('juniper-row', base)).toBe('juniper-row');
    expect(withoutBusinessName('juniper-row-primary', base)).toBe('juniper-row-primary');
  });

  it('changes nothing while the business address is still loading', () => {
    expect(withoutBusinessName('juniper-row-lookbook', null)).toBe('juniper-row-lookbook');
  });
});
