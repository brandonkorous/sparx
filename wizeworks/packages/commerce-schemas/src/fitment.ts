// Fitment data — a domain declares an ordered list of DIMENSIONS (its shape),
// and a single self-referential NODE tree holds the values. A dimension is
// either a `level` (a discrete tier in the tree — Make, Model, Engine, Brand,
// Chip, Size) or a `range` (a numeric narrowing axis applied per product
// application — Year, Weight, Shoe size). There is NO fixed depth and no baked
// level cap: a domain can be one level (Apparel → Size) or five (Make → Model →
// Trim → Engine, narrowed by Year). The structure grows with the merchant's
// needs; the schema never forces a worldview.
//
// One model, many merchants:
//   vehicle  — Make → Model → Engine, narrowed by Year
//   pet      — Species → Breed, narrowed by Weight
//   device   — Brand → Model
//   apparel  — Size (single level)
//
// `ProductFitment` names the deepest LEVEL node a product fits (or null = the
// whole domain, for a universal part) plus a numeric window per RANGE dimension
// (`ProductFitmentRange` child rows). Every fitment row is tenant-scoped — there
// is no platform-global domain; the platform ships a LIBRARY of installable
// dictionaries (./fitment-dictionaries) a tenant stamps as their own copy.

import { z } from 'zod';

// Fitment reference ids use z.guid() (8-4-4-4-12 shape without RFC-9562 version
// pedantry) so generated/seeded uuids validate uniformly across services.
const Uuid = z.guid();
const SlugString = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9-]+$/);
const NodeSlug = z
  .string()
  .min(1)
  .max(127)
  .regex(/^[a-z0-9-]+$/);
// Dimension keys are stable machine identifiers (referenced by product ranges +
// nodes), so they're snake_case starting with a letter — distinct from slugs.
const DimensionKey = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/);

// ─── Dimensions (the domain's shape) ─────────────────────────────────

export const FitmentDimensionKind = z.enum(['level', 'range']);
export type FitmentDimensionKind = z.infer<typeof FitmentDimensionKind>;

/** One axis of a fitment domain. `level` dimensions form the node tree in
 *  declared order; `range` dimensions are numeric windows on each product
 *  application. `unit` is an optional hint for `range` widgets (year, lb, …). */
export const FitmentDimension = z.object({
  key: DimensionKey,
  label: z.string().min(1).max(63),
  kind: FitmentDimensionKind,
  unit: z.string().min(1).max(20).optional(),
});
export type FitmentDimension = z.infer<typeof FitmentDimension>;

/** A domain's ordered dimension list: ≥1 entry, unique keys, ≥1 level. */
export const FitmentDimensions = z
  .array(FitmentDimension)
  .min(1)
  .max(16)
  .superRefine((dims, ctx) => {
    const seen = new Set<string>();
    for (const d of dims) {
      if (seen.has(d.key)) {
        ctx.addIssue({ code: 'custom', message: `duplicate dimension key "${d.key}"` });
      }
      seen.add(d.key);
    }
    if (!dims.some((d) => d.kind === 'level')) {
      ctx.addIssue({ code: 'custom', message: 'a domain needs at least one level dimension' });
    }
  });
export type FitmentDimensions = z.infer<typeof FitmentDimensions>;

// ─── Domain ──────────────────────────────────────────────────────────

export const CreateFitmentDomainInput = z.object({
  slug: SlugString,
  displayName: z.string().min(1).max(127),
  description: z.string().max(2000).optional(),
  iconKey: z.string().min(1).max(63).optional(), // lucide icon name
  dimensions: FitmentDimensions,
  position: z.number().int().min(0).max(1000).default(0),
});
export type CreateFitmentDomainInput = z.infer<typeof CreateFitmentDomainInput>;

export const UpdateFitmentDomainInput = z.object({
  displayName: z.string().min(1).max(127).optional(),
  description: z.string().max(2000).nullable().optional(),
  iconKey: z.string().min(1).max(63).nullable().optional(),
  dimensions: FitmentDimensions.optional(),
  position: z.number().int().min(0).max(1000).optional(),
});
export type UpdateFitmentDomainInput = z.infer<typeof UpdateFitmentDomainInput>;

// Install a platform fitment dictionary (see ./fitment-dictionaries) as a
// tenant-scoped copy. `slug` is the dictionary slug, not a domain id — the
// service stamps the whole tree under the tenant.
export const InstallFitmentDictionaryParams = z.object({
  slug: SlugString,
});
export type InstallFitmentDictionaryParams = z.infer<typeof InstallFitmentDictionaryParams>;

// ─── Nodes (the values, one self-referential tree) ───────────────────

