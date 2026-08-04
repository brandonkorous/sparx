// paymentMethodService — a shopper's saved cards (docs/142 §4).
//
// The vault exists so a renewal can be charged when the customer is nowhere
// near the site. sparx holds the GATEWAY'S TOKEN and the four fields needed to
// render "Visa ending 4242" — never a card number. The card is captured by the
// gateway's own hosted element, which hands back a token this service persists.
//
// Two-step by necessity: `beginSetup` opens a session the browser completes
// against the gateway, and `completeSetup` reads the result back and writes the
// row. Nothing is stored in between, so a shopper who abandons the card form
// leaves no trace.

import { paymentService, StoredMethodsUnsupportedError } from '@sparx/payments';
import { withTenant } from '@sparx/db';
import type { CustomerPaymentMethod, TxClient } from '@sparx/db';

import { CommerceConflictError, CommerceNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

export interface SavedPaymentMethod {
  id: string;
  gatewayId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  status: string;
  /** True when the card's own expiry has passed. Derived rather than stored, so
   *  it is right the day it happens instead of the next time something writes
   *  the row. */
  isExpired: boolean;
  /** How many active subscriptions renew on this. Non-zero is why removing it
   *  is refused, so the number has to be available wherever the remove button
   *  is. */
  subscriptionCount: number;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface BeginSetupResult {
  /** Hand to the browser's card element (inline gateways). */
  clientSecret: string | null;
  /** Send the shopper here instead (redirect gateways). */
  redirectUrl: string | null;
  publishableKey?: string;
  /** Echo back to `completeSetup` once the shopper finishes. */
  setupRef: string;
}

// ─── Reads ───────────────────────────────────────────────────────────

export async function list(ctx: ServiceContext, customerId: string): Promise<SavedPaymentMethod[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx.customerPaymentMethod.findMany({
      where: { customerId, status: { not: 'revoked' } },
      include: { _count: { select: { subscriptions: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })
  );
  return rows.map(toSaved);
}

export async function get(ctx: ServiceContext, id: string): Promise<SavedPaymentMethod> {
  const row = await withTenant(ctx, (tx) =>
    tx.customerPaymentMethod.findFirst({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    })
  );
  if (!row) throw new CommerceNotFoundError('PaymentMethod', id);
  return toSaved(row);
}

/** Whether this tenant can save cards at all. The storefront asks before it
 *  offers a "save this card" checkbox, so a shopper on a `manual` tenant is
 *  never shown a promise the platform cannot keep. */
export async function canSaveMethods(ctx: ServiceContext): Promise<boolean> {
  try {
    return await paymentService.supportsStoredMethods(ctx.tenantId);
  } catch {
    // No gateway configured yet — same answer as "cannot", and not worth
    // erroring a storefront render over.
    return false;
  }
}

// ─── Vaulting ────────────────────────────────────────────────────────

/**
 * Open a setup session. The card is collected by the gateway from here on —
 * this returns only what the browser needs to talk to it directly.
 *
 * Reuses the customer's existing gateway-side customer ref when there is one, so
 * a shopper with three saved cards is one Customer at the gateway rather than
 * three.
 */
export async function beginSetup(
  ctx: ServiceContext,
  input: { customerId: string; description?: string; returnUrl?: string }
): Promise<BeginSetupResult> {
  const existingRef = await withTenant(ctx, (tx) =>
    tx.customerPaymentMethod.findFirst({
      where: { customerId: input.customerId, customerRef: { not: null } },
      select: { customerRef: true },
      orderBy: { createdAt: 'desc' },
    })
  );

  const session = await paymentService.createSetupSession({
    tenantId: ctx.tenantId,
    customerId: input.customerId,
    ...(existingRef?.customerRef ? { customerRef: existingRef.customerRef } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.returnUrl ? { returnUrl: input.returnUrl } : {}),
  });

  return {
    clientSecret: session.clientSecret,
    redirectUrl: session.redirectUrl,
    ...(session.publishableKey ? { publishableKey: session.publishableKey } : {}),
    setupRef: session.setupRef,
  };
}

/**
 * Read the vaulted method back and persist it.
 *
 * Idempotent on (tenant, gateway, token): the browser can call this twice, or a
 * redirect gateway can bounce the shopper back through the return URL on a
 * refresh, without minting duplicate cards.
 */
export async function completeSetup(
  ctx: ServiceContext,
  input: {
    customerId: string;
    /** Stripe: the SetupIntent id from `beginSetup`. */
    setupRef?: string;
    /** Square / Authorize.net: the one-time card token from their browser SDK. */
    token?: string;
    makeDefault?: boolean;
  }
): Promise<SavedPaymentMethod | null> {
  const existingRef = await withTenant(ctx, (tx) =>
    tx.customerPaymentMethod.findFirst({
      where: { customerId: input.customerId, customerRef: { not: null } },
      select: { customerRef: true },
      orderBy: { createdAt: 'desc' },
    })
  );

  const vaulted = await paymentService.completeVault({
    tenantId: ctx.tenantId,
    customerId: input.customerId,
    ...(input.setupRef ? { setupRef: input.setupRef } : {}),
    ...(input.token ? { token: input.token } : {}),
    ...(existingRef?.customerRef ? { customerRef: existingRef.customerRef } : {}),
  });
  // The shopper opened the card form and never finished. Not an error — there is
  // simply nothing to save.
  if (!vaulted) return null;

  const gateway = await paymentService.getGatewayForTenant(ctx.tenantId);

  const row = await withTenant(ctx, async (tx) => {
    const existingCount = await tx.customerPaymentMethod.count({
      where: { customerId: input.customerId, status: 'active' },
    });
    // The first card a customer saves is their default whether they asked or
    // not — a saved card that is nobody's default would never be picked up by a
    // subscription that did not name one explicitly.
    const isDefault = input.makeDefault === true || existingCount === 0;

    if (isDefault) {
      await tx.customerPaymentMethod.updateMany({
        where: { customerId: input.customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.customerPaymentMethod.upsert({
      where: {
        tenantId_gatewayId_methodRef: {
          tenantId: ctx.tenantId,
          gatewayId: gateway.id,
          methodRef: vaulted.methodRef,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        customerId: input.customerId,
        gatewayId: gateway.id,
        methodRef: vaulted.methodRef,
        customerRef: vaulted.customerRef,
        brand: vaulted.brand,
        last4: vaulted.last4,
        expMonth: vaulted.expMonth,
        expYear: vaulted.expYear,
        isDefault,
        status: 'active',
      },
      update: {
        customerRef: vaulted.customerRef,
        brand: vaulted.brand,
        last4: vaulted.last4,
        expMonth: vaulted.expMonth,
        expYear: vaulted.expYear,
        status: 'active',
        ...(isDefault ? { isDefault: true } : {}),
      },
      include: { _count: { select: { subscriptions: true } } },
    });
  });

  return toSaved(row);
}

export async function setDefault(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const method = await requireMethod(tx, id);
    await tx.customerPaymentMethod.updateMany({
      where: { customerId: method.customerId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.customerPaymentMethod.update({ where: { id }, data: { isDefault: true } });
  });
}

/**
 * Remove a saved card.
 *
 * Refused while a live subscription renews on it. The database enforces this too
 * (`ON DELETE RESTRICT`), but a foreign-key violation surfaced to a shopper is a
 * 500 with no explanation — so the count is checked first and the refusal says
 * what is in the way and how many.
 */
export async function remove(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await requireMethod(tx, id);
    const live = await tx.subscription.count({
      where: { paymentMethodId: id, status: { in: ['active', 'trialing', 'past_due', 'paused'] } },
    });
    if (live > 0) {
      throw new CommerceConflictError(
        live === 1
          ? 'This card is being used by a repeat order. Switch that order to a different card first.'
          : `This card is being used by ${live} repeat orders. Switch those orders to a different card first.`,
        'paymentMethodId'
      );
    }
    await tx.customerPaymentMethod.delete({ where: { id } });
  });
}

/**
 * Mark a method permanently unusable.
 *
 * Called by the dunning ladder when a gateway reports the card as dead rather
 * than declined. Kept (not deleted) because a cancelled subscription still
 * points at it and the history should stay readable.
 */
export async function markRevoked(ctx: ServiceContext, id: string, reason: string): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.customerPaymentMethod.updateMany({
      where: { id },
      data: { status: 'revoked' },
    })
  );
  void reason;
}

/** Stamp a successful use, so "last used" on the account screen is true. */
export async function markUsed(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.customerPaymentMethod.updateMany({ where: { id }, data: { lastUsedAt: new Date() } })
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

async function requireMethod(tx: TxClient, id: string): Promise<CustomerPaymentMethod> {
  const row = await tx.customerPaymentMethod.findFirst({ where: { id } });
  if (!row) throw new CommerceNotFoundError('PaymentMethod', id);
  return row;
}

/** A card is expired once its expiry month has fully passed. */
export function isMethodExpired(expMonth: number | null, expYear: number | null): boolean {
  if (!expMonth || !expYear) return false;
  const now = new Date();
  const lastValid = new Date(Date.UTC(expYear, expMonth, 1));
  return now.getTime() >= lastValid.getTime();
}

function toSaved(
  row: CustomerPaymentMethod & { _count?: { subscriptions: number } }
): SavedPaymentMethod {
  return {
    id: row.id,
    gatewayId: row.gatewayId,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    isDefault: row.isDefault,
    status: row.status,
    isExpired: isMethodExpired(row.expMonth, row.expYear),
    subscriptionCount: row._count?.subscriptions ?? 0,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

export { StoredMethodsUnsupportedError };
