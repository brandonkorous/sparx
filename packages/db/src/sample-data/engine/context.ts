// Internal apply context — threaded through every engine module during a load.
//
// One open, tenant-scoped transaction backs a whole load (atomic: a failure
// rolls the entire sample dataset back, never a half-populated tenant). The ctx
// carries the id-maps each slice builds for the next (catalog → activity reads
// variant ids; scheduling → bookings read service/resource ids) plus the running
// counts the load/status/clear summary reports.

import type { Prisma } from '@prisma/client';

import type { SampleDataCounts } from '../types';

/** Resolved module-enablement predicate (invariant #2 gate). */
export type ModuleGate = (module: string) => boolean;

/** What the catalog slice records about each variant so downstream slices
 *  (orders, bundles, suppliers, configurator) resolve it without re-querying. */
export interface VariantMeta {
  id: string;
  productId: string;
  productKey: string;
  productTitle: string;
  sku: string;
  title: string | null;
  priceCents: number;
  costCents: number;
}

export interface ApplyCtx {
  tx: Prisma.TransactionClient;
  tenantId: string;
  userId: string | null;
  ownerUserId: string | null;
  isOn: ModuleGate;
  propertyId: string | null;
  now: number;

  /**
   * The site sample BILLING DOCUMENTS are issued by (docs/131 §3.6).
   *
   * Separate from `propertyId` above, which is nullable because most sample
   * slices legitimately seed tenant-wide rows. An invoice cannot: `property_id`
   * is NOT NULL there, since a document with no issuer is the state that
   * migration exists to remove. This resolves to `propertyId` when set, else the
   * tenant's primary — so sample data lands in one business's books rather than
   * being spread across two.
   */
  issuingPropertyId: string;

  // ── id-maps (author key → real UUID) ──────────────────────────────────
  productIdByKey: Map<string, string>;
  /** Ordered by authoring position — orders iterate this for a stable spread. */
  variantsByKey: Map<string, VariantMeta>;
  variantOrder: string[];
  warehouseIdByKey: Map<string, string>;
  categoryIdByKey: Map<string, string>;
  collectionIdByKey: Map<string, string>;
  customerIdByPersona: Map<string, string>;
  serviceIdByKey: Map<string, string>;
  resourceIdByKey: Map<string, string>;

  counts: SampleDataCounts;
}

/** A fresh zeroed counts record. */
export function emptyCounts(): SampleDataCounts {
  return {
    products: 0,
    collections: 0,
    categories: 0,
    articles: 0,
    customers: 0,
    orders: 0,
    returns: 0,
    reviews: 0,
    questions: 0,
    bookings: 0,
    deals: 0,
    billingDocuments: 0,
    bundles: 0,
    movements: 0,
    images: 0,
    aiPrompts: 0,
    toolCalls: 0,
  };
}

/** A Date `days` before the load's `now` (negative = future). */
export function daysAgo(ctx: ApplyCtx, days: number): Date {
  return new Date(ctx.now - days * 86_400_000);
}

/** Round a float to 2 decimals (CRM-side Decimal money is stored as a number). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
