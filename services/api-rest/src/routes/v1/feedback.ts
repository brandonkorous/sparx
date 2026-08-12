// In-product feedback — the current user's own submissions, the reply thread,
// and the non-intrusive pulse (docs/112-feedback.md). The WizeWorks-staff side
// (cross-tenant triage + response) lives in the admin app
// (docs/apps/admin/feedback.md), not here.
//
//   GET    /v1/me/feedback                  → my submissions + unread count
//   GET    /v1/me/feedback/unread-count     → just the unread count (header dot poll)
//   POST   /v1/me/feedback                  → file a submission (+ feedback.submitted)
//   GET    /v1/me/feedback/:id              → one submission + its thread (clears unread)
//   POST   /v1/me/feedback/:id/messages     → reply on my own thread
//   GET    /v1/me/feedback/pulse            → null, or a pulse descriptor if eligible
//   POST   /v1/me/feedback/pulse/event      → record shown | dismissed | answered
//
// All three tables are tenant-scoped FORCE RLS, so every query goes through
// `withRequestTenant` (SET LOCAL app.tenant_id) — a bare prisma call sees zero
// rows. A user only ever reads their OWN submissions (userId filter); RLS is the
// tenant backstop. `internal_tags` / `assignee_staff_id` are staff-only and are
// never selected into a response here.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withRequestTenant } from '@sparx/api-core/db';
import { ok } from '@sparx/api-core/envelope';
import { requireAuth } from '@sparx/api-core/auth';
import { ApiError, notFound } from '@sparx/api-core/errors';
import { publish } from '@sparx/api-core/pubsub';
import type { FeedbackSubmittedPayload } from '@sparx/events';

const CATEGORIES = ['idea', 'problem', 'question', 'praise'] as const;
const SOURCES = ['button', 'pulse', 'command'] as const;

// Soft anti-abuse cap (docs/112 §3.2): authenticated-only, so this is a gentle
// guard against runaway submissions, not a hard wall — over the cap we return a
// friendly 429 the dashboard surfaces as a thank-you-try-later toast.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

// The captured client context (docs/112 §4). Stored verbatim as `context` JSON.
// Fully optional + length-bounded — it is advisory metadata, never trusted for
// identity (that is server-stamped from the session).
const FeedbackContext = z
  .object({
    route: z.string().max(2000),
    routePattern: z.string().max(2000).nullable(),
    module: z.string().max(50).nullable(),
    section: z.string().max(80).nullable(),
    entity: z.object({ type: z.string().max(80), id: z.string().max(200) }).nullable(),
    pageTitle: z.string().max(300).nullable(),
    property: z.object({ id: z.string().max(80), name: z.string().max(200) }).nullable(),
    trail: z.array(z.string().max(2000)).max(20),
    viewport: z.object({ width: z.number().int(), height: z.number().int() }),
    device: z.enum(['desktop', 'tablet', 'mobile']),
    theme: z.enum(['light', 'dark']),
    locale: z.string().max(20),
    appVersion: z.string().max(80),
    userAgent: z.string().max(500),
  })
  .partial();

const CreateBody = z.object({
  category: z.enum(CATEGORIES),
  subject: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1).max(5000),
  sentiment: z.number().int().min(1).max(4).optional(),
  source: z.enum(SOURCES).default('button'),
  context: FeedbackContext.default({}),
  attachmentAssetIds: z.array(z.string().uuid()).max(5).optional(),
});

const MessageBody = z.object({
  body: z.string().trim().min(1).max(5000),
  attachmentAssetIds: z.array(z.string().uuid()).max(5).optional(),
});

const IdParam = z.object({ id: z.string().uuid() });

const PulseQuery = z.object({ route: z.string().max(2000).optional() });

const PulseEventBody = z.object({
  action: z.enum(['shown', 'dismissed', 'answered']),
  sentiment: z.number().int().min(1).max(4).optional(),
});

