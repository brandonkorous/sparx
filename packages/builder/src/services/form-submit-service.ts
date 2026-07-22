// formService — resolve a live form's routing config and store a submission
// (docs/115, on silica per docs/118). The read half of the public submit endpoint.
//
// SECURITY, and the shape of it changed with the silica cutover. There are two
// questions at submit time, and they now have two different answers:
//
//   "Is this a real form?"  → the PUBLISHED SILICA TREE. A form must actually exist,
//     at this id, on this page (or in the site frame — a footer form is legitimate).
//     This is the anti-forgery check: without it the endpoint could be pointed at any
//     tenant by a script. It reads the server-loaded published snapshot, never the
//     request.
//
//   "Where does it go?"     → the FormDefinition ROW, and ONLY the row. Recipients and
//     every routing toggle live server-side now. On the legacy engine the toggles lived
//     in the tree and the recipients had to be stripped out of it at publish; on silica
//     nothing sensitive is ever in the tree to begin with, so there is nothing to strip
//     and nothing to leak. No recipient can ever come from the request body.

import { withTenant } from '@sparx/db';
import type { FormSubmission, Prisma } from '@sparx/db';
import {
  findSilicaFormNode,
  readSilicaFormConfig,
  type FormAttachment,
  type SilicaFormConfig,
  type SilicaNode,
} from '@sparx/builder-schemas';

import type { PropertyContext, ServiceContext } from '../errors';
import { BuilderNotFoundError } from '../errors';
import * as siteService from './site-service';

export interface ResolvedContactForm {
  /** Routing config — read from the server-only row, never the tree. */
  config: SilicaFormConfig;
  /** Server-only notify addresses (empty ⇒ caller falls back to the tenant email). */
  recipients: string[];
  /** Author label for the inbox, if any. */
  formName: string | null;
}

/** Resolve a live form by id: prove it exists in the published silica page (by slug, or
 *  the home singleton) or in the shared site frame, then read its routing from the
 *  FormDefinition row. Returns null when no such live form is published — the caller
 *  turns that into a 404, so a visitor cannot spam a tenant that has no form there. */
export async function resolveContactForm(
  ctx: PropertyContext,
  args: { pageSlug: string | null; formNodeId: string }
): Promise<ResolvedContactForm | null> {
  const page = args.pageSlug
    ? await siteService.getPublishedPageBySlug(ctx, args.pageSlug)
    : await siteService.getPublishedHome(ctx);

  let node: SilicaNode | null = page ? findSilicaFormNode(page.root, args.formNodeId) : null;
  if (!node) {
    // Not on the page — try the shared frame. A form in the footer or a header
    // newsletter block lives in the chrome, not in any one page body, and submits from
    // every route; it would be wrong to refuse it just because the page didn't own it.
    const { frame } = await siteService.getPublishedFrame(ctx);
    node = frame ? findSilicaFormNode(frame.root, args.formNodeId) : null;
  }
  if (!node) return null;

  const def = await withTenant(ctx, (tx) =>
    tx.formDefinition.findUnique({
      where: {
        propertyId_formNodeId: { propertyId: ctx.propertyId, formNodeId: args.formNodeId },
      },
      select: { recipients: true, config: true },
    })
  );

  // A form the author never opened the settings panel on has no row yet. That is a
  // real, working form — it just uses the defaults (notify the account email). It must
  // NOT 404: the commonest possible flow is "drop the block, publish, done".
  const config = readSilicaFormConfig(def?.config);
  return {
    config,
    recipients: def?.recipients ?? [],
    formName: config.name || null,
  };
}

export interface CreateSubmissionInput {
  formNodeId: string;
  pageSlug: string | null;
  formName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  fields: Record<string, string>;
  /** Verified, promoted file attachments (docs/115 Part D). Server-minted keys. */
  attachments?: FormAttachment[];
  context: Record<string, unknown>;
  /** new | spam (honeypot). */
  status: string;
}

/** Insert a FormSubmission row (always — the durable inbox is the backbone). */
export async function createFormSubmission(
  ctx: PropertyContext,
  input: CreateSubmissionInput
): Promise<{ id: string }> {
  return withTenant(ctx, (tx) =>
    tx.formSubmission.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: ctx.propertyId,
        formNodeId: input.formNodeId,
        pageSlug: input.pageSlug,
        formName: input.formName,
        name: input.name,
        email: input.email,
        phone: input.phone,
        message: input.message,
        fields: input.fields,
        attachments: (input.attachments ?? []) as unknown as Prisma.InputJsonValue,
        context: input.context as Prisma.InputJsonValue,
        status: input.status,
      },
      select: { id: true },
    })
  );
}

