// Platform component catalog — persisted contract for the DB-backed platform
// component library (docs/98 §5). Zod-only (no DB, no React), like the rest of
// @sparx/builder-schemas: safe to import from editor client components AND the
// server service layer.

import { z } from 'zod';
import { BuilderNodeSchema, type BuilderNode } from './node';

// ── Kind / status / visibility enums ─────────────────────────────────────────

export const PlatformComponentKind = z.enum(['section', 'common', 'comprehensive', 'email']);
export type PlatformComponentKind = z.infer<typeof PlatformComponentKind>;

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
export const LEGAL_TRANSITIONS: Record<
  PlatformComponentStatus,
  PlatformComponentStatus[]
> = {
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
  to: PlatformComponentStatus,
): boolean {
  return (LEGAL_TRANSITIONS[from] ?? []).includes(to);
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

/** Summary (no tree) — catalog list view. */
export interface PlatformComponentSummaryDto {
  id: string;
  key: string;
  name: string;
  family: string;
  kind: PlatformComponentKind;
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
  behaviors: unknown | null;
}

// ── Service inputs ─────────────────────────────────────────────────────────────

export const CreatePlatformComponentInput = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores.'),
  name: z.string().min(1).max(120),
  family: z.string().min(1).max(32).default('content'),
  kind: PlatformComponentKind,
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
    family: z.string().min(1).max(32).optional(),
    kind: PlatformComponentKind.optional(),
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
