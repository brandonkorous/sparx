// Brand-governed ARCHETYPES (docs/61 §6 Phase 6b) — the persisted contract for a
// curated section/layout STARTING POINT a user stamps onto a page. Stamping forks
// a COPY of `tree` (fresh ids) into the page, so an archetype is plain data: a
// named node subtree with NO versioning and NO references (unlike a tenant
// component, which is a live `custom:<key>` placement). Zod-only (no DB, no React),
// like the rest of @wizeworks/builder-schemas — safe to import from the editor's
// client components AND the server service layer.

import { z } from 'zod';
import { BuilderNodeSchema, type BuilderNode } from './node';
import { ComponentSurface } from './component';

// ── Key, family, source ───────────────────────────────────────────────────────

export const ARCHETYPE_KEY_MAX = 64;
export const ArchetypeKey = z
  .string()
  .min(1)
  .max(ARCHETYPE_KEY_MAX)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.');
export type ArchetypeKey = z.infer<typeof ArchetypeKey>;

/** Layout families — a loose vocabulary stored as a plain string (a new family
 *  needs no migration). Known families autocomplete; any string is accepted. */
export const ARCHETYPE_FAMILIES = [
  'hero',
  'feature',
  'cta',
  'gallery',
  'testimonial',
  'content',
  'header',
  'footer',
] as const;
export type ArchetypeFamily = (typeof ARCHETYPE_FAMILIES)[number];

export const ARCHETYPE_SOURCES = ['platform', 'tenant'] as const;
export type ArchetypeSource = (typeof ARCHETYPE_SOURCES)[number];

// ── DTOs ──────────────────────────────────────────────────────────────────────

/** An archetype without its tree — the catalog row. */
export interface ArchetypeSummaryDto {
  id: string;
  key: string;
  name: string;
  family: string;
  icon: string;
  description: string | null;
  surfaces: ComponentSurface[];
  source: ArchetypeSource;
  enabled: boolean;
  thumbnail: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** An archetype WITH its tree — what the Add palette stamps. */
export interface ArchetypeDto extends ArchetypeSummaryDto {
  tree: BuilderNode;
}

// ── Service inputs (parsed at the service boundary, never by the DB) ───────────

export const CreateArchetypeInput = z.object({
  key: ArchetypeKey,
  name: z.string().min(1).max(120),
  family: z.string().min(1).max(32).default('content'),
  icon: z.string().max(64).default('box'),
  description: z.string().max(500).nullish(),
  surfaces: z.array(ComponentSurface).min(1).default(['page']),
  tree: BuilderNodeSchema,
  thumbnail: z.string().max(2048).nullish(),
});
export type CreateArchetypeInput = z.infer<typeof CreateArchetypeInput>;

export const UpdateArchetypeInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    family: z.string().min(1).max(32).optional(),
    icon: z.string().max(64).optional(),
    description: z.string().max(500).nullish(),
    surfaces: z.array(ComponentSurface).min(1).optional(),
    tree: BuilderNodeSchema.optional(),
    thumbnail: z.string().max(2048).nullish(),
    enabled: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });
export type UpdateArchetypeInput = z.infer<typeof UpdateArchetypeInput>;

// ── Platform default archetypes — REMOVED (docs/98 §5, v1.1) ──────────────────
// The platform-provided component library now lives in the data-driven catalog
// (`./catalog` — the daisyUI-grade common set as composed BuilderNode trees,
// surfaced directly in the Add palette). `BuilderArchetype` is therefore PURELY
// tenant-authored ("save as brand section"); NO platform rows are seeded. The
// shape below is kept (a tenant archetype IS one of these), but the seed list is
// empty and `archetypeService.seedIfEmpty` short-circuits to a no-op.

export interface PlatformArchetype {
  key: string;
  name: string;
  family: ArchetypeFamily;
  icon: string;
  description: string;
  surfaces: ComponentSurface[];
  tree: BuilderNode;
}

/** Empty — the catalog (docs/98 §5) is the platform library now. Kept so the
 *  archetype seed path stays a no-op rather than a code change. */
export const PLATFORM_ARCHETYPES: PlatformArchetype[] = [];
