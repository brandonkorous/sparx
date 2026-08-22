// The gateway catalog names a PRODUCT, and the platform runs two of them.
//
// Found by a Piggles bakery opening the provider picker to choose who handles
// her money and reading "No sparx fee" seven times down one page. See
// `gatewayCatalog`'s header in ./catalog.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PLATFORM_TOKEN } from '@wizeworks/brand-core';
import {
  CATALOG_GATEWAY_IDS,
  gatewayCatalog,
  gatewayCatalogTemplate,
  getGatewayDescriptor,
} from './catalog';

const TOUCHED = ['SPARX_BRAND_NAME', 'PIGGLES_BRAND_NAME'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));
  process.env.SPARX_BRAND_NAME = 'sparx';
  process.env.PIGGLES_BRAND_NAME = 'Piggles';
});

afterEach(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/** Every string on a descriptor that a person actually reads. */
function readableText(brand: string): string {
  return gatewayCatalog(brand)
    .flatMap((g) => [
      g.name,
      g.blurb,
      g.feeNote,
      g.tagline ?? '',
      ...g.credentialFields.flatMap((f) => [f.label, f.help ?? '', f.placeholder ?? '']),
    ])
    .join(' | ');
}

describe('gatewayCatalog', () => {
  it('never shows a Piggles business another company’s name', () => {
    expect(readableText('piggles')).not.toContain('sparx');
  });

  it('never shows a sparx business the other one either', () => {
    expect(readableText('sparx')).not.toContain('Piggles');
  });

  it('leaves no unresolved token on a live screen — the failure that looks like working software', () => {
    expect(readableText('piggles')).not.toContain(PLATFORM_TOKEN);
    expect(readableText('sparx')).not.toContain(PLATFORM_TOKEN);
  });

  it('RESOLVES the first-party product’s name rather than removing it', () => {
    expect(getGatewayDescriptor('sparx_pay', 'piggles')?.name).toBe('Piggles Pay');
    expect(getGatewayDescriptor('sparx_pay', 'sparx')?.name).toBe('sparx Pay');
  });

  it('keeps the gateway id out of it — a wire value and a stored column', () => {
    expect(getGatewayDescriptor('sparx_pay', 'piggles')?.id).toBe('sparx_pay');
    expect(CATALOG_GATEWAY_IDS).toContain('sparx_pay');
  });

  it('says the same thing to both brands apart from the name', () => {
    const piggles = getGatewayDescriptor('stripe_direct', 'piggles');
    const sparx = getGatewayDescriptor('stripe_direct', 'sparx');
    expect(piggles?.feeNote).toBe('No Piggles fee — you pay Stripe’s rates directly.');
    expect(sparx?.feeNote).toBe('No sparx fee — you pay Stripe’s rates directly.');
    expect(piggles?.capabilities).toEqual(sparx?.capabilities);
  });

  it('hands back the same array on a repeat read, so the picker does not rebuild it', () => {
    expect(gatewayCatalog('piggles')).toBe(gatewayCatalog('piggles'));
  });
});

describe('gatewayCatalogTemplate', () => {
  it('still carries the token — it is the ONE unresolved accessor, and it is named to warn', () => {
    const stripe = gatewayCatalogTemplate().find((g) => g.id === 'stripe_direct');
    expect(stripe?.feeNote).toContain(PLATFORM_TOKEN);
  });

  it('covers every gateway the resolved catalog does', () => {
    expect(gatewayCatalogTemplate().map((g) => g.id)).toEqual([...CATALOG_GATEWAY_IDS]);
  });
});
