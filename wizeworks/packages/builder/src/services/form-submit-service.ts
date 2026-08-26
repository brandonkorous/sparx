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

import { withTenant } from '@wizeworks/db';
import type { FormSubmission, Prisma } from '@wizeworks/db';
import {
  findSilicaFormNode,
  readSilicaFormConfig,
  type FormAttachment,
  type SilicaFormConfig,
  type SilicaNode,
} from '@wizeworks/builder-schemas';

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

/**
 * Insert a FormSubmission row (always — the durable inbox is the backbone).
 *
 * If this person already has a PARTIAL row for this form, the completed
 * submission takes it over rather than landing beside it (docs/152 C2).
 * Otherwise finishing a form you had abandoned would leave the tenant looking at
 * two rows for one person, one of them permanently captioned "never finished" —
 * which is worse than not having recorded the partial at all.
 */
export async function createFormSubmission(
  ctx: PropertyContext,
  input: CreateSubmissionInput
): Promise<{ id: string }> {
  const data = {
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
  };

  return withTenant(ctx, async (tx) => {
    if (input.email) {
      const abandoned = await tx.formSubmission.findFirst({
        where: {
          tenantId: ctx.tenantId,
          formNodeId: input.formNodeId,
          email: input.email,
          status: PARTIAL_STATUS,
        },
        select: { id: true },
      });
      if (abandoned) {
        // `partialStep` is cleared: it means "how far they got before stopping",
        // and they did not stop. Leaving it set would report a completed form as
        // a drop-off forever.
        await tx.formSubmission.update({
          where: { id: abandoned.id },
          data: { ...data, partialStep: null },
        });
        return { id: abandoned.id };
      }
    }
    return tx.formSubmission.create({ data, select: { id: true } });
  });
}

// ── Partial capture (docs/151 §7, docs/152 C2) ────────────────────────────────

/** The status a half-finished form carries. Deliberately not in
 *  `SUBMISSION_STATUSES` as a WRITE target — staff triage a partial, they never
 *  mark something partial. */
export const PARTIAL_STATUS = 'partial';

export interface PartialSubmissionInput {
  formNodeId: string;
  pageSlug: string | null;
  formName: string | null;
  name: string | null;
  /** Required by the caller: a partial with no way to reach anybody is not a
   *  lead, it is a row about a stranger, and we do not keep those. */
  email: string;
  phone: string | null;
  fields: Record<string, string>;
  context: Record<string, unknown>;
  /** How far they got, 1-based. */
  step: number;
}

/**
 * Record (or advance) somebody's unfinished form.
 *
 * One unfinished form is ONE row, so this updates in place as they move through
 * the steps. The identity is (tenant, form, email) and there is no client-side
 * id anywhere in it — deliberately, because a durable per-visitor token is
 * exactly the thing docs/151 §4 refuses, and it is not needed: the address they
 * typed is the identity, and a reload simply resumes the same row.
 *
 * The partial unique index in the migration is what makes this safe against two
 * tabs racing; the catch below turns that race into the update it should have
 * been rather than a 500 the visitor sees.
 */
