// Operator feedback triage (docs/apps/admin/feedback.md, docs/112). The
// WizeWorks-staff side of in-product feedback — the cross-tenant inbox, submission
// detail + thread, triage (status/assignee/tags), and the reply loop that closes
// back to the submitter via `feedback.responded`.
//
// `feedback_submissions` / `feedback_messages` are tenant-scoped FORCE-RLS with no
// Typesense mirror, so the cross-tenant INBOX is a bounded per-tenant scan under
// each tenant's GUC (there is no single cross-tenant SQL query by design, docs/16
// §2.4). Detail/triage/reply carry an explicit `:tenantId`, so they go straight
// through `withTenant` — no loop. `assignee_staff_id` is a bare wize_admin operator
// uuid (FK-free, D3): stored/returned raw here, resolved to a name in the admin app.
//
// Same Layer-5 shared-secret auth as the other operator routes; the admin app is
// the capability gate (feedback:respond / feedback:admin) + audit writer.
//
// NOTE (build-plan D1/D7): docs/apps/admin/feedback.md v1.0 predates the locked
// decisions — it describes a bypass-RLS connection (rejected: we scan per-tenant
// via withTenant) and impersonation deep-links (removed: context entities are shown,
// never linked into a tenant session). The reply/notify loop is unchanged.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant, type Prisma } from '@wizeworks/db';
import { publish } from '@wizeworks/api-core/pubsub';
import { appOrigin } from '@wizeworks/links/server';
import { tenantPlatformBrand } from '../../lib/tenant-brand.js';
import { platformBrandIdentity } from '@wizeworks/brand-core';
import type { FeedbackRespondedPayload } from '@wizeworks/events';
import { writePlatformNotice } from '../../lib/platform-notice.js';
import type {
  OperatorFeedbackItem,
  OperatorFeedbackListResult,
  OperatorFeedbackCounts,
  OperatorFeedbackDetail,
  OperatorFeedbackMessage,
} from '@wizeworks/operator';

import {
  authorizeOperator,
  badRequest,
  notFound,
  operatorIdOf,
  resolveTenantNames,
} from './operator-internal.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = [
  'new',
  'triaged',
  'planned',
  'in_progress',
  'shipped',
  'declined',
  'answered',
] as const;
const CATEGORIES = ['idea', 'problem', 'question', 'praise'] as const;

// A status change ALONE notifies the submitter only for these (docs/apps/admin/
// feedback.md §6); planned/in_progress notify only when staff tick "let them know";
// triaged/new are always silent. A staff REPLY always notifies (handled separately).
const NOTIFY_ALWAYS = new Set(['shipped', 'declined', 'answered']);
const NOTIFY_OPTIONAL = new Set(['planned', 'in_progress']);

// Per-tenant scan cap for the cross-tenant inbox. The Phase-1 ceiling of the
// bounded-loop approach: if a single tenant has more than this many submissions
// matching the base filter, the merged counts/total are a floor (`truncated`).
const SCAN_CAP = 500;
const PAGE_SIZE = 25;
// Cap concurrent per-tenant transactions so the inbox scan can't exhaust the pool.
const SCAN_CONCURRENCY = 8;

const PageSchema = z.coerce.number().int().min(1).optional();

const TriageSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    assigneeStaffId: z.string().uuid().nullable().optional(),
    internalTags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    notify: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.status !== undefined || d.assigneeStaffId !== undefined || d.internalTags !== undefined,
    {
      message: 'Nothing to update.',
    }
  );

const ReplySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  status: z.enum(STATUSES).optional(),
  /** Staff display-name snapshot (api-rest can't read wize_admin for it). */
  authorName: z.string().trim().min(1).max(255).optional(),
});

// ── Column selections ──────────────────────────────────────────────────────

