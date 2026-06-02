// The Builder site LAYOUT — the persisted chrome shell (docs/45). One row per
// tenant (v1): the global header · outlet · footer tree every page renders
// inside. Same draft/publish lifecycle as a page (BuilderPage), but there is
// exactly one, so the API is singular (get-or-seed / save / publish) — no
// catalog, no create/delete.

import { z } from 'zod';
import { BuilderNodeSchema, type BuilderNode } from './node';

/** The shape the API returns. `tree` is the DRAFT tree (what the editor edits);
 *  `published`/`publishedAt` describe the last snapshot. */
export interface BuilderLayoutDto {
  id: string;
  name: string;
  tree: BuilderNode;
  published: boolean;
  publishedAt: string | null;
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
