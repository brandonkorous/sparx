// sparx.market merchant service (docs/106 §4.7) — the seller's editable profile,
// participation toggle, and ACH payout account.
//
// Participation in sparx.market lives in MarketMerchantProfile.enabled (the
// first-party channel has no OAuth connection — the channels API + dashboard
// special-case the `first_party` shape and call enable/disable here). Enabling
// surfaces the merchant in the directory; disabling tears down every listing +
// the directory row. Payout bank details are AES-256-GCM ciphertext (the same
// @wizeworks/channels/crypto box the OAuth tokens use), never plaintext.

import { withTenant } from '@wizeworks/db';
import { encryptChannelToken, decryptChannelToken } from '@wizeworks/channels/crypto';
import {
  MarketMerchantProfileInput,
  MarketPayoutAccountInput,
  resolveCommissionBps,
} from '@wizeworks/commerce-schemas';

import { writeAuditLog } from '../../audit';
import { CommerceValidationError } from '../../errors';
import type { ServiceContext } from '../../errors';

import { platformCommissionBps } from './commission';
import { removeAllMarketProjection, reprojectAllListed } from './projection';

export interface MarketMerchantProfileView {
  enabled: boolean;
  bio: string | null;
  location: string | null;
  headline: string | null;
  bannerMediaId: string | null;
  defaultCategory: string | null;
  /** The site this tenant markets AS + its public handle (docs/131 §7). */
  marketPropertyId: string | null;
  handle: string | null;
  /** The effective commission (bps) this tenant pays — override or platform default. */
  commissionBps: number;
  /** Whether a custom override is set (vs the platform default). */
  hasCommissionOverride: boolean;
}

function toView(profile: {
  enabled: boolean;
  bio: string | null;
  location: string | null;
  headline: string | null;
  bannerMediaId: string | null;
  defaultCategory: string | null;
  marketPropertyId: string | null;
  handle: string | null;
  commissionBpsOverride: number | null;
}): MarketMerchantProfileView {
  return {
    enabled: profile.enabled,
    bio: profile.bio,
    location: profile.location,
    headline: profile.headline,
    bannerMediaId: profile.bannerMediaId,
    defaultCategory: profile.defaultCategory,
    marketPropertyId: profile.marketPropertyId,
    handle: profile.handle,
    commissionBps: resolveCommissionBps(profile.commissionBpsOverride, platformCommissionBps()),
    hasCommissionOverride: profile.commissionBpsOverride !== null,
  };
}

/** The merchant's sparx.market profile, defaulting to a disabled stub when absent. */
export async function getMerchantProfile(ctx: ServiceContext): Promise<MarketMerchantProfileView> {
  const profile = await withTenant(ctx, (tx) =>
    tx.marketMerchantProfile.findUnique({ where: { tenantId: ctx.tenantId } })
  );
  return toView(
    profile ?? {
      enabled: false,
      bio: null,
      location: null,
      headline: null,
      bannerMediaId: null,
      defaultCategory: null,
      marketPropertyId: null,
      handle: null,
      commissionBpsOverride: null,
    }
  );
}

/**
 * Upsert the merchant profile (the participation toggle + public fields). When the
 * `commissionBpsOverride` field is present it is applied — the ROUTE gates whether a
 * caller may set it (platform-admin only). Toggling `enabled` off tears down the
 * tenant's whole marketplace presence; toggling it on refreshes the directory row.
 */
