// @sparx/email-sequences — the reusable multi-touch email JOURNEY (docs/81 §9).
//
// A sequence is an ordered list of steps (delay + email). A customer is ENROLLED
// (by the `email.sequence_add` action, or a manual REST call), which creates one
// `EmailSequenceEnrollment` tracking their position + next-due time. The DRAIN
// (runs on the automation-worker's cron, structurally identical to the automation
// run tick) advances each due enrollment: send the current step, schedule the
// next, exit on a goal, complete at the end.
//
// Backend-safe like @sparx/email-sends: depends ONLY on @sparx/db + @sparx/email-sends
// (no render/React), so the lean automation-worker can enroll + drain. Sends go
// through the SAME `enqueueSend` producer a one-shot `email.send_campaign` uses —
// suppression, per-recipient render, and Mailgun delivery stay exactly where they
// already live. The client-safe shapes live in ./schemas.

import {
  ADVISORY_LOCKS,
  withAdvisoryTickLock,
  withTenant,
  type Prisma,
  type TenantContext,
} from '@sparx/db';
import { enqueueSend, type ScheduledSendBody } from '@sparx/email-sends';
import type { EmailSequence, EmailSequenceEnrollment, PrismaClient } from '@prisma/client';

import {
  CreateSequenceInput,
  EnrollInput,
  SequenceSteps,
  UpdateSequenceInput,
  type EnrollResult,
  type SequenceStep,
} from './schemas.js';

export * from './schemas.js';

// ─── read shapes ──────────────────────────────────────────────────────────────

export interface SequenceCounts {
  active: number;
  completed: number;
  exited: number;
  cancelled: number;
  total: number;
}

export interface SequenceWithCounts extends EmailSequence {
  counts: SequenceCounts;
}

export interface ListSequencesFilter {
  /** draft | active | archived, or omitted for all. */
  status?: string;
  /** Restrict to one site. Omit for every site (tenant-wide + all sites). */
  propertyId?: string | null;
}

export interface ListEnrollmentsFilter {
  status?: string;
  limit?: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Parse the stored JSON steps, tolerating a legacy/blank shape as an empty list. */
function parseSteps(raw: unknown): SequenceStep[] {
  const parsed = SequenceSteps.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Turn a step's body source into the `enqueueSend` body the dispatch tick decodes
 *  — the exact mapping `email.send_campaign` uses, so a sequenced send renders
 *  identically to a one-shot one. */
function stepToSendBody(step: SequenceStep): ScheduledSendBody {
  const src = step.source;
  if (src.kind === 'builder') {
    return {
      defer: {
        builderEmailId: src.builderEmailId,
        ...(step.subject ? { subject: step.subject } : {}),
        ...(step.preheader ? { preheader: step.preheader } : {}),
      },
    };
  }
  if (src.kind === 'builtin') {
    return {
      defer: {
        builderEmailKey: src.builderEmailKey,
        emailType: step.emailType,
        ...(step.subject ? { subject: step.subject } : {}),
        ...(step.preheader ? { preheader: step.preheader } : {}),
      },
    };
  }
  return { template: src.template, props: src.props };
}

/** The dedupe key that makes at most one ACTIVE enrollment per person per
 *  sequence: the customer id, else the lowercased address. Null once the
 *  enrollment leaves `active` (so the person can re-enroll if policy allows). */
function activeDedupeFor(customerId: string | null, recipientEmail: string): string {
  return customerId ?? recipientEmail.toLowerCase();
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createSequence(
  ctx: TenantContext,
  rawInput: CreateSequenceInput
): Promise<EmailSequence> {
  const input = CreateSequenceInput.parse(rawInput);
  return withTenant(ctx, (tx) =>
    tx.emailSequence.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        name: input.name,
        description: input.description ?? null,
        reentryPolicy: input.reentryPolicy,
        exitOnPurchase: input.exitOnPurchase,
        steps: input.steps as Prisma.InputJsonValue,
        // A brand-new sequence starts as a draft — it only enrols + drains once the
        // author turns it on.
        status: 'draft',
      },
    })
  );
}

export async function updateSequence(
  ctx: TenantContext,
  id: string,
  rawPatch: UpdateSequenceInput
): Promise<EmailSequence> {
  const patch = UpdateSequenceInput.parse(rawPatch);
  return withTenant(ctx, (tx) =>
    tx.emailSequence.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
        ...(patch.propertyId !== undefined ? { propertyId: patch.propertyId ?? null } : {}),
        ...(patch.reentryPolicy !== undefined ? { reentryPolicy: patch.reentryPolicy } : {}),
        ...(patch.exitOnPurchase !== undefined ? { exitOnPurchase: patch.exitOnPurchase } : {}),
        ...(patch.steps !== undefined ? { steps: patch.steps as Prisma.InputJsonValue } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      },
    })
  );
}