// ── Inbox reads/writes (authenticated dashboard, docs/115) ────────────────────

const SUBMISSION_STATUSES = ['new', 'read', 'spam', 'archived'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface ListSubmissionsFilter {
  /** Filter by lifecycle status. */
  status?: string;
  /** Filter to one form (its stable node id). */
  formNodeId?: string;
  /** Keyset cursor — the last id from the previous page. */
  cursor?: string;
  limit?: number;
}

export interface SubmissionCounts {
  total: number;
  new: number;
}

/** One distinct form that has received at least one submission, for the inbox's
 *  "which form" filter. `formName` is the author's snapshot label (may be null on
 *  a form whose settings panel was never opened); `count` is how many submissions
 *  it has, across every status. */
export interface SubmissionFormRef {
  formNodeId: string;
  formName: string | null;
  count: number;
}

/** The distinct forms that have received submissions, most-recently-active first.
 *  Computed across ALL statuses so the filter set stays stable as the operator
 *  narrows by status — filtering to "spam" must not empty the form picker. */
export async function submissionForms(ctx: ServiceContext): Promise<SubmissionFormRef[]> {
  const grouped = await withTenant(ctx, (tx) =>
    tx.formSubmission.groupBy({
      by: ['formNodeId'],
      _count: { _all: true },
      _max: { formName: true, createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
    })
  );
  return grouped.map((row) => ({
    formNodeId: row.formNodeId,
    formName: row._max.formName,
    count: row._count._all,
  }));
}

/** Tenant-wide list (across sites) of form submissions, newest first. */
export async function listSubmissions(
  ctx: ServiceContext,
  filter: ListSubmissionsFilter = {}
): Promise<FormSubmission[]> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  return withTenant(ctx, (tx) =>
    tx.formSubmission.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.formNodeId ? { formNodeId: filter.formNodeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(filter.cursor ? { skip: 1, cursor: { id: filter.cursor } } : {}),
    })
  );
}

/** Total + unread counts for the inbox header. */
export async function submissionCounts(ctx: ServiceContext): Promise<SubmissionCounts> {
  return withTenant(ctx, async (tx) => {
    const [total, fresh] = await Promise.all([
      tx.formSubmission.count(),
      tx.formSubmission.count({ where: { status: 'new' } }),
    ]);
    return { total, new: fresh };
  });
}

export async function getSubmission(ctx: ServiceContext, id: string): Promise<FormSubmission> {
  const row = await withTenant(ctx, (tx) => tx.formSubmission.findUnique({ where: { id } }));
  if (!row) throw new BuilderNotFoundError('FormSubmission', id);
  return row;
}

/** Set a submission's lifecycle status (read / spam / archived / new). */
export async function setSubmissionStatus(
  ctx: ServiceContext,
  id: string,
  status: SubmissionStatus
): Promise<FormSubmission> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.formSubmission.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new BuilderNotFoundError('FormSubmission', id);
    return tx.formSubmission.update({ where: { id }, data: { status } });
  });
}

export async function deleteSubmission(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.formSubmission.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new BuilderNotFoundError('FormSubmission', id);
    await tx.formSubmission.delete({ where: { id } });
  });
}

/** Valid inbox statuses for input validation at the transport layer. */
export function isSubmissionStatus(v: string): v is SubmissionStatus {
  return (SUBMISSION_STATUSES as readonly string[]).includes(v);
}

/** Parse the JSON `attachments` column into typed refs — tolerant of an empty
 *  column or a legacy row (returns []). The single reader shared by the inbox
 *  surface, the download route, and the notify resolver, so the stored shape is
 *  interpreted in exactly one place. */
export function parseFormAttachments(value: unknown): FormAttachment[] {
  if (!Array.isArray(value)) return [];
  const out: FormAttachment[] = [];
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (
      typeof r.key !== 'string' ||
      typeof r.filename !== 'string' ||
      typeof r.mimeType !== 'string'
    )
      continue;
    out.push({
      key: r.key,
      filename: r.filename,
      mimeType: r.mimeType,
      byteSize: typeof r.byteSize === 'number' ? r.byteSize : 0,
    });
  }
  return out;
}
