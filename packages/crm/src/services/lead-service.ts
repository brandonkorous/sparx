// leadService — mirror a site-form submission into the CRM (docs/115).
//
// Shared by the `form.submitted` consumer and the CRM-activation backfill. Upserts
// a prospect (no marketing consent), logs the message as a note activity, and
// stamps the submission with the linked customer id. Idempotent: it no-ops when
// the submission is already linked or flagged spam, so a re-delivered event AND a
// backfill re-run are both safe. No email ⇒ no-op (a contact can't be keyed).

import { withTenant } from '@sparx/db';

import type { ServiceContext } from '../errors';
import * as customerService from './customer-service';
import * as activityService from './activity-service';

export interface FormLeadInput {
  submissionId: string;
  propertyId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
}

export async function captureFormLead(ctx: ServiceContext, input: FormLeadInput): Promise<void> {
  if (!input.email) return;

  // Idempotency gate — skip if already mirrored or spam. Also confirms the row is
  // in THIS tenant (RLS) before we touch the CRM.
  const sub = await withTenant(ctx, (tx) =>
    tx.formSubmission.findUnique({
      where: { id: input.submissionId },
      select: { customerId: true, status: true },
    })
  );
  if (!sub || sub.customerId || sub.status === 'spam') return;

  const { customer } = await customerService.captureLead(ctx, {
    propertyId: input.propertyId,
    email: input.email,
    name: input.name,
    phone: input.phone,
    source: 'form',
  });

  if (input.message) {
    await activityService.record(ctx, {
      customerId: customer.id,
      type: 'note',
      description: input.message,
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