function foldCounts(rows: { status: string; _count: { _all: number } }[]): SequenceCounts {
  const counts: SequenceCounts = { active: 0, completed: 0, exited: 0, cancelled: 0, total: 0 };
  for (const r of rows) {
    const n = r._count._all;
    counts.total += n;
    if (r.status === 'active') counts.active += n;
    else if (r.status === 'completed') counts.completed += n;
    else if (r.status === 'exited') counts.exited += n;
    else if (r.status === 'cancelled') counts.cancelled += n;
  }
  return counts;
}

export async function listSequences(
  ctx: TenantContext,
  filter: ListSequencesFilter = {}
): Promise<SequenceWithCounts[]> {
  return withTenant(ctx, async (tx) => {
    const sequences = await tx.emailSequence.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.propertyId !== undefined ? { propertyId: filter.propertyId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (sequences.length === 0) return [];

    const grouped = await tx.emailSequenceEnrollment.groupBy({
      by: ['sequenceId', 'status'],
      where: { sequenceId: { in: sequences.map((s) => s.id) } },
      _count: { _all: true },
    });
    const bySequence = new Map<string, { status: string; _count: { _all: number } }[]>();
    for (const g of grouped) {
      const list = bySequence.get(g.sequenceId) ?? [];
      list.push({ status: g.status, _count: g._count });
      bySequence.set(g.sequenceId, list);
    }
    return sequences.map((s) => ({ ...s, counts: foldCounts(bySequence.get(s.id) ?? []) }));
  });
}

export async function getSequence(
  ctx: TenantContext,
  id: string
): Promise<SequenceWithCounts | null> {
  return withTenant(ctx, async (tx) => {
    const sequence = await tx.emailSequence.findUnique({ where: { id } });
    if (!sequence) return null;
    const grouped = await tx.emailSequenceEnrollment.groupBy({
      by: ['status'],
      where: { sequenceId: id },
      _count: { _all: true },
    });
    return { ...sequence, counts: foldCounts(grouped) };
  });
}

export interface DeleteSequenceResult {
  deleted: boolean;
  archived: boolean;
}

/** Hard-delete a draft that never enrolled anyone; otherwise ARCHIVE (keep the
 *  enrollment history + stop draining). Deleting a live series with people in it
 *  would erase the record that they were emailed. */
export async function deleteSequence(
  ctx: TenantContext,
  id: string
): Promise<DeleteSequenceResult> {
  return withTenant(ctx, async (tx) => {
    const sequence = await tx.emailSequence.findUnique({ where: { id } });
    if (!sequence) return { deleted: false, archived: false };
    const enrollmentCount = await tx.emailSequenceEnrollment.count({ where: { sequenceId: id } });
    if (sequence.status === 'draft' && enrollmentCount === 0) {
      await tx.emailSequence.delete({ where: { id } });
      return { deleted: true, archived: false };
    }
    await tx.emailSequence.update({ where: { id }, data: { status: 'archived' } });
    return { deleted: false, archived: true };
  });
}

// ─── enroll / unenroll ────────────────────────────────────────────────────────

/**
 * Enroll a person into a sequence. Idempotent-per-policy: honors the sequence's
 * re-entry policy + a marketing do-not-contact opt-out, and the unique active
 * index guarantees no double-active enrollment. Returns why it was skipped rather
 * than throwing, so the calling run-step logs the exact reason.
 */
export async function enroll(
  ctx: TenantContext,
  sequenceId: string,
  rawInput: EnrollInput
): Promise<EnrollResult> {
  const input = EnrollInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const sequence = await tx.emailSequence.findUnique({ where: { id: sequenceId } });
    if (!sequence) return { enrolled: false, reason: 'sequence_not_found' };
    if (sequence.status !== 'active') return { enrolled: false, reason: 'sequence_inactive' };

    const steps = parseSteps(sequence.steps);
    if (steps.length === 0) return { enrolled: false, reason: 'no_steps' };

    // Resolve the recipient + do-not-contact from the customer when not supplied.
    let recipientEmail = input.recipientEmail ?? null;
    let doNotContact = false;
    const customerId = input.customerId ?? null;
    if (customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { email: true, doNotContact: true },
      });
      if (customer) {
        if (!recipientEmail && customer.email) recipientEmail = customer.email;
        doNotContact = customer.doNotContact;
      }
    }
    if (!recipientEmail) return { enrolled: false, reason: 'no_recipient' };

    // A marketing opt-out blocks enrollment only when the journey actually sends
    // marketing mail. A fully-transactional sequence (every step transactional)
    // still enrols — the same rule email.send_campaign applies per-send.
    const hasMarketing = steps.some((s) => s.emailType === 'marketing');
    if (hasMarketing && doNotContact) return { enrolled: false, reason: 'do_not_contact' };

    const dedupe = activeDedupeFor(customerId, recipientEmail);

    // Never double-enrol an active person (belt to the unique index's suspenders).
    const activeExists = await tx.emailSequenceEnrollment.count({
      where: { sequenceId, activeDedupe: dedupe },
    });
    if (activeExists > 0) return { enrolled: false, reason: 'already_active' };

    // `once` blocks a second enrollment even after the first finished.
    if (sequence.reentryPolicy === 'once') {
      const priorCount = await tx.emailSequenceEnrollment.count({
        where: {
          sequenceId,
          ...(customerId ? { customerId } : { recipientEmail }),
        },
      });
      if (priorCount > 0) return { enrolled: false, reason: 'already_enrolled' };
    }

    const nextRunAt = new Date(Date.now() + steps[0]!.delaySeconds * 1000);
    const created = await tx.emailSequenceEnrollment.create({
      data: {
        sequenceId,
        tenantId: ctx.tenantId,
        propertyId: sequence.propertyId,
        customerId,
        recipientEmail,
        status: 'active',
        currentStep: 0,
        nextRunAt,
        sourceAutomationId: input.sourceAutomationId ?? null,
        ...(input.sourceRefs ? { sourceRefs: input.sourceRefs } : {}),
        activeDedupe: dedupe,
      },
    });
    return { enrolled: true, enrollmentId: created.id };
  });
}