// ── Pulse eligibility tuning (docs/112 §5.2) ───────────────────────────────
const MIN_ACCOUNT_AGE_DAYS = 14; // warm enough to have an opinion
const PULSE_COOLDOWN_DAYS = 90; // quarterly sentiment cadence
const PULSE_BACKOFF_DAYS = 180; // after repeated dismissals, back off further
const RECENT_SUBMIT_SUPPRESS_DAYS = 30; // a recent submitter just told us
const BACKOFF_DISMISSAL_THRESHOLD = 2;
const PULSE_QUESTION = 'How’s your experience with sparx so far?';
// Routes where a sentiment nudge would be an interruption, even after a
// completion. The client also self-suppresses; this is the server backstop.
const SUPPRESSED_ROUTE_PREFIXES = [
  '/commerce/checkout',
  '/settings/billing',
  '/onboarding',
  '/sign-in',
  '/sign-up',
];

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

interface SubmissionRow {
  id: string;
  source: string;
  category: string;
  subject: string | null;
  body: string;
  sentiment: number | null;
  status: string;
  context: unknown;
  attachmentAssetIds: string[];
  lastResponseAt: Date | null;
  userUnread: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SUBMISSION_SELECT = {
  id: true,
  source: true,
  category: true,
  subject: true,
  body: true,
  sentiment: true,
  status: true,
  context: true,
  attachmentAssetIds: true,
  lastResponseAt: true,
  userUnread: true,
  createdAt: true,
  updatedAt: true,
} as const;

function mapSubmission(row: SubmissionRow) {
  return {
    id: row.id,
    source: row.source,
    category: row.category,
    subject: row.subject,
    body: row.body,
    sentiment: row.sentiment,
    status: row.status,
    context: row.context,
    attachmentAssetIds: row.attachmentAssetIds,
    lastResponseAt: row.lastResponseAt,
    userUnread: row.userUnread,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync demands async; registration body is sync.
const feedbackRoutes: FastifyPluginAsync = async (app) => {
  // ── List my submissions + the unread count ──────────────────────────────
  app.get('/v1/me/feedback', async (request) => {
    const auth = requireAuth(request);
    const result = await withRequestTenant(request, async (tx) => {
      const items = await tx.feedbackSubmission.findMany({
        where: { userId: auth.actorId, tenantId: auth.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { ...SUBMISSION_SELECT, _count: { select: { messages: true } } },
      });
      const unreadCount = await tx.feedbackSubmission.count({
        where: { userId: auth.actorId, tenantId: auth.tenantId, userUnread: true },
      });
      return { items, unreadCount };
    });
    return ok({
      items: result.items.map((row) => ({
        ...mapSubmission(row),
        messageCount: row._count.messages,
      })),
      unreadCount: result.unreadCount,
    });
  });

  // ── Just the unread count — cheap poll for the header dot ────────────────
  app.get('/v1/me/feedback/unread-count', async (request) => {
    const auth = requireAuth(request);
    const count = await withRequestTenant(request, (tx) =>
      tx.feedbackSubmission.count({
        where: { userId: auth.actorId, tenantId: auth.tenantId, userUnread: true },
      })
    );
    return ok({ count });
  });

  // ── File a submission ───────────────────────────────────────────────────
  app.post('/v1/me/feedback', async (request, reply) => {
    const auth = requireAuth(request);
    const input = CreateBody.parse(request.body);

    const created = await withRequestTenant(request, async (tx) => {
      // Soft rate limit — count this user's submissions in the trailing window.
      const recentCount = await tx.feedbackSubmission.count({
        where: {
          userId: auth.actorId,
          tenantId: auth.tenantId,
          createdAt: { gt: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
        },
      });
      if (recentCount >= RATE_LIMIT_MAX) {
        throw new ApiError(
          'RATE_LIMITED',
          "You've sent a lot of feedback recently — thank you! Please try again in a little while."
        );
      }

      // Snapshot the submitter's identity so the admin inbox stays legible even
      // if the user is later deleted (the FK goes SET NULL).
      const user = await tx.user.findUnique({
        where: { id: auth.actorId },
        select: { email: true, name: true },
      });

      const row = await tx.feedbackSubmission.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.actorId,
          submitterEmail: user?.email ?? null,
          submitterName: user?.name ?? null,
          source: input.source,
          category: input.category,
          subject: input.subject ?? null,
          body: input.body,
          sentiment: input.sentiment ?? null,
          context: input.context,
          attachmentAssetIds: input.attachmentAssetIds ?? [],
        },
        select: { ...SUBMISSION_SELECT, submitterEmail: true },
      });

      // A pulse submission doubles as a "responded" signal — stamp the pulse
      // state so the cadence + suppression honor it.
      if (input.source === 'pulse') {
        await tx.feedbackPulseState.upsert({
          where: { userId_tenantId: { userId: auth.actorId, tenantId: auth.tenantId } },
          create: {
            tenantId: auth.tenantId,
            userId: auth.actorId,
            lastSubmittedAt: new Date(),
            lastSentiment: input.sentiment ?? null,
          },
          update: {
            lastSubmittedAt: new Date(),
            lastSentiment: input.sentiment ?? null,
            consecutiveDismissals: 0,
          },
        });
      }

      return row;
    });

    const ctx = (input.context ?? {}) as { module?: string | null };
    const payload: FeedbackSubmittedPayload = {
      submissionId: created.id,
      source: input.source,
      category: input.category,
      subject: input.subject ?? null,
      sentiment: input.sentiment ?? null,
      module: ctx.module ?? null,
      submitterEmail: created.submitterEmail,
    };
    await publish(request.log, 'feedback.submitted', auth.tenantId, auth.actorId, { ...payload });

    // Acknowledge real feedback with a "we got it" email (not the quick pulse
    // ratings — those are a tap, not a message that deserves a reply).
    if (input.source !== 'pulse' && created.submitterEmail) {
      const subj = input.subject?.trim();
      const firstLine = input.body.trim().split('\n')[0]?.trim();
      let title = 'your feedback';
      if (subj && subj.length > 0) title = subj;
      else if (firstLine && firstLine.length > 0) title = firstLine;
      const feedbackTitle = title.slice(0, 120);
      await publish(request.log, 'email.send', auth.tenantId, auth.actorId, {
        to: created.submitterEmail,
        template: 'feedback-received',
        props: { recipientName: null, feedbackTitle },
      });
    }

    reply.code(201);
    return ok(mapSubmission(created));
  });

  // ── One submission + its thread (clears the unread flag) ─────────────────
  app.get('/v1/me/feedback/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = IdParam.parse(request.params);

    const result = await withRequestTenant(request, async (tx) => {
      const submission = await tx.feedbackSubmission.findFirst({
        where: { id, userId: auth.actorId, tenantId: auth.tenantId },
        select: SUBMISSION_SELECT,
      });
      if (!submission) return null;

      const messages = await tx.feedbackMessage.findMany({
        where: { submissionId: id, tenantId: auth.tenantId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          authorKind: true,
          authorName: true,
          body: true,
          attachmentAssetIds: true,
          createdAt: true,
        },
      });

      // Opening the thread is "I've seen the response."
      if (submission.userUnread) {
        await tx.feedbackSubmission.update({
          where: { id },
          data: { userUnread: false },
        });
        submission.userUnread = false;
      }

      return { submission, messages };
    });

    if (!result) throw notFound('Feedback', id);
    return ok({ ...mapSubmission(result.submission), messages: result.messages });
  });

  // ── Reply on my own thread ──────────────────────────────────────────────
  app.post('/v1/me/feedback/:id/messages', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = IdParam.parse(request.params);
    const input = MessageBody.parse(request.body);

    const message = await withRequestTenant(request, async (tx) => {
      const submission = await tx.feedbackSubmission.findFirst({
        where: { id, userId: auth.actorId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (!submission) return null;

      const user = await tx.user.findUnique({
        where: { id: auth.actorId },
        select: { name: true, email: true },
      });

      return tx.feedbackMessage.create({
        data: {
          tenantId: auth.tenantId,
          submissionId: id,
          authorKind: 'user',
          authorId: auth.actorId,
          authorName: user?.name ?? user?.email ?? 'You',
          body: input.body,
          attachmentAssetIds: input.attachmentAssetIds ?? [],
        },
        select: {
          id: true,
          authorKind: true,
          authorName: true,
          body: true,
          attachmentAssetIds: true,
          createdAt: true,
        },
      });
    });

    if (!message) throw notFound('Feedback', id);
    reply.code(201);
    return ok(message);
  });

  // ── Pulse eligibility ───────────────────────────────────────────────────
  app.get('/v1/me/feedback/pulse', async (request) => {
    const auth = requireAuth(request);
    const { route } = PulseQuery.parse(request.query);

    if (route && SUPPRESSED_ROUTE_PREFIXES.some((p) => route.startsWith(p))) {
      return ok(null);
    }

    const descriptor = await withRequestTenant(request, async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: auth.actorId },
        select: { createdAt: true },
      });
      // Account too young → never pulse.
      if (!user || user.createdAt > daysAgo(MIN_ACCOUNT_AGE_DAYS)) return null;

      const state = await tx.feedbackPulseState.findUnique({
        where: { userId_tenantId: { userId: auth.actorId, tenantId: auth.tenantId } },
      });

      if (state) {
        if (state.lastSubmittedAt && state.lastSubmittedAt > daysAgo(RECENT_SUBMIT_SUPPRESS_DAYS)) {
          return null;
        }
        const cooldownDays =
          state.consecutiveDismissals >= BACKOFF_DISMISSAL_THRESHOLD
            ? PULSE_BACKOFF_DAYS
            : PULSE_COOLDOWN_DAYS;
        if (state.lastShownAt && state.lastShownAt > daysAgo(cooldownDays)) {
          return null;
        }
      }

      return { promptId: 'pulse-sentiment', kind: 'sentiment' as const, question: PULSE_QUESTION };
    });

    return ok(descriptor);
  });

  // ── Pulse interaction tracking ──────────────────────────────────────────
  app.post('/v1/me/feedback/pulse/event', async (request) => {
    const auth = requireAuth(request);
    const input = PulseEventBody.parse(request.body);

    await withRequestTenant(request, async (tx) => {
      const base = { tenantId: auth.tenantId, userId: auth.actorId };
      const key = { userId_tenantId: { userId: auth.actorId, tenantId: auth.tenantId } };
      if (input.action === 'shown') {
        await tx.feedbackPulseState.upsert({
          where: key,
          create: { ...base, lastShownAt: new Date() },
          update: { lastShownAt: new Date() },
        });
      } else if (input.action === 'dismissed') {
        await tx.feedbackPulseState.upsert({
          where: key,
          create: { ...base, lastDismissedAt: new Date(), consecutiveDismissals: 1 },
          update: { lastDismissedAt: new Date(), consecutiveDismissals: { increment: 1 } },
        });
      } else {
        // answered — the sentiment is recorded; clears the dismissal streak.
        await tx.feedbackPulseState.upsert({
          where: key,
          create: {
            ...base,
            lastSubmittedAt: new Date(),
            lastSentiment: input.sentiment ?? null,
          },
          update: {
            lastSubmittedAt: new Date(),
            lastSentiment: input.sentiment ?? null,
            consecutiveDismissals: 0,
          },
        });
      }
    });

    return ok({ recorded: true });
  });
};

export default feedbackRoutes;
