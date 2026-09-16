// Who a tenant's own email says it is from.
//
// The address and the NAME in front of it are separate questions, and the code
// used to answer only the first. A shop with no verified sending domain — most
// of them — could type her business name into a field captioned "This is what
// your customers see in their inbox", save it, and have it discarded: the
// sender name was read only inside the branch that already had an address.
//
// Juniper Row did exactly that, and the send screen went on reading
// `Piggles <noreply@sparx.email>` after a refresh. Her customers had never
// heard of Piggles; the letterhead inside the same email said Juniper Row.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn<() => Promise<{ platformBrand: string | null } | null>>();
const siteRow = vi.fn<() => Promise<{ name: string } | null>>();

vi.mock('@wizeworks/db', () => ({
  prisma: { tenant: { findUnique: () => findUnique() } },
  withTenant: (_ctx: unknown, run: (tx: unknown) => unknown) =>
    run({
      property: { findUnique: () => siteRow(), findFirst: () => siteRow() },
    }),
}));

const { buildTenantFrom } = await import('../src/services/platform-sender');

describe('buildTenantFrom', () => {
  beforeEach(() => {
    findUnique.mockReset();
    siteRow.mockReset();
    // Most tests are about a site that HAS a name; the ones that are not say so.
    siteRow.mockResolvedValue({ name: 'Juniper Row' });
    findUnique.mockResolvedValue({ platformBrand: 'piggles' });
    process.env.SPARX_EMAIL_FROM = 'sparx <noreply@sparx.email>';
    // The brand's display name is environment, not a constant, so it is set
    // here rather than assumed — otherwise the identity falls back to the brand
    // KEY and the test would be asserting a lowercase accident.
    process.env.PIGGLES_BRAND_NAME = 'Piggles';
    delete process.env.PIGGLES_EMAIL_FROM;
  });

  it('puts the name SHE typed in front of the shared address', async () => {
    // The defect, in one line. She has no `fromAddress` — she has not verified a
    // domain and the settings screen says she need not — so the old code went
    // straight to the platform and threw her answer away.
    //
    // The typed name is deliberately not the site's name: if it were, this would
    // still pass off the fallback below and prove nothing.
    expect(await buildTenantFrom('t1', 'Devi at Juniper Row', null, 'site-1')).toBe(
      'Devi at Juniper Row <noreply@sparx.email>'
    );
  });

  it('uses her own address and her own name once she has verified one', async () => {
    expect(
      await buildTenantFrom('t1', 'Devi at Juniper Row', 'hello@juniperrow.com', 'site-1')
    ).toBe('Devi at Juniper Row <hello@juniperrow.com>');
  });

  it('signs a blank one with the name the SITE trades under', async () => {
    // A shop that never opened the settings screen still has a name — it is on
    // the letterhead of the very email. The software she rents is not a party
    // to the conversation, so it does not get the byline.
    expect(await buildTenantFrom('t1', null, null, 'site-1')).toBe(
      'Juniper Row <noreply@sparx.email>'
    );
    expect(await buildTenantFrom('t1', '   ', null, 'site-1')).toBe(
      'Juniper Row <noreply@sparx.email>'
    );
  });

  it('signs a blank one with the site even on her own verified address', async () => {
    expect(await buildTenantFrom('t1', null, 'hello@juniperrow.com', 'site-1')).toBe(
      'Juniper Row <hello@juniperrow.com>'
    );
  });

  it('asks for the SITE, so one owner’s two shops never borrow each other', async () => {
    siteRow.mockResolvedValue({ name: 'Savory Donuts' });
    expect(await buildTenantFrom('t1', null, null, 'the-bakery')).toBe(
      'Savory Donuts <noreply@sparx.email>'
    );
  });

  it('names the platform only when there is no site name at all', async () => {
    // The last resort, and only that. A site with no name is the one case where
    // the platform has nothing of hers to sign with.
    siteRow.mockResolvedValue(null);
    expect(await buildTenantFrom('t1', null, null, 'site-1')).toBe('Piggles <noreply@sparx.email>');
  });

  it('falls back to a bare address when there is no name anywhere', async () => {
    siteRow.mockResolvedValue({ name: '   ' });
    expect(await buildTenantFrom('t1', null, 'hello@juniperrow.com', 'site-1')).toBe(
      'hello@juniperrow.com'
    );
  });

  it('quotes a name a header cannot carry bare', async () => {
    // Unquoted, the comma ends the name and starts a second recipient that does
    // not exist — so the shop whose mail breaks is the one called "Inc."
    expect(await buildTenantFrom('t1', 'Bob’s Parts, Inc.', null, 'site-1')).toBe(
      '"Bob’s Parts, Inc." <noreply@sparx.email>'
    );
    expect(await buildTenantFrom('t1', 'Bob’s Parts, Inc.', 'hi@bobs.test', 'site-1')).toBe(
      '"Bob’s Parts, Inc." <hi@bobs.test>'
    );
  });

  it('escapes a quote inside the name rather than closing the quoted string', async () => {
    expect(await buildTenantFrom('t1', 'The "Good" Shop', null, 'site-1')).toBe(
      '"The \\"Good\\" Shop" <noreply@sparx.email>'
    );
  });

  it('still sends when the tenant row cannot be read', async () => {
    // Best-effort by design: mail with the wrong word in front of it beats mail
    // that does not go out. Her name still rides it.
    findUnique.mockRejectedValue(new Error('no database'));
    expect(await buildTenantFrom('t1', 'Devi at Juniper Row', null, 'site-1')).toBe(
      'Devi at Juniper Row <noreply@sparx.email>'
    );
  });
});
