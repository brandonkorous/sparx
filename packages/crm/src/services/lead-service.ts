// leadService — mirror a site-form submission into the CRM (docs/115).
//
// Shared by the automation `crm.capture_lead` action and the CRM-activation
// backfill. Given only a submission id, it loads the row (the single source of
// truth), upserts a prospect (no marketing consent), logs the message as a note
// activity, and stamps the submission with the linked customer id. Idempotent: it
// no-ops when the submission is already linked, flagged spam, or has no email — so
// a re-run (automation retry AND backfill) is always safe. Composes into `ctx.tx`
// when the caller passes one (the automation engine's per-step tx).

import { withTenant } from '@sparx/db';

import type { ServiceContext } from '../errors';
import * as customerService from './customer-service';
import * as activityService from './activity-service';
import * as dealService from './deal-service';
import * as pipelineService from './pipeline-service';

export interface FormLeadInput {
  submissionId: string;
}

export async function captureFormLead(ctx: ServiceContext, input: FormLeadInput): Promise<void> {
  // Load the row (RLS-scoped) — the single source of truth for the lead + the
  // idempotency gate. Skip if already mirrored, spam, or has no addressable email.
  const sub = await withTenant(ctx, (tx) =>
    tx.formSubmission.findUnique({
      where: { id: input.submissionId },
      select: {
        customerId: true,
        status: true,
        propertyId: true,
        name: true,
        email: true,
        phone: true,
        message: true,
      },
    })
  );
  if (!sub || sub.customerId || sub.status === 'spam' || !sub.email) return;

  const { customer } = await customerService.captureLead(ctx, {
    propertyId: sub.propertyId,
    email: sub.email,
    name: sub.name,
    phone: sub.phone,
    source: 'form',
  });

  if (sub.message) {
    await activityService.record(ctx, {
      customerId: customer.id,
      type: 'note',
      description: sub.message,
      actorType: 'system',
      linkedEntityType: 'form_submission',
      linkedEntityId: input.submissionId,
    });
  }

  await withTenant(ctx, (tx) =>
    tx.formSubmission.update({
      where: { id: input.submissionId },
      data: { customerId: customer.id },
    })
  );
}

export interface OpenFormDealInput {
  submissionId: string;
}

// First trimmed non-empty value, else the fallback. Form fields arrive as
// `string | null` and can be blank/whitespace, so we want `||`'s empty-string
// fallthrough — expressed explicitly here since `??` would keep a blank value.
function firstNonBlank(values: (string | null | undefined)[], fallback: string): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return fallback;
}

// Open a CRM deal from a site-form submission — the quote / lead-request path
// (docs/115). Runs AFTER captureFormLead in the same automation step, so the
// submission is already linked to a prospect and the deal attaches to that
// customer. The deal lands on the default pipeline's first open stage (the natural
// inbox for a fresh, unqualified lead) at $0 — the tenant fills in the value. The
// submitter's message rides along as the deal's opening context via the customer's
// activity timeline (already logged by captureFormLead).
//
// Idempotent on the submission: one deal per submission, keyed by
// `metadata.formSubmissionId`, so an automation retry (a step that created the deal
// then crashed before committing) never opens a duplicate. A no-op when the lead
// wasn't captured (spam / no email) — a deal with no contact isn't useful — or when
// a deal for this submission already exists. Composes into `ctx.tx` when passed.
export async function openFormDeal(ctx: ServiceContext, input: OpenFormDealInput): Promise<void> {
  const sub = await withTenant(ctx, (tx) =>
    tx.formSubmission.findUnique({
      where: { id: input.submissionId },
      select: { customerId: true, status: true, name: true, email: true, formName: true },
    })
  );
  // Needs the captured contact (customerId set by captureFormLead). Spam never
  // opens a deal.
  if (!sub || sub.status === 'spam' || !sub.customerId) return;

  // One deal per submission — re-check before creating (a prior step may have
  // created it, then crashed before its transaction committed).
  const existing = await withTenant(ctx, (tx) =>
    tx.deal.findFirst({
      where: { metadata: { path: ['formSubmissionId'], equals: input.submissionId } },
      select: { id: true },
    })
  );
  if (existing) return;

  const pipeline = await resolveEntryPipeline(ctx);
  const entryStage = pipeline.stages.find((s) => s.stageType === 'open') ?? pipeline.stages[0];
  if (!entryStage) return;

  const who = firstNonBlank([sub.name, sub.email], 'Website lead');
  const formLabel = firstNonBlank([sub.formName], 'Website enquiry');
  await dealService.create(ctx, {
    pipelineId: pipeline.id,
    stageId: entryStage.id,
    customerId: sub.customerId,
    title: `${formLabel} — ${who}`,
    source: 'form',
    metadata: { formSubmissionId: input.submissionId },
  });
}

/** The pipeline a form-sourced lead lands in: the default (else the first, else a
 *  freshly-bootstrapped template), with its stages ordered. Bootstrapping covers a
 *  tenant whose CRM was activated without the onboarding pipeline seed. */
async function resolveEntryPipeline(ctx: ServiceContext) {
  const found = await withTenant(ctx, (tx) =>
    tx.pipeline.findFirst({
      where: { archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })
  );
  if (found && found.stages.length > 0) return found;
  return pipelineService.bootstrapDefaultPipeline(ctx);
}
