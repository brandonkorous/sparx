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

  // Square's CreateCard REJECTS a vault with no `cardholder_name`, so the name
  // is resolved here rather than left to the adapter — a gateway adapter has no
  // access to the customer record. The postal code goes with it when the
  // customer has a default billing address: Square matches it against what was
  // typed into the payment form, and a WRONG one fails the vault, so it is only
  // sent when it is genuinely known.
  const billing = await resolveBillingIdentity(ctx, input.customerId);

  const vaulted = await paymentService.completeVault({
    tenantId: ctx.tenantId,
    customerId: input.customerId,
    ...(input.setupRef ? { setupRef: input.setupRef } : {}),
    ...(input.token ? { token: input.token } : {}),
    ...(existingRef?.customerRef ? { customerRef: existingRef.customerRef } : {}),
    ...(billing.cardholderName ? { cardholderName: billing.cardholderName } : {}),
    ...(billing.postalCode ? { postalCode: billing.postalCode } : {}),
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

/**
 * Record the stored-credential chain a charge established.
 *
 * The card networks require a merchant-initiated charge to quote the
 * transaction that created the mandate, and Authorize.net makes the merchant
 * carry it (Stripe and PayPal track it internally). The first successful charge
 * against a newly vaulted card returns a networkTransId; every renewal after
 * that sends it back.
 *
 * Written once and never overwritten — the chain is anchored to the ESTABLISHING
 * transaction, so replacing it with the most recent charge's id would break the
 * very link the networks are checking.
 */
export async function recordCredentialChain(
  ctx: ServiceContext,
  id: string,
  chain: { networkTransId: string; originalAuthAmount: number }
): Promise<void> {
  await withTenant(ctx, (tx) =>
    tx.customerPaymentMethod.updateMany({
      where: { id, networkTransId: null },
      data: {
        networkTransId: chain.networkTransId,
        originalAuthAmount: chain.originalAuthAmount,
      },
    })
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

/** The cardholder name + billing postal code to send with a vault, resolved
 *  from the customer record. Both are optional everywhere except Square, whose
 *  CreateCard requires a name. */
async function resolveBillingIdentity(
  ctx: ServiceContext,
  customerId: string
): Promise<{ cardholderName: string | null; postalCode: string | null }> {
  return withTenant(ctx, async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!customer) return { cardholderName: null, postalCode: null };

    const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    const address = await tx.customerAddress.findFirst({
      where: { customerId, type: { in: ['billing', 'both'] } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: { postalCode: true },
    });

    return {
      // Falling back to the email's local part beats sending nothing: a card
      // saved under a slightly odd name is recoverable, a rejected vault is a
      // shopper who could not save their card at all.
      cardholderName: name || (customer.email?.split('@')[0] ?? null),
      postalCode: address?.postalCode ?? null,
    };
  });
}

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
