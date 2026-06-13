// Email action executors (docs/81 §5.4, docs/84 Slice F1).
//
// Two effects that PUBLISH a send (never direct-deliver — docs/81 §5.4): they
// enqueue a `ScheduledSend` via `@sparx/email-sends`' `enqueueSend`, which the
// api-rest email-dispatch tick later turns into an `email.send`. That keeps
// suppression, the per-recipient render, and Mailgun delivery exactly where they
// already live, and — crucially — lets these run inside the lean automation-worker
// WITHOUT dragging the @sparx/email/@sparx/ui render closure into its image
// (`@sparx/email-sends` depends only on @sparx/db). The render half stays in
// api-rest's dispatch tick, which has the email/builder libs.
//
//   email.send_campaign  — customer-addressed marketing send. Recipient is the
//     trigger's `customer.email`; respects the CRM do-not-contact flag (the
//     email suppression list is the other gate, enforced in enqueueSend). Body is
//     a published Builder email (`defer`, personalized at dispatch) OR a coded
//     template.
//   email.send_internal  — staff notification (deal-closing alert, etc.). Sent to
//     a configured address as a raw body; transactional scope so it isn't blocked
//     by a customer's marketing unsubscribe and isn't anchored to a customer.
//
// Gate manifest: both produce an EXTERNAL effect (an email leaves the system), but
// no send-volume gate exists yet — the global gates (tenant-active, kill-switch,
// `module: 'email'` active) plus the in-service suppression check are the controls
// today. A dedicated rate/volume gate is a future addition (docs/81 §7.1).

import {
  registerAction,
  type ActionOutput,
  type EffectInput,
  type TenantCtx,
} from '@sparx/automation';
import { enqueueSend, type ScheduledSendBody } from '@sparx/email-sends';
import { z } from 'zod';

import { optionalBoolField, optionalEntityId, requireStringField } from './entity.js';

// The site an automation send is on behalf of (docs/49 Phase 7b) — read from
// the trigger entity's resolved fields so the eventual render uses that site's
// brand. We probe the conventional carriers in priority order; absent → null (a
// tenant-wide send → tenant brand). Lights up per-site automation branding the
// moment a property-scoped trigger (e.g. an order stamped with its site) flows.
function resolveSourceProperty(fields: Parameters<typeof optionalEntityId>[0]): string | null {
  return (
    optionalEntityId(fields, 'propertyId') ??
    optionalEntityId(fields, 'order.propertyId') ??
    optionalEntityId(fields, 'customer.propertyId') ??
    null
  );
}

// Body source for a campaign: a designed Builder email (rendered per-recipient at
// dispatch) OR a coded template. Exactly one — modeled as a union so config can't
// supply both/neither.
const CampaignConfig = z.union([
  z.object({
    builderEmailId: z.string().uuid(),
    subject: z.string().min(1),
    preheader: z.string().optional(),
    delaySeconds: z.number().int().min(0).optional(),
  }),
  z.object({
    template: z.string().min(1),
    props: z.record(z.string(), z.unknown()).optional(),
    delaySeconds: z.number().int().min(0).optional(),
  }),
]);

const InternalConfig = z
  .object({
    to: z.string().email(),
    subject: z.string().min(1),
    html: z.string().optional(),
    text: z.string().optional(),
    delaySeconds: z.number().int().min(0).optional(),
  })
  .refine((c) => c.html !== undefined || c.text !== undefined, {
    message: 'email.send_internal needs an html or text body.',
  });

let installed = false;

/** Register the email action executors exactly once (idempotent). */
export function installEmailActions(): void {
  if (installed) return;
  installed = true;

  registerAction({
    type: 'email.send_campaign',
    module: 'email',
    gates: [],
    manifestNote:
      'external effect: enqueues a suppression-checked ScheduledSend (marketing) that the email-dispatch tick sends; module-active + kill-switch gates apply',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = CampaignConfig.parse(effect.config);
      const recipient = requireStringField(effect.fields, 'customer.email', 'email.send_campaign');

      // Defense in depth: skip a contact the CRM flagged do-not-contact, even
      // before the email suppression list is consulted in enqueueSend.
      if (optionalBoolField(effect.fields, 'customer.doNotContact') === true) {
        return { recipient, enqueued: false, skipped: 'do_not_contact' };
      }

      const customerId = optionalEntityId(effect.fields, 'customer.id') ?? null;
      const body: ScheduledSendBody =
        'builderEmailId' in cfg
          ? {
              defer: {
                builderEmailId: cfg.builderEmailId,
                subject: cfg.subject,
                preheader: cfg.preheader,
              },
            }
          : { template: cfg.template, props: cfg.props };

      const { enqueued, suppressed } = await enqueueSend(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        {
          recipient,
          customerId,
          propertyId: resolveSourceProperty(effect.fields),
          scope: 'marketing',
          delaySeconds: cfg.delaySeconds,
          body,
          variables: { source: 'automation' },
        }
      );
      return { recipient, enqueued, suppressed };
    },
  });

  registerAction({
    type: 'email.send_internal',
    module: 'email',
    gates: [],
    manifestNote:
      'external effect: enqueues a transactional ScheduledSend to a configured staff address; module-active + kill-switch gates apply',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = InternalConfig.parse(effect.config);
      const body: ScheduledSendBody = {
        raw: { subject: cfg.subject, html: cfg.html ?? '', text: cfg.text ?? '' },
      };
      const { enqueued, suppressed } = await enqueueSend(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        {
          recipient: cfg.to,
          propertyId: resolveSourceProperty(effect.fields),
          scope: 'transactional',
          delaySeconds: cfg.delaySeconds,
          body,
          variables: { source: 'automation:internal' },
        }
      );
      return { recipient: cfg.to, enqueued, suppressed };
    },
  });
}
