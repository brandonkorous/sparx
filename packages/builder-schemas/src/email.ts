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
import {
  SilicaEmailDocumentInput,
  SilicaEmailNodeInput,
  type SilicaEmailDocument,
} from './email-silica';

/** The shape the API returns. `tree` is always the DRAFT tree (what the editor
 *  edits); `published`/`publishedAt` describe the last snapshot. */
export interface BuilderEmailDto {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  tree: BuilderNode;
  /** The silica-native DRAFT document (docs/120) — what the silica `<EmailBuilder>`
   *  mounts and edits. Never null: a row authored on the retired sparx builder is
   *  converted from its `tree` on read (`emailTreeToSilica`), so the editor always
   *  opens on the author's real content rather than a blank document. */
  silicaDoc: SilicaEmailDocument;
  published: boolean;
  /** True when this email IS published but its DRAFT has since diverged from the live
   *  published version — i.e. saved edits that recipients aren't getting yet. Drives the
   *  studio's "unpublished changes" cue so an author doesn't assume a saved edit is live.
   *  Always false for an unpublished email (the `published:false` state already says so). */
  hasUnpublishedChanges: boolean;
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
  /** The PUBLISHED silica document — the ONE thing the send renders (docs/120
   *  slice 7). Never null: an email authored on the retired sparx engine is
   *  converted from its stored tree on read (`emailTreeToSilica`), so the send path
   *  has a single branch instead of two engines. The legacy `tree` field is gone
   *  with `renderEmailTree`. */
  silicaDoc: SilicaEmailDocument;
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

/** Persist a silica-authored email (docs/120) — the `<EmailBuilder>` `onChange`
 *  payload. The document carries its own subject/preheader (silica owns them now),
 *  which the service mirrors onto the row so the catalog list + send read them. */
export const SyncSilicaEmailInput = z.object({
  doc: SilicaEmailDocumentInput,
});
export type SyncSilicaEmailInput = z.infer<typeof SyncSilicaEmailInput>;

/** Save a block into the tenant's saved-block library (docs/impl transactional-email
 *  Slice 9) — silica's `SavedBlockChange { type: 'save' }`. The node is validated
 *  structurally (silica owns the shape); the name is the author's label. */
export const CreateSavedEmailBlockInput = z.object({
  name: z.string().min(1).max(255),
  node: SilicaEmailNodeInput,
});
export type CreateSavedEmailBlockInput = z.infer<typeof CreateSavedEmailBlockInput>;

/** Rename a saved block — silica's `SavedBlockChange { type: 'rename' }`. */
export const RenameSavedEmailBlockInput = z.object({
  name: z.string().min(1).max(255),
});
export type RenameSavedEmailBlockInput = z.infer<typeof RenameSavedEmailBlockInput>;
