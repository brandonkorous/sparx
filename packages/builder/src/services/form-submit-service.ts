// formService — resolve a live ContactForm's routing config and store a
// submission (docs/115). The read half of the public submit endpoint.
//
// SECURITY. `resolveContactForm` reads the form's config from the PUBLISHED tree
// (the server-loaded snapshot) — never from the request — and returns null when
// no such live ContactForm exists at the given address, so a visitor cannot spam
// a tenant that has no form there. The recipient ADDRESSES come from the
// server-only FormDefinition row, never the tree (they were stripped at publish).

import { withTenant } from '@sparx/db';
import type { FormSubmission, Prisma } from '@sparx/db';
import {
  findNodeById,
  readContactFormConfig,
  CONTACT_FORM_TYPE,
  type ContactFormConfig,
  type FormAttachment,
} from '@sparx/builder-schemas';

import type { PropertyContext, ServiceContext } from '../errors';
import { BuilderNotFoundError } from '../errors';
import * as pageService from './page-service';
import * as layoutService from './layout-service';

export interface ResolvedContactForm {
  /** Non-sensitive toggles/copy read from the published tree. */
  config: ContactFormConfig;
  /** Server-only notify addresses (empty ⇒ caller falls back to the tenant email). */
  recipients: string[];
  /** Author label for the inbox, if any. */
  formName: string | null;
}

/** Resolve a live form node's config from the published page (by slug, or the home
 *  singleton) and — if not there — the active chrome layout. Returns null when no
 *  published ContactForm with that id exists. */
export async function resolveContactForm(
  ctx: PropertyContext,
  args: { pageSlug: string | null; formNodeId: string }
): Promise<ResolvedContactForm | null> {
  const page = args.pageSlug
    ? await pageService.getPublishedBySlug(ctx, args.pageSlug)
    : await pageService.getPublishedHome(ctx);
  let node = page ? findNodeById(page.tree, args.formNodeId) : null;
  if (node?.type !== CONTACT_FORM_TYPE) {
    const layout = await layoutService.getPublished(ctx);
    node = layout ? findNodeById(layout.tree, args.formNodeId) : null;
  }
  if (node?.type !== CONTACT_FORM_TYPE) return null;

  const def = await withTenant(ctx, (tx) =>
    tx.formDefinition.findUnique({
      where: {
        propertyId_formNodeId: { propertyId: ctx.propertyId, formNodeId: args.formNodeId },
      },
      select: { recipients: true },
    })
  );

  return {
    config: readContactFormConfig(node.props),
    recipients: def?.recipients ?? [],
    formName: typeof node.name === 'string' ? node.name : null,
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
