import { describe, expect, it } from 'vitest';
import { strandedZoneAddressIds } from './stranded-zone-address.js';

// Juniper Row's addresses as issue 648's repair left them (persona issue 927).
const rows = [
  { id: 'main', propertyId: 'primary', host: 'juniper-row.piggles.site', type: 'subdomain' },
  { id: 'old', propertyId: 'archive', host: 'archive.juniper-row.sparx.zone', type: 'subdomain' },
  { id: 'new', propertyId: 'archive', host: 'archive.juniper-row.piggles.site', type: 'subdomain' },
  { id: 'own', propertyId: 'archive', host: 'journal.juniperrow.test', type: 'custom' },
];

describe('free addresses that open nothing', () => {
  it('hides the old address in another brand’s zone once the site has its own', () => {
    expect([...strandedZoneAddressIds(rows, 'piggles.site')]).toEqual(['old']);
  });

  it('keeps a site’s only free address, even in the wrong zone', () => {
    const unrepaired = rows.filter((row) => row.id !== 'new');
    expect(strandedZoneAddressIds(unrepaired, 'piggles.site').size).toBe(0);
  });

  it('never hides a domain she connected', () => {
    const custom = [
      { id: 'a', propertyId: 'p', host: 'p.t.piggles.site', type: 'subdomain' },
      { id: 'b', propertyId: 'p', host: 'shop.example.com', type: 'custom' },
      { id: 'c', propertyId: 'p', host: 'example.com', type: 'purchased' },
    ];
    expect(strandedZoneAddressIds(custom, 'piggles.site').size).toBe(0);
  });
});