export async function updateMerchantProfile(
  ctx: ServiceContext,
  input: MarketMerchantProfileInput,
  opts: { allowCommissionOverride?: boolean } = {}
): Promise<MarketMerchantProfileView> {
  const data = MarketMerchantProfileInput.parse(input);

  const result = await withTenant(ctx, async (tx) => {
    // The marketed SITE (docs/131 §7): if named, it must be one of THIS tenant's own
    // properties (RLS scopes the lookup, so a foreign id simply isn't found).
    if (data.marketPropertyId) {
      const owned = await tx.property.findFirst({
        where: { id: data.marketPropertyId },
        select: { id: true },
      });
      if (!owned) throw new CommerceValidationError('That site is not one of yours.');
    }
    const base = {
      enabled: data.enabled,
      bio: data.bio ?? null,
      location: data.location ?? null,
      headline: data.headline ?? null,
      bannerMediaId: data.bannerMediaId ?? null,
      defaultCategory: data.defaultCategory ?? null,
      // Only touch handle / market site when the caller sent them, so a plain
      // enable/disable toggle never clears a previously-claimed handle.
      ...(data.handle !== undefined ? { handle: data.handle } : {}),
      ...(data.marketPropertyId !== undefined ? { marketPropertyId: data.marketPropertyId } : {}),
    };
    const overrideField =
      opts.allowCommissionOverride && data.commissionBpsOverride !== undefined
        ? { commissionBpsOverride: data.commissionBpsOverride }
        : {};
    // The handle is a GLOBAL namespace but market_merchant_profiles is RLS-scoped, so
    // the app can't read another tenant's handle to pre-check — the DB unique index is
    // the real backstop. Translate its violation into a friendly claim error (docs/131 §7).
    const profile = await tx.marketMerchantProfile
      .upsert({
        where: { tenantId: ctx.tenantId },
        create: { tenantId: ctx.tenantId, ...base, ...overrideField },
        update: { ...base, ...overrideField },
      })
      .catch((err: unknown) => {
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code?: string }).code === 'P2002'
        ) {
          throw new CommerceValidationError('That marketplace handle is already taken.');
        }
        throw err;
      });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.market.profile_updated',
      entityType: 'MarketMerchantProfile',
      entityId: profile.id,
      diff: { after: { enabled: profile.enabled } },
    });
    return profile;
  });

  // Disabling tears down all projection. Enabling re-projects every previously
  // listed product (the `marketListed` flags survive a pause; the projection rows
  // do not) and refreshes the directory row with the latest identity.
  if (!result.enabled) {
    await removeAllMarketProjection(ctx);
  } else {
    await reprojectAllListed(ctx);
  }
  return toView(result);
}

// ── Payout account (encrypted ACH bank details) ─────────────────────────────────

export interface MarketPayoutAccountView {
  accountHolderName: string;
  bankName: string | null;
  accountLast4: string | null;
  accountType: string;
  status: string;
}

/** The masked payout account for the dashboard — never the decrypted numbers. */
export async function getPayoutAccount(
  ctx: ServiceContext
): Promise<MarketPayoutAccountView | null> {
  const acct = await withTenant(ctx, (tx) =>
    tx.marketPayoutAccount.findUnique({ where: { tenantId: ctx.tenantId } })
  );
  if (!acct) return null;
  return {
    accountHolderName: acct.accountHolderName,
    bankName: acct.bankName,
    accountLast4: acct.accountLast4,
    accountType: acct.accountType,
    status: acct.status,
  };
}

/** Capture / replace the ACH payout bank account. Routing + account numbers are
 *  encrypted at rest; only the last 4 are kept in the clear for display. */
export async function upsertPayoutAccount(
  ctx: ServiceContext,
  input: MarketPayoutAccountInput
): Promise<MarketPayoutAccountView> {
  const data = MarketPayoutAccountInput.parse(input);
  const last4 = data.accountNumber.slice(-4);

  const acct = await withTenant(ctx, async (tx) => {
    const base = {
      accountHolderName: data.accountHolderName,
      bankName: data.bankName ?? null,
      routingNumberEnc: encryptChannelToken(data.routingNumber),
      accountNumberEnc: encryptChannelToken(data.accountNumber),
      accountLast4: last4,
      accountType: data.accountType,
      // Re-capture resets verification — a new account starts pending.
      status: 'pending',
    };
    return tx.marketPayoutAccount.upsert({
      where: { tenantId: ctx.tenantId },
      create: { tenantId: ctx.tenantId, ...base },
      update: base,
    });
  });

  return {
    accountHolderName: acct.accountHolderName,
    bankName: acct.bankName,
    accountLast4: acct.accountLast4,
    accountType: acct.accountType,
    status: acct.status,
  };
}

export interface DecryptedPayoutAccount {
  accountHolderName: string;
  bankName: string | null;
  routingNumber: string;
  accountNumber: string;
  accountType: string;
  status: string;
}

/** Decrypt the payout account for DISBURSEMENT only (the settlement payout provider).
 *  Server-internal — never exposed over the API. Returns null when no account is on
 *  file (the run is held `pending` until the merchant adds one). */
export async function getDecryptedPayoutAccount(
  ctx: ServiceContext
): Promise<DecryptedPayoutAccount | null> {
  const acct = await withTenant(ctx, (tx) =>
    tx.marketPayoutAccount.findUnique({ where: { tenantId: ctx.tenantId } })
  );
  if (!acct) return null;
  try {
    return {
      accountHolderName: acct.accountHolderName,
      bankName: acct.bankName,
      routingNumber: decryptChannelToken(acct.routingNumberEnc),
      accountNumber: decryptChannelToken(acct.accountNumberEnc),
      accountType: acct.accountType,
      status: acct.status,
    };
  } catch {
    throw new CommerceValidationError(
      'Payout account could not be decrypted — re-enter the bank details (the encryption key may have rotated).'
    );
  }
}
