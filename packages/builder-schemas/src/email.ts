// The Builder email — the persisted unit of the Email Builder (docs/52). One row
// per email a tenant has (BuilderEmail), with the SAME draft → publish lifecycle
// as a page (BuilderPage). Unlike the website, an email is ONE self-contained
// tree: no site/page split, no Outlet, no layout tier. The branded frame
// (wordmark header + legal footer) is fixed chrome the renderer supplies; the
// author edits only the body tree.
//
// Two document-level fields the page model doesn't have: `subject` (the email
// subject line) and `preheader` (inbox preview text). No slug, kind, recordType,
// or SEO — those are website concepts.

import { z } from 'zod';
import { BuilderNodeSchema, type BuilderNode } from './node';

/** The shape the API returns. `tree` is always the DRAFT tree (what the editor
 *  edits); `published`/`publishedAt` describe the last snapshot. */
export interface BuilderEmailDto {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  tree: BuilderNode;
  published: boolean;
  publishedAt: string | null;
  position: number;
  /** The built-in identity for a provisioned default (docs/91) — `welcome-customer`,
   *  … — or null for a tenant/site custom email. The per-site "Customize for this
   *  site" fork is keyed by it. */
  key: string | null;
  /** Whether this row is a tenant-wide email (the 13 defaults + tenant customs) or
   *  a per-site override/custom (docs/49 Phase 7b). `'tenant'` everywhere the row
   *  has no property; `'site'` once a site forks it. Lets the editor badge an
   *  override and offer the fork only on a shared default. */
  scope: 'tenant' | 'site';
  createdAt: string;
  updatedAt: string;
}

/** What a send/preview read returns — the PUBLISHED tree plus the subject +
 *  preheader the renderer needs to title the message. No draft, no audit fields. */
export interface PublishedEmailDto {
  name: string;
  subject: string;
  preheader: string | null;
  tree: BuilderNode;
  publishedAt: string | null;
}

// ── Service inputs (parsed at the service boundary, never by the DB) ──────────

/** Create an email. `tree` omitted → the service starts from the blank starter. */
export const CreateEmailInput = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().max(255).optional(),
  preheader: z.string().max(255).nullish(),
  tree: BuilderNodeSchema.optional(),
});
export type CreateEmailInput = z.infer<typeof CreateEmailInput>;

/** Patch an email — rename, set subject/preheader, and/or save the draft tree.
 *  At least one field must be present. `preheader: null` clears it. */
export const UpdateEmailInput = z
  .object({
    name: z.string().min(1).max(255).optional(),
    subject: z.string().max(255).optional(),
    preheader: z.string().max(255).nullish(),
    tree: BuilderNodeSchema.optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  });
export type UpdateEmailInput = z.infer<typeof UpdateEmailInput>;

/** Reorder the email catalog. `orderedIds` is the full set of the tenant's email
 *  ids in their new order. */
export const ReorderEmailsInput = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});
export type ReorderEmailsInput = z.infer<typeof ReorderEmailsInput>;
