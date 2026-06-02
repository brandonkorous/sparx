// The Builder page — the persisted unit (docs/41 §2). One row per page a tenant
// has. A page *template* and a page *instance* are the same row: Sparx ships a
// curated starter set, the tenant edits them and creates more. No separate
// "template" entity.
//
//   · singleton  — one specific page (Home, About); content authored inline.
//   · collection — one template rendering EVERY record of `recordType`
//                  (Product page → every product); nodes bind to that record's
//                  fields and each record fills the same tree.

import { z } from 'zod';
import { BuilderNodeSchema, type BuilderNode } from './node';

export const BuilderPageKind = z.enum(['singleton', 'collection']);
export type BuilderPageKind = z.infer<typeof BuilderPageKind>;

/** The shape the API returns. `tree` is always the DRAFT tree (what the editor
 *  edits); `published`/`publishedAt` describe the last snapshot. The published
 *  tree itself isn't returned in slice 1 — nothing renders it yet (docs/41 §1). */
export interface BuilderPageDto {
  id: string;
  name: string;
  kind: BuilderPageKind;
  recordType: string | null;
  tree: BuilderNode;
  published: boolean;
  publishedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

// ── Service inputs (parsed at the service boundary, never by the DB) ──────────

/** Create a page. `tree` omitted → the service starts from a blank root. */
export const CreatePageInput = z.object({
  name: z.string().min(1).max(255),
  kind: BuilderPageKind.default('singleton'),
  recordType: z.string().max(63).nullish(),
  tree: BuilderNodeSchema.optional(),
});
export type CreatePageInput = z.infer<typeof CreatePageInput>;

/** Patch a page — rename and/or save the draft tree and/or retarget. At least
 *  one field must be present. */
export const UpdatePageInput = z
  .object({
    name: z.string().min(1).max(255).optional(),
    tree: BuilderNodeSchema.optional(),
    recordType: z.string().max(63).nullish(),
  })
  .refine((v) => v.name !== undefined || v.tree !== undefined || v.recordType !== undefined, {
    message: 'Provide at least one of name, tree, or recordType.',
  });
export type UpdatePageInput = z.infer<typeof UpdatePageInput>;

/** Reorder the page catalog. `orderedIds` is the full set of the tenant's page
 *  ids in their new order. */
export const ReorderPagesInput = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});
export type ReorderPagesInput = z.infer<typeof ReorderPagesInput>;