export const CreateFitmentNodeInput = z.object({
  domainId: Uuid,
  /** null / absent = a top-level node. */
  parentId: Uuid.nullish(),
  /** Which `level` dimension this node represents (validated against the domain). */
  dimensionKey: DimensionKey,
  name: z.string().min(1).max(127),
  slug: NodeSlug,
  attributes: z.record(z.string(), z.unknown()).default({}),
  position: z.number().int().min(0).max(100_000).default(0),
});
export type CreateFitmentNodeInput = z.infer<typeof CreateFitmentNodeInput>;

export const UpdateFitmentNodeInput = z.object({
  name: z.string().min(1).max(127).optional(),
  slug: NodeSlug.optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).max(100_000).optional(),
});
export type UpdateFitmentNodeInput = z.infer<typeof UpdateFitmentNodeInput>;

/** Reorder siblings (same parent within a domain) by listing their ids in order. */
export const ReorderFitmentNodesInput = z.object({
  domainId: Uuid,
  parentId: Uuid.nullish(),
  orderedIds: z.array(Uuid).min(1).max(5000),
});
export type ReorderFitmentNodesInput = z.infer<typeof ReorderFitmentNodesInput>;

// ─── Product fitment ─────────────────────────────────────────────────
//
// One row = one applicability rule. A brake pad fits both the 6.0L and 6.7L
// Power Stroke 2003-2010 + the 7.3L 1999-2003 — three rows. `nodeId` names the
// deepest level the rule targets (a make-level node = "fits any Ford"; null =
// "fits the whole domain"); `ranges` carry a numeric window per range dimension.

export const FitmentRangeValue = z
  .object({
    dimensionKey: DimensionKey,
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((r) => r.min !== undefined || r.max !== undefined, {
    message: 'a range needs a min or a max',
  })
  .refine((r) => r.min === undefined || r.max === undefined || r.min <= r.max, {
    message: 'range min must be ≤ max',
  });
export type FitmentRangeValue = z.infer<typeof FitmentRangeValue>;

export const ProductFitmentInput = z.object({
  productId: Uuid,
  domainId: Uuid,
  /** Deepest level node the rule targets; null = the entire domain (universal). */
  nodeId: Uuid.nullish(),
  ranges: z.array(FitmentRangeValue).max(16).default([]),
  notes: z.string().max(2000).optional(),
});
export type ProductFitmentInput = z.infer<typeof ProductFitmentInput>;

// Bulk fitment assignment — common for importers that ship "these products fit
// these vehicles" buckets (AAIA catalog, supplier feed, merchant CSV).
export const BulkAssignFitmentInput = z.object({
  productIds: z.array(Uuid).min(1).max(1000),
  fitments: z
    .array(ProductFitmentInput.omit({ productId: true }))
    .min(1)
    .max(100),
});
export type BulkAssignFitmentInput = z.infer<typeof BulkAssignFitmentInput>;

// ─── Fitment lookup (storefront / B2B catalog filter) ─────────────────
//
// The storefront drills the tree to a node (e.g. the 6.7L Power Stroke under
// F-250 under Ford); the service matches products attached at that node OR any
// ancestor (universal-to-specific), narrowed by each range value.

export const FitmentRangeSelection = z.object({
  dimensionKey: DimensionKey,
  value: z.number(),
});
export type FitmentRangeSelection = z.infer<typeof FitmentRangeSelection>;

export const FitmentLookupQuery = z.object({
  domainId: Uuid.optional(),
  nodeId: Uuid.optional(),
  rangeValues: z.array(FitmentRangeSelection).max(16).optional(),
});
export type FitmentLookupQuery = z.infer<typeof FitmentLookupQuery>;

// ─── Fleet (B2B "what the account owns/operates") ────────────────────
//
// Stored as JSONB on `b2b_accounts.metadata`. Field names follow the
// generalized fitment vocabulary (a node + range values) so an auto shop sees
// "vehicles", a vet "patients", a contractor "devices" — one shape, per-domain
// labels.

export const FleetVehicleInput = z.object({
  label: z.string().min(1).max(127), // "Truck #14", "Service Van A"
  vin: z
    .string()
    .length(17)
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN excludes I, O, Q and is 17 chars')
    .optional(),
  domainId: Uuid,
  nodeId: Uuid.nullish(),
  rangeValues: z.array(FitmentRangeSelection).max(16).optional(),
  mileage: z.number().int().nonnegative().optional(), // vehicle-only; tolerated elsewhere
  notes: z.string().max(2000).optional(),
});
export type FleetVehicleInput = z.infer<typeof FleetVehicleInput>;
