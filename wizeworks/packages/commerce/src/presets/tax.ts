// Tax module presets (kind 'tax') — installable tax-zone + fallback-rate packs.
// These are merchant fallback rates used only when no TaxProvider (Stripe Tax /
// TaxJar / Avalara) is connected; real calculation always prefers the provider.
//
// Zones are region-specific (US-CA, CA-ON, …) so they never collide with the
// inactive country-level fallback zone `taxService.bootstrapDefaults` seeds on
// activation. Each install is guarded against a re-install by `commercePreset`.

import type { CreateTaxRateInput, CreateTaxZoneInput } from '@wizeworks/commerce-schemas';
import type { TenantContext } from '@wizeworks/db';

import { taxService } from '../services';

import { commercePreset } from './_kit';

interface ZonePack {
  zone: CreateTaxZoneInput;
  rate: Omit<CreateTaxRateInput, 'zoneId'>;
}

async function installZonePacks(sx: TenantContext, packs: ZonePack[]): Promise<{ id: string }> {
  let firstId = '';
  for (const pack of packs) {
    const zone = await taxService.createZone(sx, pack.zone);
    await taxService.createRate(sx, { zoneId: zone.id, ...pack.rate });
    if (!firstId) firstId = zone.id;
  }
  return { id: firstId };
}

export const taxPresets = [
  commercePreset({
    slug: 'tax-us-sales',
    kind: 'tax',
    name: 'US sales tax',
    description:
      'State sales-tax zones for California, Texas, and New York with fallback rates. A starting point you extend per state — real tax uses your connected provider when one is set.',
    iconKey: 'receipt',
    tags: ['tax', 'us', 'sales-tax'],
    summary: [
      { label: 'CA · TX · NY', tone: 'neutral' },
      { label: '3 state rates', tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.taxZone
        .findFirst({ where: { tenantId, country: 'US', region: 'US-CA' }, select: { id: true } })
        .then(Boolean),
    build: (sx) =>
      installZonePacks(sx, [
        {
          zone: { country: 'US', region: 'US-CA', nexusType: 'physical', isActive: true },
          rate: { name: 'California sales tax', rateBasisPoints: 725, appliesToShipping: false },
        },
        {
          zone: { country: 'US', region: 'US-TX', nexusType: 'physical', isActive: true },
          rate: { name: 'Texas sales tax', rateBasisPoints: 625, appliesToShipping: true },
        },
        {
          zone: { country: 'US', region: 'US-NY', nexusType: 'physical', isActive: true },
          rate: { name: 'New York sales tax', rateBasisPoints: 800, appliesToShipping: false },
        },
      ]),
  }),
  commercePreset({
    slug: 'tax-eu-vat-de',
    kind: 'tax',
    name: 'EU VAT — Germany',
    description:
      'A German VAT zone (economic nexus) with the 19% standard rate applied to goods and shipping. A template for selling into the EU under registered VAT.',
    iconKey: 'globe',
    tags: ['tax', 'eu', 'vat', 'germany'],
    summary: [
      { label: 'Germany · economic nexus', tone: 'neutral' },
      { label: '19% standard VAT', tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.taxZone
        .findFirst({ where: { tenantId, country: 'DE', region: null }, select: { id: true } })
        .then(Boolean),
    build: (sx) =>
      installZonePacks(sx, [
        {
          zone: { country: 'DE', nexusType: 'economic', isActive: true },
          rate: { name: 'German VAT (standard)', rateBasisPoints: 1900, appliesToShipping: true },
        },
      ]),
  }),
  commercePreset({
    slug: 'tax-ca-gst-hst',
    kind: 'tax',
    name: 'Canada GST/HST',
    description:
      'Provincial tax zones for Ontario (13% HST) and British Columbia (5% GST) with fallback rates — a base for Canadian federal + provincial tax.',
    iconKey: 'map-pin',
    tags: ['tax', 'canada', 'gst', 'hst'],
    summary: [
      { label: 'Ontario · British Columbia', tone: 'neutral' },
      { label: 'HST 13% · GST 5%', tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.taxZone
        .findFirst({ where: { tenantId, country: 'CA', region: 'CA-ON' }, select: { id: true } })
        .then(Boolean),
    build: (sx) =>
      installZonePacks(sx, [
        {
          zone: { country: 'CA', region: 'CA-ON', nexusType: 'physical', isActive: true },
          rate: { name: 'Ontario HST', rateBasisPoints: 1300, appliesToShipping: true },
        },
        {
          zone: { country: 'CA', region: 'CA-BC', nexusType: 'physical', isActive: true },
          rate: { name: 'British Columbia GST', rateBasisPoints: 500, appliesToShipping: true },
        },
      ]),
  }),
];
