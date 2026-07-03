// The Builder page — the persisted unit (docs/41 §2). One row per page a tenant
// has. A page *template* and a page *instance* are the same row: sparx ships a
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

/** A storefront URL slug: lowercase alphanumerics + hyphens, optionally nested
 *  with `/` (e.g. `about`, `legal/privacy`). Validated at the service boundary. */
export const PageSlug = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.');

/** The shape the API returns. `tree` is always the DRAFT tree (what the editor
 *  edits); `published`/`publishedAt` describe the last snapshot. `slug` is the
 *  URL a published singleton page serves at (docs/44); null for collection
 *  templates and unrouted pages. */
export interface BuilderPageDto {
  id: string;
  name: string;
  slug: string | null;
  kind: BuilderPageKind;
  recordType: string | null;
  tree: BuilderNode;
  published: boolean;
  publishedAt: string | null;
  position: number;
  /** Whether this collection template is the DEFAULT for its `recordType`
   *  (docs/51 §6) — the per-type winner the storefront renders when a record has
   *  no per-record override. At most one per (tenant, recordType). */
  isDefault: boolean;
  // SEO (singleton pages) — see PageSeoShape below.
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  noindex: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What the PUBLIC storefront read returns (docs/44 §2.2) — the published tree
 *  and just enough meta to render + title the page. No draft, no audit fields. */
export interface PublishedPageDto {
  name: string;
  slug: string;
  kind: BuilderPageKind;
  recordType: string | null;
  tree: BuilderNode;
  // SEO — the storefront titles/describes a published singleton from these.
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  noindex: boolean;
  publishedAt: string | null;
}

// ── Service inputs (parsed at the service boundary, never by the DB) ──────────

/** The editable SEO fields shared by Create/Update (and the portable page
 *  document envelope, so an MCP/Import author can set them inline). `canonical`
 *  accepts a path or absolute URL; empty strings normalize to null at the service
 *  boundary. */
export const PageSeoShape = {
  seoTitle: z.string().max(255).nullish(),
  seoDescription: z.string().max(500).nullish(),
  canonical: z.string().max(2048).nullish(),
  ogImage: z.string().max(2048).nullish(),
  noindex: z.boolean().optional(),
} as const;

/** Create a page. `tree` omitted → the service starts from a blank root. */
export const CreatePageInput = z.object({
  name: z.string().min(1).max(255),
  kind: BuilderPageKind.default('singleton'),
  recordType: z.string().max(63).nullish(),
  slug: PageSlug.nullish(),
  tree: BuilderNodeSchema.optional(),
  ...PageSeoShape,
});
export type CreatePageInput = z.infer<typeof CreatePageInput>;

/** Patch a page — rename, save the draft tree, retarget, and/or set the slug.
 *  At least one field must be present. `slug: null` clears it. */
export const UpdatePageInput = z
  .object({
    name: z.string().min(1).max(255).optional(),
    tree: BuilderNodeSchema.optional(),
    recordType: z.string().max(63).nullish(),
    slug: PageSlug.nullish(),
    ...PageSeoShape,
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });
export type UpdatePageInput = z.infer<typeof UpdatePageInput>;

/** Reorder the page catalog. `orderedIds` is the full set of the tenant's page
 *  ids in their new order. */
export const ReorderPagesInput = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});
export type ReorderPagesInput = z.infer<typeof ReorderPagesInput>;

// ── Template resolution (docs/51 §6) ─────────────────────────────────────────

/** A collection template a record type can resolve to — the option set the
 *  entry-editor's per-record template picker lists, with the type default
 *  flagged. `published` is false for a draft-only template (still selectable,
 *  but it won't render on the storefront until published). */
export interface BuilderTemplateOption {
  id: string;
  name: string;
  isDefault: boolean;
  published: boolean;
}

/** Set (or clear) a per-record template OVERRIDE (docs/51 §6). `recordType` is
 *  the source key the template targets (`cms.blog_post`, `commerce.product`);
 *  `itemRef` is the record's stable id. `builderPageId: null` CLEARS the override
 *  so the record falls back to the type default. */
export const SetAssignmentInput = z.object({
  recordType: z.string().min(1).max(63),
  itemRef: z.string().min(1).max(255),
  builderPageId: z.string().uuid().nullable(),
});
export type SetAssignmentInput = z.infer<typeof SetAssignmentInput>;

/** The current per-record override for a (recordType, itemRef), or null when the
 *  record uses the type default. */
export interface BuilderAssignmentDto {
  recordType: string;
  itemRef: string;
  builderPageId: string;
}
