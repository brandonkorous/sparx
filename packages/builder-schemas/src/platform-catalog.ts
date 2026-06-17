// Platform component catalog — persisted contract for the DB-backed platform
// component library (docs/98 §5). Zod-only (no DB, no React), like the rest of
// @sparx/builder-schemas: safe to import from editor client components AND the
// server service layer.

import { z } from 'zod';
import { BuilderNodeSchema, type BuilderNode } from './node';
import { CATALOG_KINDS, CATALOG_CATEGORIES } from './catalog';
import { ComponentSurface } from './component';

// ── Kind / category / surface / status / visibility enums ─────────────────────
//
// ONE vocabulary (docs/98 §5): a DB-backed catalog row is a PERSISTED catalog entry,
// so its kind / category / surfaces reuse the SAME closed sets as the data-as-code
// PLATFORM_CATALOG — built from the canonical constants here so the DB contract and
// the static catalog can never drift. A published row is therefore shape-compatible
// with a `PlatformCatalogEntry` and renders in the Add palette identically.
//
// `kind` is a real DB enum (clean identifiers). `category`/`surfaces` are stored as
// validated STRINGS (VARCHAR / TEXT[]) rather than DB enums — the category slugs are
// hyphenated (`data-display`), which are invalid Postgres enum identifiers, and this
// matches the package's "catalog data is validated by @sparx/builder-schemas, never
// by the DB" convention (cf. the `tree` JSON column).

export const PlatformComponentKind = z.enum(CATALOG_KINDS);
export type PlatformComponentKind = z.infer<typeof PlatformComponentKind>;

export const PlatformComponentCategory = z.enum(CATALOG_CATEGORIES);
export type PlatformComponentCategory = z.infer<typeof PlatformComponentCategory>;

export const PlatformComponentStatus = z.enum([
  'draft',
  'submitted',
  'in_review',
  'approved',
  'published',
  'archived',
  'rejected',
]);
export type PlatformComponentStatus = z.infer<typeof PlatformComponentStatus>;

export const PlatformComponentVisibility = z.enum(['public', 'private']);
export type PlatformComponentVisibility = z.infer<typeof PlatformComponentVisibility>;

// ── Legal lifecycle transitions ───────────────────────────────────────────────

/** All valid status → status transitions. Anything not in this map is rejected. */
export const LEGAL_TRANSITIONS: Record<PlatformComponentStatus, PlatformComponentStatus[]> = {
  draft: ['submitted', 'archived'],
  submitted: ['in_review', 'rejected', 'draft'],
  in_review: ['approved', 'rejected', 'submitted'],
  approved: ['published', 'rejected', 'in_review'],
  published: ['archived'],
  archived: ['draft'],
  rejected: ['draft'],
};

export function isLegalTransition(
  from: PlatformComponentStatus,
  to: PlatformComponentStatus
): boolean {
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

/** Summary (no tree) — catalog list view. The first block mirrors a
 *  `PlatformCatalogEntry` (key/name/category/kind/icon/description/surfaces/tags) so a
 *  published row is palette-renderable; the rest is DB governance. */
export interface PlatformComponentSummaryDto {
  id: string;
  key: string;
  name: string;
  category: PlatformComponentCategory;
  kind: PlatformComponentKind;
  /** Lucide icon name for the palette tile. */
  icon: string;
  /** One-line palette description. */
  description: string;
  /** Editor surfaces this entry appears in (page / site / email). */
  surfaces: ComponentSurface[];
  /** Optional richer preview image (beyond the lucide icon). */
  thumbnail: string | null;
  tags: string[];
  status: PlatformComponentStatus;
  authorId: string;
  reviewerId: string | null;
  version: number;
  visibility: PlatformComponentVisibility;
  createdAt: string;
  updatedAt: string;
}

/** Full DTO — includes tree + behaviors. */
export interface PlatformComponentDto extends PlatformComponentSummaryDto {
  tree: BuilderNode;
  /** The behavior spec JSON, or null when the component carries no behaviors
   *  (`unknown` already subsumes null). */
  behaviors: unknown;
}

// ── Service inputs ─────────────────────────────────────────────────────────────

export const CreatePlatformComponentInput = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.'),
  name: z.string().min(1).max(120),
  category: PlatformComponentCategory,
  kind: PlatformComponentKind,
  icon: z.string().min(1).max(64),
  description: z.string().min(1).max(280),
  surfaces: z.array(ComponentSurface).min(1).default(['page']),
  tree: BuilderNodeSchema,
  behaviors: z.unknown().nullish(),
  thumbnail: z.string().max(2048).nullish(),
  tags: z.array(z.string().max(64)).max(20).default([]),
  visibility: PlatformComponentVisibility.default('public'),
});
export type CreatePlatformComponentInput = z.infer<typeof CreatePlatformComponentInput>;

export const UpdatePlatformComponentInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    category: PlatformComponentCategory.optional(),
    kind: PlatformComponentKind.optional(),
    icon: z.string().min(1).max(64).optional(),
    description: z.string().min(1).max(280).optional(),
    surfaces: z.array(ComponentSurface).min(1).optional(),
    tree: BuilderNodeSchema.optional(),
    behaviors: z.unknown().nullish(),
    thumbnail: z.string().max(2048).nullish(),
    tags: z.array(z.string().max(64)).max(20).optional(),
    visibility: PlatformComponentVisibility.optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });
export type UpdatePlatformComponentInput = z.infer<typeof UpdatePlatformComponentInput>;
