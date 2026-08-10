// Email-sequence action executors (docs/81 §9) — the two effects that were
// deferred in the ActionType enum until the sequence subsystem existed. They are
// thin: all the journey logic (re-entry policy, do-not-contact, the drain) lives in
// @sparx/email-sequences; these just translate the triggering entity into an
// enroll / unenroll, exactly as email.send_campaign translates it into a send.
//
//   email.sequence_add     — enrol the trigger's customer into a sequence. The
//     sequence's own steps then send on their own clock (the worker drain), each
//     step a suppression-checked ScheduledSend.
//   email.sequence_remove  — cancel the trigger customer's active enrollment (e.g.
//     "when they buy, take them out of the win-back series").
//
// Gate manifest: module 'email' (like email.send_campaign) — enrolling is an email
// capability, held until the email module is active; the eventual sends are
// suppression-checked in the drain's enqueueSend. Enrolment reads/writes compose
// into the run-step tx so the step + the enrollment commit atomically.

import {
  registerAction,
  type ActionOutput,
  type EffectInput,
  type TenantCtx,
} from '@sparx/automation';
import { enroll, unenroll } from '@sparx/email-sequences';
import { z } from 'zod';

import { optionalEntityId, requireStringField } from './entity.js';

const SequenceConfig = z.object({ sequenceId: z.string().uuid() });

/** The entity ids captured at enroll so each step's designed email resolves its
 *  DataSources at dispatch — the same set email.send_campaign carries. */
function entityRefsFromFields(fields: EffectInput['fields']): Record<string, string | null> {
  return {
    customerId: optionalEntityId(fields, 'customer.id') ?? null,
    orderId: optionalEntityId(fields, 'order.id') ?? null,
    cartId: optionalEntityId(fields, 'cart.id') ?? null,
    quoteId: optionalEntityId(fields, 'quote.id') ?? null,
    billingDocumentId: optionalEntityId(fields, 'invoice.id') ?? null,
    companyId: optionalEntityId(fields, 'b2bAccount.id') ?? null,
    subscriptionId: optionalEntityId(fields, 'subscription.id') ?? null,
    returnId: optionalEntityId(fields, 'return.id') ?? null,
  };
}

let installed = false;

/** Register the email-sequence action executors exactly once (idempotent). */
export function installSequenceActions(): void {
  if (installed) return;
  installed = true;

  registerAction({
    type: 'email.sequence_add',
    module: 'email',
    gates: [],
    manifestNote:
      'external effect: enrols the customer into an email sequence whose steps enqueue suppression-checked ScheduledSends on their own clock; module-active + kill-switch gates apply',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = SequenceConfig.parse(effect.config);
      // A sequence is customer-addressed: an add wired to a customerless trigger is
      // misconfigured — fail loud (requireStringField), never enrol nobody.
      const recipient = requireStringField(effect.fields, 'customer.email', 'email.sequence_add');
      const customerId = optionalEntityId(effect.fields, 'customer.id') ?? null;
      const result = await enroll({ tenantId: ctx.tenantId, tx: ctx.tx }, cfg.sequenceId, {
        customerId,
        recipientEmail: recipient,
        sourceRefs: entityRefsFromFields(effect.fields),
      });
      return {
        sequenceId: cfg.sequenceId,
        enrolled: result.enrolled,
        ...(result.enrollmentId ? { enrollmentId: result.enrollmentId } : {}),
        ...(result.reason ? { skipped: result.reason } : {}),
      };
    },
  });

  registerAction({
    type: 'email.sequence_remove',
    module: 'email',
    gates: [],
    manifestNote:
      'internal effect: cancels the customer’s active enrollment in an email sequence (stops future sends); tenant-active + kill-switch gates apply',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = SequenceConfig.parse(effect.config);
      const customerId = optionalEntityId(effect.fields, 'customer.id') ?? null;
      const email = optionalEntityId(effect.fields, 'customer.email') ?? null;
      const { removed } = await unenroll(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        cfg.sequenceId,
        { customerId, email },
        'automation'
      );
      return { sequenceId: cfg.sequenceId, removed };
    },
  });
}
