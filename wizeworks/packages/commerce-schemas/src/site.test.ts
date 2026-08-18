// The dunning policy's no-clobber property (docs/142 §4.1).
//
// `UpdateCommerceSiteSettingsInput` replaces the WHOLE settings object, and it
// is exempt from patch-semantics.test.ts (it legitimately requires a currency,
// so `{}` never parses and the generic guard skips it). That exemption is
// exactly why this file exists: the generic check cannot see whether a NEW
// optional field on this schema fabricates a value.
//
// It would matter. `DunningPolicy` has a default for every field, so writing
// `defaultDunningPolicy: DunningPolicy.default({})` — the obvious thing — would
// make every existing caller that does not know about dunning (the MCP
// `update_commerce_site_settings` tool, any script) silently reset a tenant's
// retry policy to the defaults as a side effect of changing the currency.

import { describe, expect, it } from 'vitest';

import { DunningPolicy } from './subscriptions';
import { UpdateCommerceSiteSettingsInput } from './site';

const MINIMAL = { defaultCurrency: 'USD' as const };

describe('UpdateCommerceSiteSettingsInput — the dunning policy', () => {
  it('is ABSENT when the caller did not send one', () => {
    const parsed = UpdateCommerceSiteSettingsInput.parse(MINIMAL);
    // Not `undefined`-valued — absent. The service branches on truthiness, but
    // the key itself must not appear, so a spread of the parsed object into a
    // Prisma `update` cannot carry it.
    expect('defaultDunningPolicy' in parsed).toBe(false);
  });

  it('still fills in the OTHER defaulted fields, as it always has', () => {
    // The rest of this schema is a full replace by design — changing that here
    // would be a much bigger behaviour change than adding a field.
    const parsed = UpdateCommerceSiteSettingsInput.parse(MINIMAL);
    expect(parsed).toMatchObject({
      defaultLocale: 'en-US',
      channelsEnabled: ['storefront'],
      cartAbandonmentMinutes: 120,
      requireAuthForCheckout: false,
    });
  });

  it('accepts a partial policy and completes it from the schema defaults', () => {
    // The editor sends a whole policy, but an API caller setting only the final
    // outcome should get a coherent policy rather than a half one.
    const parsed = UpdateCommerceSiteSettingsInput.parse({
      ...MINIMAL,
      defaultDunningPolicy: { finalOutcome: 'cancel' },
    });
    expect(parsed.defaultDunningPolicy).toEqual({
      maxAttempts: 4,
      retryDelaysHours: [24, 72, 168, 336],
      finalOutcome: 'cancel',
      notifyCustomerOnFirstFailure: true,
      notifyCustomerOnFinalFailure: true,
    });
  });

  it('rejects a policy the billing engine could not honour', () => {
    // maxAttempts 0 would mean a card is never tried at all; a negative delay
    // would schedule the retry in the past and spin.
    expect(
      UpdateCommerceSiteSettingsInput.safeParse({
        ...MINIMAL,
        defaultDunningPolicy: { maxAttempts: 0 },
      }).success
    ).toBe(false);
    expect(
      UpdateCommerceSiteSettingsInput.safeParse({
        ...MINIMAL,
        defaultDunningPolicy: { retryDelaysHours: [-1] },
      }).success
    ).toBe(false);
    expect(
      UpdateCommerceSiteSettingsInput.safeParse({
        ...MINIMAL,
        defaultDunningPolicy: { finalOutcome: 'delete' },
      }).success
    ).toBe(false);
  });

  it('uses the same DunningPolicy the billing engine reads', () => {
    // One shape, not two. The bug docs/142 exists to correct was a field the
    // writer set and the reader never looked at.
    const viaSettings = UpdateCommerceSiteSettingsInput.parse({
      ...MINIMAL,
      defaultDunningPolicy: {},
    }).defaultDunningPolicy;
    expect(viaSettings).toEqual(DunningPolicy.parse({}));
  });
});
