// B2B module presets — wholesale pricing tiers and purchase-approval rules.
//
// These live in the CRM package (which owns the B2B account spine and already
// deps @sparx/modules), but carry `module: 'b2b'` so the seam gates them on the
// B2B flag. Tiers + approval rules have no service layer — the REST routes write
// them with raw Prisma — so the presets do the same on the open tenant tx
// (`sx.tx`), staying atomic and tenant-scoped under the same RLS the routes use.
//
// Net payment terms (Net-30/60/90) are deliberately NOT a preset: they are a
// per-account field on `b2b_accounts.payment_terms`, set when a buyer is granted
// terms — there is no tenant-level "terms catalog" table to seed.
//
// Built-ins to avoid: B2B activation seeds ONE tenant-wide approval rule
// (`accountId = null`, $5,000 threshold, INACTIVE). The approval preset adds a
// distinct ACTIVE rule, so it never duplicates the dormant default.
//
// Data-as-code (line-limit exempt).

import type { TenantContext } from '@sparx/db';
import { definePreset, type ModulePreset } from '@sparx/modules';

// ─── Pricing tiers ────────────────────────────────────────────────────

interface TierDef {
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  productScope: 'all' | 'collections' | 'products';
  minOrderCents: number;
}

const WHOLESALE_TIERS: TierDef[] = [
  {
    name: 'Reseller',
    description: 'Entry wholesale pricing for approved resellers — 10% off list, no minimum.',
    discountType: 'percentage',
    discountValue: 10,
    productScope: 'all',
    minOrderCents: 0,
  },
  {
    name: 'Wholesale',
    description: 'Standard wholesale pricing — 20% off list on orders of $500 or more.',
    discountType: 'percentage',
    discountValue: 20,
    productScope: 'all',
    minOrderCents: 50_000,
  },
  {
    name: 'Distributor',
    description: 'Volume distributor pricing — 30% off list on orders of $2,500 or more.',
    discountType: 'percentage',
    discountValue: 30,
    productScope: 'all',
    minOrderCents: 250_000,
  },
];

const wholesaleTiersPreset: ModulePreset = definePreset({
  module: 'b2b',
  slug: 'wholesale-tiers',
  kind: 'b2b-pricing',
  name: 'Wholesale pricing tiers',
  description:
    'A graduated wholesale price book — Reseller, Wholesale, and Distributor tiers with deeper discounts at higher order minimums. Assign accounts to a tier to apply its pricing automatically at checkout.',
  iconKey: 'layers',
  tags: ['b2b', 'wholesale', 'pricing', 'tiers'],
  summary: [
    { label: 'Reseller · Wholesale · Distributor', tone: 'neutral' },
    { label: '10% → 30% off list', tone: 'module' },
  ],
  marker: (tx, tenantId) =>
    tx.b2bPricingTier
      .findFirst({
        where: { tenantId, name: 'Wholesale', deletedAt: null },
        select: { id: true },
      })
      .then(Boolean),
  build: async (sx: TenantContext) => {
    let firstId: string | null = null;
    for (const tier of WHOLESALE_TIERS) {
      const created = await sx.tx!.b2bPricingTier.create({
        data: {
          tenantId: sx.tenantId,
          name: tier.name,
          description: tier.description,
          discountType: tier.discountType,
          discountValue: tier.discountValue,
          productScope: tier.productScope,
          minOrderCents: tier.minOrderCents,
        },
        select: { id: true },
      });
      firstId ??= created.id;
    }
    // Non-null: WHOLESALE_TIERS is a non-empty constant, so the loop always runs.
    return { id: firstId! };
  },
});

// ─── Purchase approval ────────────────────────────────────────────────

const purchaseApprovalPreset: ModulePreset = definePreset({
  module: 'b2b',
  slug: 'purchase-approval',
  kind: 'b2b-approval',
  name: 'Purchase approval over $2,500',
  description:
    'Require staff sign-off before any B2B portal order of $2,500 or more is placed. Adds an active, tenant-wide approval rule; raise or lower the threshold, or scope it to specific accounts, anytime.',
  iconKey: 'shield-check',
  tags: ['b2b', 'approval', 'governance'],
  summary: [
    { label: 'Orders ≥ $2,500', tone: 'neutral' },
    { label: 'Tenant-wide · active', tone: 'module' },
  ],
  // Installed ⇔ an ACTIVE tenant-wide rule exists (the built-in seed is inactive,
  // so a fresh tenant reads as not-installed until this preset — or the merchant —
  // turns approval on).
  marker: (tx, tenantId) =>
    tx.purchaseApprovalRule
      .findFirst({
        where: { tenantId, accountId: null, isActive: true },
        select: { id: true },
      })
      .then(Boolean),
  build: async (sx: TenantContext) => {
    const rule = await sx.tx!.purchaseApprovalRule.create({
      data: {
        tenantId: sx.tenantId,
        accountId: null,
        minAmountCents: 250_000,
        requiredApproverUserId: null,
        isActive: true,
      },
      select: { id: true },
    });
    return { id: rule.id };
  },
});

/** Every B2B module preset, in picker order. */
export const b2bPresets: ModulePreset[] = [wholesaleTiersPreset, purchaseApprovalPreset];
