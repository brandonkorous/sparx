// The Builder site LAYOUT — the persisted chrome shell (docs/45). A tenant keeps
// a CATALOG of layouts (the header · outlet · footer tree every page renders
// inside), with the SAME draft/publish lifecycle as a page (BuilderPage). Exactly
// one layout is `isActive` — the live chrome the storefront serves. Publishing
// snapshots draft → published; a separate "make active" flips which published
// layout is live. The API is a catalog: list / create / update / publish /
// activate / delete.

import { z } from 'zod';
import { BuilderNodeSchema, type BuilderNode } from './node';

/** The shape the API returns. `tree` is the DRAFT tree (what the editor edits);
 *  `published`/`publishedAt` describe the last snapshot. `isActive` marks the one
 *  live layout the storefront serves; `position` orders the catalog. */
export interface BuilderLayoutDto {
  id: string;
  name: string;
  tree: BuilderNode;
  published: boolean;
  publishedAt: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** What the PUBLIC storefront read returns (docs/45 §2.6) — the published chrome
 *  tree, rendered around every page at the Outlet. No draft, no audit fields. */
export interface PublishedLayoutDto {
  name: string;
  tree: BuilderNode;
  publishedAt: string | null;
}

// ── Service inputs (parsed at the service boundary, never by the DB) ──────────

/** Create a layout. `tree` omitted → the service starts from the starter shell
 *  (header · outlet · footer). New layouts are NOT live until activated. */
export const CreateLayoutInput = z.object({
  name: z.string().min(1).max(255),
  tree: BuilderNodeSchema.optional(),
});
export type CreateLayoutInput = z.infer<typeof CreateLayoutInput>;

/** Patch the layout — save the draft tree and/or rename. At least one field. */
export const UpdateLayoutInput = z
  .object({
    name: z.string().min(1).max(255).optional(),
    tree: BuilderNodeSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.tree !== undefined, {
    message: 'Provide at least one of name or tree.',
  });
export type UpdateLayoutInput = z.infer<typeof UpdateLayoutInput>;
