// Where a supplier ships an order: the address the customer chose at checkout.
//
// An order stores it as `AddressSnapshot` (crm-schemas `common-commerce.ts`):
// `recipientName`, `company`, `line1`, `line2`, `city`, `region`, `postalCode`,
// `country`, `phone`. The router read other keys (`name`, `address1`, `province`,
// `zip`), so every supplier was sent an address with no name on it (sparx persona
// issue 214). Those older keys are still read second, for an order stored before.

import type { ShippingAddress } from '@wizeworks/dropship';

type Raw = Record<string, unknown> | null | undefined;

/** The first of `keys` that holds words, trimmed; undefined when none does. */
function first(raw: Raw, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return undefined;
}

export function shipToOf(raw: Raw): ShippingAddress {
  return {
    name: first(raw, 'recipientName', 'name') ?? '',
    company: first(raw, 'company'),
    line1: first(raw, 'line1', 'address1') ?? '',
    line2: first(raw, 'line2', 'address2'),
    city: first(raw, 'city') ?? '',
    region: first(raw, 'region', 'province'),
    postalCode: first(raw, 'postalCode', 'zip') ?? '',
    countryCode: first(raw, 'country', 'countryCode') ?? 'US',
    phone: first(raw, 'phone'),
  };
}
