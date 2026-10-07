import { describe, expect, it } from 'vitest';
import { withoutBusinessName } from './site-handle.js';

// Persona issue 927: "Juniper Row Lookbook" became
// `juniper-row-lookbook.juniper-row.piggles.site`.
describe('a new site’s handle', () => {
  it('drops the business’s name from the front', () => {
    expect(withoutBusinessName('juniper-row-lookbook', 'juniper-row')).toBe('lookbook');
  });

  it('leaves a handle that does not start with it', () => {
    expect(withoutBusinessName('lookbook-juniper-row', 'juniper-row')).toBe('lookbook-juniper-row');
    expect(withoutBusinessName('juniper-rowan', 'juniper-row')).toBe('juniper-rowan');
  });

  it('never leaves nothing, or the main site’s reserved handle', () => {
    expect(withoutBusinessName('juniper-row', 'juniper-row')).toBe('juniper-row');
    expect(withoutBusinessName('juniper-row-primary', 'juniper-row')).toBe('juniper-row-primary');
  });
});
