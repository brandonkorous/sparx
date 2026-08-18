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
import { FRAME_NONE } from './page-frame';

export const BuilderPageKind = z.enum(['singleton', 'collection']);
export type BuilderPageKind = z.infer<typeof BuilderPageKind>;

/** A storefront URL slug: lowercase alphanumerics + hyphens, optionally nested
 *  with `/` (e.g. `about`, `legal/privacy`). Validated at the service boundary. */
export const PageSlug = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.');

/** `PageSlug` as a WRITE input: the root page normalized to `null` before the
 *  pattern is applied.
 *
 *  The home page's stored form is `null` — `wizeworks/apps/site/lib/page-slug.ts` maps `/` to
 *  `null` on the read side, and `PageSlug` deliberately forbids both the empty
 *  string and a leading slash. But nothing normalized on the way IN, so a writer
 *  that sent the URL form persisted `slug: '/'` — a value the very same schema then
 *  refuses, leaving the page uneditable ("Use lowercase letters, numbers, and
 *  hyphens.") until its slug changed, and colliding with the slugless page that is
 *  the real root.
 *
 *  Accepting the URL form and storing the canonical one keeps both spellings
 *  working without letting the un-editable state exist: `'/'` and `''` → `null`,
 *  `'/about/'` → `'about'`. Matches `captureSite`'s `normalizeSlug`. */
export const PageSlugInput = z.preprocess((raw) => {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? null : trimmed;
}, PageSlug.nullish());

/** A page's chrome choice: the `'none'` sentinel or a layout id. Mirrors the CHECK
 *  constraint on `builder_pages.frame_id` so a bad value is rejected at the API rather
 *  than by Postgres — a 400 naming the field beats a 500 naming a constraint. */
export const PageFrameId = z.union([z.literal(FRAME_NONE), z.string().uuid()]);

/** The shape the API returns. `tree` is always the DRAFT tree (what the editor
 *  edits); `published`/`publishedAt` describe the last snapshot. `slug` is the
 *  URL a published singleton page serves at (docs/44); null for collection
 *  templates and unrouted pages. */
/**
 * A page WITHOUT its tree (docs/127 §3) — what every list surface actually needs.
 *
 * `listOrSeed` returned the full DTO, so rendering a list of page NAMES materialized
 * every draft tree in the property: four JSONB columns read, one of them deserialized
 * into a `BuilderNode` per row, all of it discarded by a UI that shows a name and a
 * status. On the busiest dashboard surface in the builder.
 *
 * `BuilderPageDto` extends this with the tree, so a caller that genuinely needs a body
 * (the editor, the publish path) is unchanged and the two can never drift.
 */
export interface BuilderPageSummaryDto {
  id: string;
  name: string;
  slug: string | null;
  kind: BuilderPageKind;
  recordType: string | null;
  /** A `commerce.product` page's product-TYPE target (docs/143 Option B) — the type key
   *  this page designs (`apparel`, …); null = the default product page. */
  recordSubtype: string | null;
  published: boolean;
  publishedAt: string | null;
  position: number;
  /** Whether this collection template is the DEFAULT for its `recordType`
   *  (docs/51 §6) — the per-type winner the storefront renders when a record has
   *  no per-record override. At most one per (tenant, recordType). */
  isDefault: boolean;
  /** Which chrome wraps this page (docs/silicaui/01 §5) — `null` for the site default, the
   *  `'none'` sentinel for bare, or a layout id. Read as well as written: a settings
   *  form cannot show the author their current choice from the write path alone. */
  frameId: string | null;
  // SEO (singleton pages) — see PageSeoShape below.
  seoTitle: string | null;
  seoDescription: string | null;
  canonical: string | null;
  ogImage: string | null;
  noindex: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A page WITH its draft body — for the editor and the publish path. Every list
 *  surface should take {@link BuilderPageSummaryDto} instead. */
export interface BuilderPageDto extends BuilderPageSummaryDto {
  tree: BuilderNode;
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
  /** A `commerce.product` page's product-TYPE target (docs/143 Option B). */
  recordSubtype: z.string().max(63).nullish(),
  slug: PageSlugInput,
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
    /** Retarget a `commerce.product` page to a product TYPE (docs/143 Option B); `null`
     *  clears it back to the default product page. */
    recordSubtype: z.string().max(63).nullish(),
    slug: PageSlugInput,
    /**
     * Which chrome wraps this page (docs/silicaui/01 §5). Three values, and the two that look
     * empty mean opposite things:
     *   `null`     → the site default (whichever layout is active)
     *   `'none'`   → NO header or footer; the campaign/landing page
     *   a layout id → that specific shell
     *
     * `nullish` rather than `optional`, deliberately: omitting the field leaves the
     * page's current choice alone, while sending `null` RESETS it to the default. A
     * settings form has to be able to say both.
     */
    frameId: PageFrameId.nullish(),
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
