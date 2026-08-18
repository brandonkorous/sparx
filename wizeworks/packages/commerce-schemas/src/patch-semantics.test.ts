// Guard for a whole class of silent data loss — the commerce half of the same
// check that lives in @wizeworks/crm-schemas' patch-semantics.test.ts.
//
// `.partial()` makes a field optional but does NOT strip its `.default()`, so
// `CreateX.partial().parse({})` returns every defaulted field filled in, and
// update services write whatever is `!== undefined`. Real damage this caught:
// renaming a markup rule reset its scope to the ENTIRE catalog; editing a
// surcharge's label turned a flat fee into a percentage and switched it off;
// renaming a shipping profile cleared its carrier allow-list and hazmat classes.
//
// Generic on purpose — it walks every exported `Update*Input`, so a schema added
// tomorrow is covered without anyone remembering this file exists.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import * as schemas from './index';

// Patch schemas that legitimately REQUIRE a field, so `{}` doesn't parse. They
// can't fabricate anything (parsing failed); the list keeps each exemption
// visible rather than silently skipped.
const REQUIRES_A_FIELD = new Set([
  'UpdateCartItemInput',
  'UpdateCommerceSiteSettingsInput',
  'UpdateCommerceSiteThemeInput',
  'UpdateInventoryCountInput',
  'UpdateProviderConfigInput',
  'UpdateSerialStatusInput',
  'UpdateSubscriptionItemsInput',
  'UpdateSubscriptionScheduleInput',
  'UpdateTransferLineInput',
]);

function patchSchemas(): [string, z.ZodType][] {
  // Widened to `unknown` before filtering: the barrel exports constants as well as
  // schemas, so `Object.entries` types each value as a union that includes a plain
  // number — and a type predicate is only legal when its type is assignable to the
  // parameter's. `unknown` is what the `instanceof` check below actually assumes,
  // so saying so is honest rather than a cast around a real mismatch.
  const entries = Object.entries(schemas) as [string, unknown][];
  return entries
    .filter(
      (entry): entry is [string, z.ZodType] =>
        /^Update[A-Za-z0-9]*Input$/.test(entry[0]) && entry[1] instanceof z.ZodType
    )
    .sort((a, b) => a[0].localeCompare(b[0]));
}

describe('patch schemas never fabricate values', () => {
  it('finds the patch schemas to check', () => {
    expect(patchSchemas().length).toBeGreaterThan(15);
  });

  it.each(patchSchemas())('%s parses {} into {}', (name, schema) => {
    const result = schema.safeParse({});

    if (!result.success) {
      expect(
        REQUIRES_A_FIELD.has(name),
        `${name} rejects an empty patch. If that is intended, add it to REQUIRES_A_FIELD.`
      ).toBe(true);
      return;
    }

    expect(REQUIRES_A_FIELD.has(name), `${name} accepts {} — drop it from REQUIRES_A_FIELD.`).toBe(
      false
    );
    expect(Object.keys(result.data as Record<string, unknown>)).toEqual([]);
  });
});

describe('the specific losses that prompted this guard', () => {
  it('a markup-rule rename does not widen its scope to the whole catalog', () => {
    expect(schemas.UpdateMarkupRuleInput.parse({ name: 'Renamed' })).toEqual({ name: 'Renamed' });
  });

  it('a surcharge label edit does not change the fee type or switch it off', () => {
    expect(schemas.UpdateSurchargeRuleInput.parse({ label: 'Card fee' })).toEqual({
      label: 'Card fee',
    });
  });

  it('a shipping-profile rename does not clear carrier or hazmat restrictions', () => {
    expect(schemas.UpdateShippingProfileInput.parse({ name: 'Freight' })).toEqual({
      name: 'Freight',
    });
  });

  it('a price-list rename does not unpublish it', () => {
    expect(schemas.UpdatePriceListInput.parse({ name: 'Fall pricing' })).toEqual({
      name: 'Fall pricing',
    });
  });

  it('still lets a caller set a defaulted field explicitly', () => {
    expect(schemas.UpdateWarehouseInput.parse({ isActive: false })).toEqual({ isActive: false });
    expect(schemas.UpdateDiscountInput.parse({ priority: 0 })).toEqual({ priority: 0 });
  });
});