export async function capturePartialSubmission(
  ctx: PropertyContext,
  input: PartialSubmissionInput
): Promise<{ id: string; created: boolean }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.formSubmission.findFirst({
      where: {
        tenantId: ctx.tenantId,
        formNodeId: input.formNodeId,
        email: input.email,
        status: PARTIAL_STATUS,
      },
      select: { id: true, partialStep: true, fields: true },
    });

    // Merge rather than replace: somebody who goes BACK and forward again must
    // not blank the answers they already gave, and a later step posts only the
    // fields it can see.
    const merged = (values: unknown): Record<string, string> => ({
      ...(values && typeof values === 'object' ? (values as Record<string, string>) : {}),
      ...input.fields,
    });

    if (existing) {
      await tx.formSubmission.update({
        where: { id: existing.id },
        data: {
          pageSlug: input.pageSlug,
          formName: input.formName,
          name: input.name,
          phone: input.phone,
          fields: merged(existing.fields),
          context: input.context as Prisma.InputJsonValue,
          // Never walks backwards: the useful number is the FURTHEST they ever
          // reached, not wherever they happened to be when they closed the tab.
          partialStep: Math.max(existing.partialStep ?? 0, input.step),
        },
      });
      return { id: existing.id, created: false };
    }

    try {
      const row = await tx.formSubmission.create({
        data: {
          tenantId: ctx.tenantId,
          propertyId: ctx.propertyId,
          formNodeId: input.formNodeId,
          pageSlug: input.pageSlug,
          formName: input.formName,
          name: input.name,
          email: input.email,
          phone: input.phone,
          message: null,
          fields: input.fields,
          context: input.context as Prisma.InputJsonValue,
          status: PARTIAL_STATUS,
          partialStep: input.step,
        },
        select: { id: true },
      });
      return { id: row.id, created: true };
    } catch (err) {
      // The other tab won the race. Its row is the one to advance.
      if (!isUniqueViolation(err)) throw err;
      const row = await tx.formSubmission.findFirst({
        where: {
          tenantId: ctx.tenantId,
          formNodeId: input.formNodeId,
          email: input.email,
          status: PARTIAL_STATUS,
        },
        select: { id: true, partialStep: true },
      });
      if (!row) throw err;
      await tx.formSubmission.update({
        where: { id: row.id },
        data: { partialStep: Math.max(row.partialStep ?? 0, input.step) },
      });
      return { id: row.id, created: false };
    }
  });
}

/** Postgres 23505. The index it trips is hand-authored SQL, so Prisma reports it
 *  as a generic known-request error rather than a typed conflict. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

// ── Inbox reads/writes (authenticated dashboard, docs/115) ────────────────────

const SUBMISSION_STATUSES = ['new', 'read', 'spam', 'archived'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Statuses the inbox may FILTER to. A superset of the ones it may WRITE:
 *  `partial` is reachable as a view (a tenant should be able to see who started
 *  and stopped) but is never something staff assign. */
export const SUBMISSION_VIEWS = [...SUBMISSION_STATUSES, PARTIAL_STATUS] as const;

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
  /** Finished submissions. Excludes partials — see `submissionCounts`. */
  total: number;
  new: number;
  /** People who started this tenant's forms and never finished (docs/152 C2). */
  partial: number;
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
 *  narrows by status — filtering to "spam" (or "partial") must not empty the
 *  form picker. Its `count` therefore INCLUDES partials, which is right for a
 *  picker and wrong for a headline; `submissionCounts` is the headline. */
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
        // Unfiltered means FINISHED submissions. A half-filled form sitting in
        // the inbox looking like a message somebody sent is worse than not
        // recording it: the tenant replies to something nobody sent them. It is
        // reachable by asking for it (`status: 'partial'`) and no other way.
        ...(filter.status ? { status: filter.status } : { status: { not: PARTIAL_STATUS } }),
        ...(filter.formNodeId ? { formNodeId: filter.formNodeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(filter.cursor ? { skip: 1, cursor: { id: filter.cursor } } : {}),
    })
  );
}

/** Total + unread counts for the inbox header, plus how many people started a
 *  form and stopped. `total` counts FINISHED submissions only — folding partials
 *  into it would quietly inflate every "you have N enquiries" figure on the
 *  platform. */
export async function submissionCounts(ctx: ServiceContext): Promise<SubmissionCounts> {
  return withTenant(ctx, async (tx) => {
    const [total, fresh, partial] = await Promise.all([
      tx.formSubmission.count({ where: { status: { not: PARTIAL_STATUS } } }),
      tx.formSubmission.count({ where: { status: 'new' } }),
      tx.formSubmission.count({ where: { status: PARTIAL_STATUS } }),
    ]);
    return { total, new: fresh, partial };
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