/** Remove a person from a sequence — cancels their ACTIVE enrollment (no-op if
 *  they weren't in it). Frees the active-dedupe slot so they can re-enroll later. */
export async function unenroll(
  ctx: TenantContext,
  sequenceId: string,
  target: { customerId?: string | null; email?: string | null },
  reason = 'removed'
): Promise<{ removed: number }> {
  const dedupe = target.customerId ?? target.email?.toLowerCase() ?? null;
  if (!dedupe) return { removed: 0 };
  return withTenant(ctx, async (tx) => {
    const result = await tx.emailSequenceEnrollment.updateMany({
      where: { sequenceId, activeDedupe: dedupe, status: 'active' },
      data: {
        status: 'cancelled',
        exitedAt: new Date(),
        exitReason: reason.slice(0, 64),
        activeDedupe: null,
      },
    });
    return { removed: result.count };
  });
}

export async function listEnrollments(
  ctx: TenantContext,
  sequenceId: string,
  filter: ListEnrollmentsFilter = {}
): Promise<EmailSequenceEnrollment[]> {
  return withTenant(ctx, (tx) =>
    tx.emailSequenceEnrollment.findMany({
      where: { sequenceId, ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { enrolledAt: 'desc' },
      take: Math.min(filter.limit ?? 100, 500),
    })
  );
}

// ─── the drain (worker cron) ────────────────────────────────────────────────

export interface DrainResult {
  /** False when another pod holds the drain lock this tick (all counts 0). */
  acquired: boolean;
  due: number;
  sent: number;
  completed: number;
  exited: number;
  skipped: number;
}

/** Raw shape from `find_due_sequence_enrollments` (snake_case columns). */
interface DueEnrollmentRow {
  id: string;
  tenant_id: string;
  sequence_id: string;
  property_id: string | null;
  customer_id: string | null;
  recipient_email: string;
  current_step: number;
  source_refs: unknown;
}

/**
 * Advance every due enrollment one step. Cross-tenant DISCOVERY goes through the
 * `find_due_sequence_enrollments` SECURITY DEFINER function (the worker is FORCE
 * RLS-bound `sparx_app`, no ambient bypass) — exactly like `find_due_automation_runs`.
 * Each enrollment is then driven under `withTenant`, so the send + the advance
 * commit atomically and every read/write is RLS-scoped. Called from the worker's
 * cron tick under the EMAIL_SEQUENCE_DRAIN advisory lock (a cross-pod singleton).
 */
export async function drainDueEnrollments(db: PrismaClient, batch = 100): Promise<DrainResult> {
  const SKIPPED: DrainResult = {
    acquired: false,
    due: 0,
    sent: 0,
    completed: 0,
    exited: 0,
    skipped: 0,
  };
  // Cross-pod singleton — pass THIS tick's `db` as the lock client so the lock and
  // the work share one connection (see withAdvisoryTickLock).
  return withAdvisoryTickLock(
    ADVISORY_LOCKS.EMAIL_SEQUENCE_DRAIN,
    SKIPPED,
    async () => {
      const rows = await db.$queryRaw<DueEnrollmentRow[]>`
        SELECT id, tenant_id, sequence_id, property_id, customer_id, recipient_email,
               current_step, source_refs
        FROM find_due_sequence_enrollments(${batch}::int)
      `;
      const result: DrainResult = {
        acquired: true,
        due: rows.length,
        sent: 0,
        completed: 0,
        exited: 0,
        skipped: 0,
      };
      for (const row of rows) {
        const outcome = await driveEnrollment(db, row);
        if (outcome === 'sent') result.sent += 1;
        else if (outcome === 'completed') result.completed += 1;
        else if (outcome === 'exited') result.exited += 1;
        else result.skipped += 1;
      }
      return result;
    },
    { client: db }
  );
}

type DriveOutcome = 'sent' | 'completed' | 'exited' | 'skipped';

async function driveEnrollment(db: PrismaClient, due: DueEnrollmentRow): Promise<DriveOutcome> {
  return withTenant(
    { tenantId: due.tenant_id },
    async (tx): Promise<DriveOutcome> => {
      // Re-read under RLS — the SECURITY DEFINER scan crossed only a column subset,
      // and state may have changed since discovery.
      const enrollment = await tx.emailSequenceEnrollment.findUnique({ where: { id: due.id } });
      if (enrollment?.status !== 'active') return 'skipped';

      const sequence = await tx.emailSequence.findUnique({ where: { id: enrollment.sequenceId } });
      if (sequence?.status !== 'active') {
        // Race: the sequence was paused/archived between discovery and now. Back
        // off an hour rather than hot-loop; the scan's JOIN already excludes it.
        await tx.emailSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: { nextRunAt: new Date(Date.now() + 60 * 60 * 1000) },
        });
        return 'skipped';
      }

      // Goal exit: they bought after enrolling → stop the series.
      if (sequence.exitOnPurchase && enrollment.customerId) {
        const purchased = await tx.order.count({
          where: { customerId: enrollment.customerId, placedAt: { gt: enrollment.enrolledAt } },
        });
        if (purchased > 0) {
          await exitEnrollment(tx, enrollment.id, 'purchased');
          return 'exited';
        }
      }

      const steps = parseSteps(sequence.steps);
      if (enrollment.currentStep >= steps.length) {
        await completeEnrollment(tx, enrollment.id);
        return 'completed';
      }

      const step = steps[enrollment.currentStep]!;
      const refs =
        (enrollment.sourceRefs as Record<string, string | null> | null) ??
        (enrollment.customerId ? { customerId: enrollment.customerId } : null);

      // Send this step. dedupeKey makes a crash-resume idempotent: re-draining the
      // same step re-enqueues with the same key, which the ScheduledSend unique
      // index silently skips — the person is never emailed the same step twice.
      await enqueueSend(
        { tenantId: due.tenant_id, tx },
        {
          recipient: enrollment.recipientEmail,
          customerId: enrollment.customerId,
          propertyId: enrollment.propertyId,
          scope: step.emailType === 'marketing' ? 'marketing' : 'transactional',
          body: stepToSendBody(step),
          variables: { source: 'sequence' },
          dedupeKey: `seq:${enrollment.id}:${String(enrollment.currentStep)}`,
          ...(refs ? { entityRefs: refs } : {}),
        }
      );

      const nextStep = enrollment.currentStep + 1;
      const now = new Date();
      if (nextStep >= steps.length) {
        await tx.emailSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: 'completed',
            currentStep: nextStep,
            lastStepAt: now,
            completedAt: now,
            activeDedupe: null,
          },
        });
      } else {
        await tx.emailSequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStep: nextStep,
            lastStepAt: now,
            nextRunAt: new Date(now.getTime() + steps[nextStep]!.delaySeconds * 1000),
          },
        });
      }
      return 'sent';
    },
    db
  );
}

async function completeEnrollment(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.emailSequenceEnrollment.update({
    where: { id },
    data: { status: 'completed', completedAt: new Date(), activeDedupe: null },
  });
}

async function exitEnrollment(
  tx: Prisma.TransactionClient,
  id: string,
  reason: string
): Promise<void> {
  await tx.emailSequenceEnrollment.update({
    where: { id },
    data: {
      status: 'exited',
      exitedAt: new Date(),
      exitReason: reason.slice(0, 64),
      activeDedupe: null,
    },
  });
}
