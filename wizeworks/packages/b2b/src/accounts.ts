// B2B-module-enriched view of the CRM b2b_accounts spine: trade config (validated
// pricing-tier FK, credit limit, terms, status), the account's fleet (a JSONB
// array of generalized fitment selections), per-account product overrides, and the
// fleet-filtered compatible-products read. Extracted from the api-rest routes.
//
// Boundary with CRM: @wizeworks/crm's companyService owns the account RECORD
// (companyName, taxId, assigned rep). Both write the validated `pricingTierId`
// FK; the legacy free-text `pricing_tier` column is read and written by nothing.
// These functions own the B2B MODULE's enrichments and the override / fleet tables.

import { z } from 'zod';
import { withTenant } from '@wizeworks/db';
import { conflict, notFound, validationError } from '@wizeworks/api-core/errors';
// A trade account IS the CRM's company row, so its tenant-declared properties go
// through the CRM's single write path rather than a second one here (docs/144
// §3). `@wizeworks/b2b` already depends on `@wizeworks/crm`, and crm does not depend
// back, so this adds no cycle.
import {
  PaymentTerms,
  asBag,
  companyService,
  objectDefService,
  resolvePropertyBag,
  taskService,
  toJsonInput,
} from '@wizeworks/crm';
import type { B2bContext } from './context.js';
// The fleet lives in its own file; these names stay reachable as
// `accountService.*` for the routes and MCP tools that already use them (sparx
// persona issue 086).
import { readFleet, resolveFleetVehicles } from './fleet.js';
export {
  CompatibleProductsQuery,
  FleetVehicleEntry,
  FleetVehiclesBody,
  addFleetVehicle,
  listCompatibleProducts,
  removeFleetVehicle,
  setFleet,
  updateFleetVehicle,
  type FleetVehiclesInput,
} from './fleet.js';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const AccountListQuery = z.object({
  status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
  tier_id: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  q: z.string().max(255).optional(),
  take: z.coerce.number().int().min(1).max(250).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const AccountPatchBody = z.object({
  pricingTierId: z.string().uuid().nullable().optional(),
  creditLimitCents: z.number().int().min(0).optional(),
  // The CRM's shape, not a list of four. An account created on 15 days to pay
  // (the add screen offers it) could never be saved again: every edit came back
  // "The problem is with Payment terms" (sparx persona issue 076).
  paymentTerms: PaymentTerms.nullable().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  status: z.enum(['active', 'credit_hold', 'suspended', 'inactive']).optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  fleetSize: z.number().int().min(0).nullable().optional(),
  // The extra details this business tracks on a company (docs/144 §3). A trade
  // account IS the CRM's company, so the same declared properties have to be
  // writable from the wholesale pane — otherwise the same record answers
  // differently depending on which door you came in through. NO `.default({})`:
  // a default survives `.partial()` and would fabricate an empty bag on every
  // patch, wiping properties the caller never mentioned.
  customProperties: z.record(z.string(), z.unknown()).optional(),
});

// The account's buying rules for one version (sparx persona issue 086): the
// least and most it may order at once, and the case pack it buys in. Null clears
// a rule; absent leaves it alone.
const QuantityRuleFields = {
  minOrderQty: z.number().int().min(1).nullable().optional(),
  maxOrderQty: z.number().int().min(1).nullable().optional(),
  orderMultiple: z.number().int().min(1).nullable().optional(),
};

// A row may now carry buying rules and no price of its own (the account keeps
// its group's price), so the price is AT MOST one of the two rather than exactly
// one. `resolve_b2b_price()` already falls through a row with neither.
export const AccountOverrideBody = z
  .object({
    variantId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    priceCents: z.number().int().min(0).optional(),
    discountPercentage: z.number().min(0).max(100).optional(),
    ...QuantityRuleFields,
    notes: z.string().max(1000).optional(),
  })
  .refine((d) => Boolean(d.variantId) !== Boolean(d.collectionId), {
    message: 'Provide exactly one of variantId or collectionId',
  })
  .refine((d) => !(d.priceCents !== undefined && d.discountPercentage !== undefined), {
    message: 'Provide a fixed price or a percentage off, not both',
  });

export const AccountOverridePatchBody = z
  .object({
    variantId: z.string().uuid().optional(),
    collectionId: z.string().uuid().optional(),
    // Nullable so switching a fixed price to a percentage (or to no price of
    // its own) can clear the other half in the same request.
    priceCents: z.number().int().min(0).nullable().optional(),
    discountPercentage: z.number().min(0).max(100).nullable().optional(),
    ...QuantityRuleFields,
    notes: z.string().max(1000).optional(),
  })
  .partial();

/** What a row would hold once written, for the checks below. */
export interface OverrideShape {
  variantId: string | null;
  collectionId: string | null;
  priceCents: number | null;
  discountPercentage: unknown;
  minOrderQty: number | null;
  maxOrderQty: number | null;
  orderMultiple: number | null;
}

/** "24 or 36", the whole cases either side of `n`. */
function casesNear(n: number, each: number): string {
  const down = Math.floor(n / each) * each;
  const up = Math.ceil(n / each) * each;
  return down >= each ? `${String(down)} or ${String(up)}` : String(up);
}

/**
 * Why these settings cannot be saved, in a sentence staff can act on, or null.
 *
 * A minimum or maximum that is not a whole number of cases is refused rather
 * than quietly rounded: "at least 30, in cases of 12" can never be met as
 * written, and a buyer would be told to choose an amount staff never chose.
 */
export function overrideSettingProblem(row: OverrideShape): string | null {
  const { minOrderQty: min, maxOrderQty: max, orderMultiple: each } = row;
  const hasRule = min !== null || max !== null || each !== null;
  if (hasRule && row.collectionId) {
    return 'Buying rules are set for one version of a product, not for a whole collection.';
  }
  if (row.priceCents !== null && row.discountPercentage !== null) {
    return 'Give this business a fixed price or a percentage off, not both.';
  }
  if (!hasRule && row.priceCents === null && row.discountPercentage === null) {
    return 'Set a price, a percentage off, or a buying rule. As it stands this would change nothing.';
  }
  if (min !== null && max !== null && min > max) {
    return `The minimum (${String(min)}) is more than the maximum (${String(max)}). Make the minimum smaller or the maximum larger.`;
  }
  if (each !== null && each > 1) {
    if (min !== null && min % each !== 0) {
      return `A minimum of ${String(min)} cannot be bought in cases of ${String(each)}. Use ${casesNear(min, each)}.`;
    }
    if (max !== null && max % each !== 0) {
      return `A maximum of ${String(max)} cannot be bought in cases of ${String(each)}. Use ${casesNear(max, each)}.`;
    }
  }
  return null;
}

export type AccountListInput = z.infer<typeof AccountListQuery>;
export type AccountPatchInput = z.infer<typeof AccountPatchBody>;
export type AccountOverrideInput = z.infer<typeof AccountOverrideBody>;
export type AccountOverridePatchInput = z.infer<typeof AccountOverridePatchBody>;

// ── View mappers ──────────────────────────────────────────────────────────────

function toAccountView(a: {
  id: string;
  companyName: string;
  taxId: string | null;
  website: string | null;
  pricingTierId: string | null;
  creditLimit: unknown;
  creditUsed: unknown;
  paymentTerms: string | null;
  discountPercent: unknown;
  status: string;
  fleetSize: number | null;
  engineProfiles: unknown;
  notes: string | null;
  customProperties?: unknown;
  createdAt: Date;
  updatedAt: Date;
  pricingTierFk?: {
    id: string;
    name: string;
    discountType: string;
    discountValue: unknown;
    deletedAt: Date | null;
  } | null;
}) {
  // A removed tier prices nothing, so every field saying what they pay treats it
  // as no tier; `removedTierName` is for the account screen to say it was removed.
  const tier = companyService.tierInEffect(a.pricingTierFk);
  const limit = Number(a.creditLimit ?? 0);
  const used = Number(a.creditUsed ?? 0);
  return {
    id: a.id,
    companyName: a.companyName,
    taxId: a.taxId,
    website: a.website,
    pricingTierId: a.pricingTierId,
    // The tier that prices their orders, or null for normal prices. Never the
    // legacy free-text column: text naming no tier of this business priced
    // nothing, so showing it claimed a discount the account did not get (sparx
    // persona issue 086).
    pricingTierName: tier?.name ?? null,
    removedTierName: companyService.removedTier(a.pricingTierFk)?.name ?? null,
    pricingTier: tier
      ? {
          id: tier.id,
          name: tier.name,
          discountType: tier.discountType,
          discountValue: Number(tier.discountValue),
        }
      : null,
    creditLimitCents: Math.round(limit * 100),
    creditUsedCents: Math.round(used * 100),
    creditRemainingCents: Math.round(Math.max(0, limit - used) * 100),
    creditUtilizationPct: limit > 0 ? Math.round((used / limit) * 10000) / 100 : 0,
    paymentTerms: a.paymentTerms,
    discountPercent: Number(a.discountPercent ?? 0),
    status: a.status,
    fleetSize: a.fleetSize,
    engineProfiles: a.engineProfiles,
    notes: a.notes,
    customProperties: asBag(a.customProperties),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export type AccountView = ReturnType<typeof toAccountView>;

const PRICING_TIER_FK_SELECT = {
  pricingTierFk: {
    select: { id: true, name: true, discountType: true, discountValue: true, deletedAt: true },
  },
} as const;

const ACCOUNT_OVERRIDE_INCLUDE = {
  variant: { select: { id: true, sku: true, title: true } },
  collection: { select: { id: true, name: true } },
} as const;

// ── Accounts ────────────────────────────────────────────────────────────────

export async function listAccounts(
  ctx: B2bContext,
  input: AccountListInput
): Promise<{ items: AccountView[]; total: number; take: number }> {
  const where: Record<string, unknown> = { tenantId: ctx.tenantId, deletedAt: null };
  if (input.status) where.status = input.status;
  if (input.tier_id) where.pricingTierId = input.tier_id;
  if (input.q) {
    where.OR = [
      { companyName: { contains: input.q, mode: 'insensitive' } },
      { taxId: { contains: input.q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    withTenant(ctx, (tx) =>
      tx.company.findMany({
        where,
        take: input.take,
        skip: input.skip,
        orderBy: { companyName: 'asc' },
        include: PRICING_TIER_FK_SELECT,
      })
    ),
    withTenant(ctx, (tx) => tx.company.count({ where })),
  ]);

  return { items: items.map(toAccountView), total, take: input.take };
}

export async function getAccount(ctx: B2bContext, id: string) {
  const account = await withTenant(ctx, (tx) =>
    tx.company.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        ...PRICING_TIER_FK_SELECT,
        _count: { select: { productOverrides: true } },
      },
    })
  );
  if (!account) throw notFound('b2b account');
  const fleetVehicles = await resolveFleetVehicles(
    ctx,
    readFleet(account.id, account.engineProfiles)
  );
  return {
    ...toAccountView(account),
    fleetVehicles,
    overrideCount: account._count.productOverrides,
  };
}

/** Update the B2B-module trade config on an account: the validated pricing-tier FK,
 *  credit limit, terms, discount, status,
 *  internal notes, fleet size. */
export async function updateTradeConfig(
  ctx: B2bContext,
  id: string,
  rawInput: unknown
): Promise<AccountView> {
  const body = AccountPatchBody.parse(rawInput);

  const existing = await withTenant(ctx, (tx) =>
    tx.company.findFirst({ where: { id, tenantId: ctx.tenantId, deletedAt: null } })
  );
  if (!existing) throw notFound('b2b account');

  // A new tier must belong to this tenant (RLS is the backstop; this is the
  // friendly 404). Checked only when it CHANGES: the account pane sends the tier
  // it loaded on every save, and an account still linked to a removed tier could
  // otherwise never be saved again, not even to move it to normal prices.
  if (body.pricingTierId && body.pricingTierId !== existing.pricingTierId) {
    const tier = await withTenant(ctx, (tx) =>
      tx.b2bPricingTier.findFirst({
        where: { id: body.pricingTierId!, tenantId: ctx.tenantId, deletedAt: null },
      })
    );
    if (!tier) throw notFound('pricing tier');
  }

  const updated = await withTenant(ctx, async (tx) => {
    // ONE write path for declared properties, shared with the CRM's own company
    // pane: validate against the tenant's schema, recompute calculated fields,
    // then merge onto what is stored. `undefined` when the patch says nothing
    // about them, which leaves the stored bag untouched.
    const customProperties = resolvePropertyBag({
      schema: await objectDefService.schemaFor(ctx, 'company', tx),
      existing: existing.customProperties,
      incoming: body.customProperties,
    });

    const saved = await tx.company.update({
      where: { id },
      data: {
        pricingTierId: body.pricingTierId,
        // creditLimit is a Decimal (dollars) in the CRM schema; cents → decimal.
        ...(body.creditLimitCents !== undefined
          ? { creditLimit: (body.creditLimitCents / 100).toFixed(2) }
          : {}),
        paymentTerms: body.paymentTerms,
        discountPercent: body.discountPercent,
        status: body.status,
        notes: body.internalNotes,
        fleetSize: body.fleetSize,
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
        updatedAt: new Date(),
      },
      include: PRICING_TIER_FK_SELECT,
    });
    // The console's account save and the MCP tool both land here. A "Set up
    // prices and terms" task on this account is false the moment they are set:
    // Wasatch Front's stayed open on Net 30 with a $25,000 limit.
    await taskService.closeWhenAccountSetUp(tx, ctx, { companyId: id, byUserId: ctx.userId });
    return saved;
  });
  return toAccountView(updated);
}

// ── Account-level product overrides ──────────────────────────────────────────

async function requireAccount(ctx: B2bContext, accountId: string): Promise<void> {
  const account = await withTenant(ctx, (tx) =>
    tx.company.findFirst({ where: { id: accountId, tenantId: ctx.tenantId, deletedAt: null } })
  );
  if (!account) throw notFound('b2b account');
}

export async function listAccountOverrides(ctx: B2bContext, accountId: string) {
  await requireAccount(ctx, accountId);
  return withTenant(ctx, (tx) =>
    tx.b2bAccountProductOverride.findMany({
      where: { accountId, tenantId: ctx.tenantId },
      orderBy: { createdAt: 'asc' },
      include: ACCOUNT_OVERRIDE_INCLUDE,
    })
  );
}

export async function addAccountOverride(ctx: B2bContext, accountId: string, rawInput: unknown) {
  const body = AccountOverrideBody.parse(rawInput);
  await requireAccount(ctx, accountId);
  const problem = overrideSettingProblem({
    variantId: body.variantId ?? null,
    collectionId: body.collectionId ?? null,
    priceCents: body.priceCents ?? null,
    discountPercentage: body.discountPercentage ?? null,
    minOrderQty: body.minOrderQty ?? null,
    maxOrderQty: body.maxOrderQty ?? null,
    orderMultiple: body.orderMultiple ?? null,
  });
  if (problem) throw validationError(problem);

  return withTenant(ctx, async (tx) => {
    // One row per business and version. Two rows made both the price and the
    // buying rules a coin toss: the price function reads `LIMIT 1` with no
    // order (sparx persona issue 086).
    if (body.variantId) {
      const already = await tx.b2bAccountProductOverride.findFirst({
        where: { accountId, variantId: body.variantId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (already) {
        throw conflict(
          'This business already has a price or buying rule for this version. Change that one instead of adding a second.',
          { overrideId: already.id }
        );
      }
    }
    return tx.b2bAccountProductOverride.create({
      data: {
        tenantId: ctx.tenantId,
        accountId,
        variantId: body.variantId,
        collectionId: body.collectionId,
        priceCents: body.priceCents,
        discountPercentage: body.discountPercentage,
        minOrderQty: body.minOrderQty ?? null,
        maxOrderQty: body.maxOrderQty ?? null,
        orderMultiple: body.orderMultiple ?? null,
        notes: body.notes,
      },
      include: ACCOUNT_OVERRIDE_INCLUDE,
    });
  });
}

export async function updateAccountOverride(
  ctx: B2bContext,
  accountId: string,
  oid: string,
  rawInput: unknown
) {
  const body = AccountOverridePatchBody.parse(rawInput);
  const existing = await withTenant(ctx, (tx) =>
    tx.b2bAccountProductOverride.findFirst({
      where: { id: oid, accountId, tenantId: ctx.tenantId },
    })
  );
  if (!existing) throw notFound('override');
  // Checked on the row as it WOULD be, so a patch that only changes the case
  // pack is held to the minimum already saved (sparx persona issue 086).
  const problem = overrideSettingProblem({
    variantId: body.variantId ?? existing.variantId,
    collectionId: body.collectionId ?? existing.collectionId,
    priceCents: body.priceCents === undefined ? existing.priceCents : body.priceCents,
    discountPercentage:
      body.discountPercentage === undefined ? existing.discountPercentage : body.discountPercentage,
    minOrderQty: body.minOrderQty === undefined ? existing.minOrderQty : body.minOrderQty,
    maxOrderQty: body.maxOrderQty === undefined ? existing.maxOrderQty : body.maxOrderQty,
    orderMultiple: body.orderMultiple === undefined ? existing.orderMultiple : body.orderMultiple,
  });
  if (problem) throw validationError(problem);

  return withTenant(ctx, (tx) =>
    tx.b2bAccountProductOverride.update({
      where: { id: oid },
      data: { ...body, updatedAt: new Date() },
      include: ACCOUNT_OVERRIDE_INCLUDE,
    })
  );
}

export async function removeAccountOverride(
  ctx: B2bContext,
  accountId: string,
  oid: string
): Promise<void> {
  const existing = await withTenant(ctx, (tx) =>
    tx.b2bAccountProductOverride.findFirst({
      where: { id: oid, accountId, tenantId: ctx.tenantId },
    })
  );
  if (!existing) throw notFound('override');
  await withTenant(ctx, (tx) => tx.b2bAccountProductOverride.delete({ where: { id: oid } }));
}