const SUBMISSION_SELECT = {
  id: true,
  tenantId: true,
  userId: true,
  category: true,
  status: true,
  source: true,
  subject: true,
  body: true,
  sentiment: true,
  context: true,
  attachmentAssetIds: true,
  assigneeStaffId: true,
  internalTags: true,
  submitterName: true,
  submitterEmail: true,
  lastResponseAt: true,
  userUnread: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FeedbackSubmissionSelect;

type SubmissionRow = Prisma.FeedbackSubmissionGetPayload<{ select: typeof SUBMISSION_SELECT }>;
type ScanRow = SubmissionRow & { _count: { messages: number } };

// ── Derivations ──────────────────────────────────────────────────────────────

/** First non-empty line of the body, trimmed to a title length. */
function excerptOf(body: string): string {
  const line =
    body
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

/** `context.module` when present (which surface the feedback came from). */
function moduleOf(context: unknown): string | null {
  const m = (context as { module?: unknown } | null)?.module;
  return typeof m === 'string' && m.length > 0 ? m : null;
}

function toItem(
  row: ScanRow,
  tenant: { name: string; slug: string } | undefined
): OperatorFeedbackItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantName: tenant?.name ?? '(unknown tenant)',
    tenantSlug: tenant?.slug ?? '',
    category: row.category,
    status: row.status,
    subject: row.subject,
    excerpt: excerptOf(row.body),
    submitterName: row.submitterName,
    submitterEmail: row.submitterEmail,
    module: moduleOf(row.context),
    sentiment: row.sentiment,
    assigneeStaffId: row.assigneeStaffId,
    internalTags: row.internalTags,
    messageCount: row._count.messages,
    lastResponseAt: row.lastResponseAt?.toISOString() ?? null,
    userUnread: row.userUnread,
    createdAt: row.createdAt.toISOString(),
  };
}

async function toDetail(row: SubmissionRow, submissionId: string): Promise<OperatorFeedbackDetail> {
  const [tenant, messages] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: row.tenantId },
      select: { name: true, slug: true },
    }),
    withTenant({ tenantId: row.tenantId }, (tx) =>
      tx.feedbackMessage.findMany({
        where: { submissionId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorKind: true, authorName: true, body: true, createdAt: true },
      })
    ),
  ]);
  const thread: OperatorFeedbackMessage[] = messages.map((m) => ({
    id: m.id,
    authorKind: m.authorKind,
    authorName: m.authorName,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));
  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantName: tenant?.name ?? '(unknown tenant)',
    tenantSlug: tenant?.slug ?? '',
    userId: row.userId,
    category: row.category,
    status: row.status,
    source: row.source,
    subject: row.subject,
    body: row.body,
    sentiment: row.sentiment,
    context: row.context,
    attachmentAssetIds: row.attachmentAssetIds,
    assigneeStaffId: row.assigneeStaffId,
    internalTags: row.internalTags,
    submitterName: row.submitterName,
    submitterEmail: row.submitterEmail,
    lastResponseAt: row.lastResponseAt?.toISOString() ?? null,
    userUnread: row.userUnread,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: thread,
  };
}

