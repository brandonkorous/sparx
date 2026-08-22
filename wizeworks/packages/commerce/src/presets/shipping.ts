// Shipping module presets (kind 'shipping') — installable zone + profile + rate
// packs. These are merchant fallback rates (used when no carrier API is
// connected).
//
// Nothing seeds a zone on activation any more: installing one of these is a
// merchant SAYING they post things, and until they say it the quote offers
// collection instead (see services/collection-option.ts, issue #031).

import type {
  CreateShippingProfileInput,
  CreateShippingRateInput,
  CreateShippingZoneInput,
} from '@wizeworks/commerce-schemas';
import type { TenantContext } from '@wizeworks/db';

import { shippingService } from '../services';

import { commercePreset } from './_kit';

type RateSpec = Omit<CreateShippingRateInput, 'zoneId' | 'profileId'>;

async function installZoneProfileRates(
  sx: TenantContext,
  zone: CreateShippingZoneInput,
  profile: CreateShippingProfileInput,
  rates: RateSpec[]
): Promise<{ id: string }> {
  const createdZone = await shippingService.createZone(sx, zone);
  const createdProfile = await shippingService.createProfile(sx, profile);
  for (const rate of rates) {
    await shippingService.createRate(sx, {
      zoneId: createdZone.id,
      profileId: createdProfile.id,
      ...rate,
    });
  }
  return { id: createdZone.id };
}

export const shippingPresets = [
  commercePreset({
    slug: 'shipping-us-tiered',
    kind: 'shipping',
    name: 'US domestic — Economy / Standard / Express',
    description:
      'A US-only shipping zone with three flat-rate speeds: Economy (≈9 days), Standard (≈4 days), and Express (next day). Edit the prices to match your carrier.',
    iconKey: 'truck',
    tags: ['shipping', 'us', 'domestic', 'flat-rate'],
    summary: [
      { label: 'United States', tone: 'neutral' },
      { label: '3 speeds', tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.shippingZone
        .findFirst({ where: { tenantId, name: 'US domestic' }, select: { id: true } })
        .then(Boolean),
    build: (sx) =>
      installZoneProfileRates(
        sx,
        {
          name: 'US domestic',
          targeting: { countries: ['US'], regions: [], postalCodeRanges: [] },
          priority: 10,
        },
        {
          name: 'US domestic — standard goods',
          allowedCarrierServices: [],
          hazmatClassesAllowed: ['none'],
          requiresSignature: false,
          requiresFreight: false,
        },
        [
          {
            name: 'Economy',
            type: 'flat',
            amountCents: 595,
            currency: 'USD',
            carrier: 'USPS Ground Advantage',
            estimatedDeliveryDays: 9,
          },
          {
            name: 'Standard',
            type: 'flat',
            amountCents: 995,
            currency: 'USD',
            carrier: 'UPS Ground',
            estimatedDeliveryDays: 4,
          },
          {
            name: 'Express',
            type: 'flat',
            amountCents: 2495,
            currency: 'USD',
            carrier: 'FedEx Standard Overnight',
            estimatedDeliveryDays: 1,
          },
        ]
      ),
  }),
  commercePreset({
    slug: 'shipping-free-over-75',
    kind: 'shipping',
    name: 'Free shipping over $75',
    description:
      'A worldwide zone offering free shipping on orders of $75 or more, with weight-tiered rates below the threshold. A proven conversion lever for B2C catalogs.',
    iconKey: 'package-check',
    tags: ['shipping', 'free-shipping', 'threshold', 'weight'],
    summary: [
      { label: 'Worldwide', tone: 'neutral' },
      { label: 'Free over $75', tone: 'module' },
    ],
    marker: (tx, tenantId) =>
      tx.shippingZone
        .findFirst({
          where: { tenantId, name: 'Worldwide — free over $75' },
          select: { id: true },
        })
        .then(Boolean),
    build: (sx) =>
      installZoneProfileRates(
        sx,
        {
          name: 'Worldwide — free over $75',
          targeting: { countries: [], regions: [], postalCodeRanges: [] },
          priority: 5,
        },
        {
          name: 'Worldwide — standard goods',
          allowedCarrierServices: [],
          hazmatClassesAllowed: ['none'],
          requiresSignature: false,
          requiresFreight: false,
        },
        [
          {
            name: 'Free over $75',
            type: 'free_above_threshold',
            amountCents: 995,
            freeAboveCents: 7500,
            currency: 'USD',
            estimatedDeliveryDays: 7,
          },
          {
            name: 'Weight-based',
            type: 'by_weight',
            currency: 'USD',
            estimatedDeliveryDays: 7,
            bands: [
              { min: 0, max: 500, amountCents: 595 },
              { min: 500, max: 1000, amountCents: 795 },
              { min: 1000, max: 2000, amountCents: 1195 },
              { min: 2000, amountCents: 1995 },
            ],
          },
        ]
      ),
  }),
];