/** Run `fn` over `items` with a bounded number in flight (protect the DB pool). */
async function mapBounded<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      out[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function emptyCounts(): OperatorFeedbackCounts {
  return { total: 0, byStatus: {}, byCategory: {}, byModule: {}, unassigned: 0 };
}

// ── Route plugin ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync signature.
const operatorFeedbackRoutes: FastifyPluginAsync = async (app) => {
  const opts = { logLevel: 'warn' as const, schema: { hide: true } };

  // ── GET /internal/operator/feedback — cross-tenant inbox ────────────────────
  app.get<{
    Querystring: {
      status?: string;
      category?: string;
      tenantId?: string;
      assigneeStaffId?: string;
      tag?: string;
      q?: string;
      page?: string;
    };
  }>('/internal/operator/feedback', opts, async (request) => {
    authorizeOperator(request);
    const query = request.query;
    const page = PageSchema.parse(query.page) ?? 1;
    const statusFilter = STATUSES.includes(query.status as (typeof STATUSES)[number])
      ? query.status
      : undefined;

    // Base filter EXCLUDES status, so the queue counts reflect every status while
    // the returned page is status-filtered.
    const baseWhere: Prisma.FeedbackSubmissionWhereInput = {};
    if (CATEGORIES.includes(query.category as (typeof CATEGORIES)[number])) {
      baseWhere.category = query.category;
    }
    if (query.assigneeStaffId && UUID_RE.test(query.assigneeStaffId)) {
      baseWhere.assigneeStaffId = query.assigneeStaffId;
    }
    if (query.tag?.trim()) baseWhere.internalTags = { has: query.tag.trim() };
    if (query.q?.trim()) {
      const q = query.q.trim();
      baseWhere.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const tenantIds =
      query.tenantId && UUID_RE.test(query.tenantId)
        ? [query.tenantId]
        : (await prisma.tenant.findMany({ select: { id: true } })).map((t) => t.id);

    // One bounded findMany per tenant under its GUC; merge in memory.
    let truncated = false;
    const perTenant = await mapBounded(tenantIds, SCAN_CONCURRENCY, (tenantId) =>
      withTenant({ tenantId }, (tx) =>
        tx.feedbackSubmission.findMany({
          where: baseWhere,
          orderBy: { createdAt: 'desc' },
          take: SCAN_CAP,
          select: { ...SUBMISSION_SELECT, _count: { select: { messages: true } } },
        })
      )
    );
    const scanned: ScanRow[] = [];
    for (const rows of perTenant) {
      if (rows.length >= SCAN_CAP) truncated = true;
      scanned.push(...(rows as ScanRow[]));
    }

    // Counts over the full base set (queue chips + friction view).
    const counts = emptyCounts();
    for (const r of scanned) {
      counts.total += 1;
      counts.byStatus[r.status] = (counts.byStatus[r.status] ?? 0) + 1;
      counts.byCategory[r.category] = (counts.byCategory[r.category] ?? 0) + 1;
      const mod = moduleOf(r.context);
      if (mod) counts.byModule[mod] = (counts.byModule[mod] ?? 0) + 1;
      if (!r.assigneeStaffId && (r.status === 'new' || r.status === 'triaged'))
        counts.unassigned += 1;
    }

    // Apply the status filter, sort newest-first, paginate.
    const filtered = statusFilter ? scanned.filter((r) => r.status === statusFilter) : scanned;
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = filtered.length;
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    const tenants = await resolveTenantNames(pageRows.map((r) => r.tenantId));
    const result: OperatorFeedbackListResult = {
      submissions: pageRows.map((r) => toItem(r, tenants.get(r.tenantId))),
      total,
      page,
      perPage: PAGE_SIZE,
      counts,
      truncated,
    };
    return result;
  });

  // ── GET /internal/operator/feedback/:tenantId/:id — detail + thread ─────────
  app.get<{ Params: { tenantId: string; id: string } }>(
    '/internal/operator/feedback/:tenantId/:id',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { tenantId, id } = request.params;
      if (!UUID_RE.test(tenantId) || !UUID_RE.test(id)) throw badRequest('Invalid id.');
      const row = await withTenant({ tenantId }, (tx) =>
        tx.feedbackSubmission.findUnique({ where: { id }, select: SUBMISSION_SELECT })
      );
      if (!row) throw notFound('Feedback not found.');
      return toDetail(row, id);
    }
  );

  // ── PATCH /internal/operator/feedback/:tenantId/:id — triage ────────────────
  app.patch<{ Params: { tenantId: string; id: string } }>(
    '/internal/operator/feedback/:tenantId/:id',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { tenantId, id } = request.params;
      if (!UUID_RE.test(tenantId) || !UUID_RE.test(id)) throw badRequest('Invalid id.');
      const parsed = TriageSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid triage.');
      const input = parsed.data;

      const before = await withTenant({ tenantId }, (tx) =>
        tx.feedbackSubmission.findUnique({
          where: { id },
          select: { status: true, submitterEmail: true },
        })
      );
      if (!before) throw notFound('Feedback not found.');

      // A status change to a notify-worthy status also flags the submission unread.
      const statusChanged = input.status !== undefined && input.status !== before.status;
      const notify =
        statusChanged &&
        (NOTIFY_ALWAYS.has(input.status!) ||
          (NOTIFY_OPTIONAL.has(input.status!) && !!input.notify));

      const data: Prisma.FeedbackSubmissionUpdateInput = {};
      if (input.status !== undefined) data.status = input.status;
      if (input.assigneeStaffId !== undefined) data.assigneeStaffId = input.assigneeStaffId;
      if (input.internalTags !== undefined) data.internalTags = input.internalTags;
      if (notify) data.userUnread = true;

      const row = await withTenant({ tenantId }, (tx) =>
        tx.feedbackSubmission.update({ where: { id }, data, select: SUBMISSION_SELECT })
      );

      // Notify (email + analytics) for a notify-worthy status change alone — no
      // message body. In-app unread is already set on the row above.
      if (notify && before.submitterEmail) {
        const payload: FeedbackRespondedPayload = {
          submissionId: id,
          status: row.status,
          messagePreview: null,
          recipientEmail: before.submitterEmail,
        };
        await publish(request.log, 'feedback.responded', tenantId, operatorIdOf(request), {
          ...payload,
        });
      }
      return toDetail(row, id);
    }
  );

  // ── POST /internal/operator/feedback/:tenantId/:id/messages — staff reply ───
  app.post<{ Params: { tenantId: string; id: string } }>(
    '/internal/operator/feedback/:tenantId/:id/messages',
    opts,
    async (request) => {
      authorizeOperator(request);
      const { tenantId, id } = request.params;
      if (!UUID_RE.test(tenantId) || !UUID_RE.test(id)) throw badRequest('Invalid id.');
      const authorId = operatorIdOf(request);
      if (!authorId) throw badRequest('Operator id required for a reply.');
      const parsed = ReplySchema.safeParse(request.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'Invalid reply.');
      const { body, status, authorName } = parsed.data;

      const before = await withTenant({ tenantId }, (tx) =>
        tx.feedbackSubmission.findUnique({
          where: { id },
          select: { id: true, submitterEmail: true, userId: true },
        })
      );
      if (!before) throw notFound('Feedback not found.');

      const preview = body.length > 140 ? `${body.slice(0, 139)}…` : body;

      // Post the staff message + close the loop (lastResponseAt + unread + optional
      // status) atomically under the tenant's GUC.
      const row = await withTenant({ tenantId }, async (tx) => {
        await tx.feedbackMessage.create({
          data: {
            tenantId,
            submissionId: id,
            authorKind: 'staff',
            authorId,
            authorName: authorName ?? 'sparx Support',
            body,
          },
        });
        // `userUnread` only marks the THREAD; it cannot reach the notification
        // bell, which reads per-user rows.
        //
        // Written directly rather than through the automation engine because
        // this is correspondence between sparx and the account holder, not an
        // event in the tenant's business — see platform-notice.ts for the full
        // reasoning. Same transaction as the reply, so a reply cannot land
        // without the submitter being told.
        await writePlatformNotice(tx, {
          tenantId,
          userId: before.userId,
          kind: 'feedback.replied',
          title: 'The sparx team replied to your feedback',
          body: preview,
          entityType: 'feedback',
          entityId: id,
        });
        return tx.feedbackSubmission.update({
          where: { id },
          data: {
            lastResponseAt: new Date(),
            userUnread: true,
            ...(status ? { status } : {}),
          },
          select: SUBMISSION_SELECT,
        });
      });

      // A staff reply always notifies (docs/apps/admin/feedback.md §6).
      if (before.submitterEmail) {
        const payload: FeedbackRespondedPayload = {
          submissionId: id,
          status: row.status,
          messagePreview: preview,
          recipientEmail: before.submitterEmail,
        };
        await publish(request.log, 'feedback.responded', tenantId, authorId, { ...payload });
        // Actually deliver the reply. `feedback.responded` has no email subscriber
        // (terraform maps it to []), so this `email.send` is what closes the loop to
        // the submitter's inbox alongside the in-app notice above.
        const feedbackTitle =
          row.subject && row.subject.trim().length > 0 ? row.subject : 'your feedback';
        const brandIdentity = platformBrandIdentity(await tenantPlatformBrand(tenantId));
        await publish(request.log, 'email.send', tenantId, authorId, {
          to: before.submitterEmail,
          template: 'feedback-response',
          // Somebody wrote in, a person answered, and hitting reply should reach
          // that person. Omitted entirely when the brand has published no
          // address — an absent reply-to falls back to the sending domain, where
          // an invented one bounces, and a bounced reply to a support message is
          // worse than no reply path at all.
          ...(brandIdentity.supportEmail ? { replyTo: brandIdentity.supportEmail } : {}),
          props: {
            recipientName: null,
            feedbackTitle,
            responseBody: body,
            // The tenant's OWN product signs the reply. A hardcoded fallback
            // told a Piggles customer that sparx had answered them; a
            // brand-neutral "Support" fixed that and lost something real, since
            // a reply from a named product is warmer and more trustworthy than
            // one from nobody. `platformBrandIdentity` gives the name back
            // without shared code knowing either brand — it reads
            // `<BRAND>_SUPPORT_NAME` / `<BRAND>_BRAND_NAME`.
            responderName: authorName ?? brandIdentity.supportName,
            ...(status ? { statusLabel: status } : {}),
            threadUrl: appOrigin(brandIdentity.key),
          },
        });
      }
      return toDetail(row, id);
    }
  );
};

export default operatorFeedbackRoutes;
