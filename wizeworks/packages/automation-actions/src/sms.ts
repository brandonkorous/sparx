// `sms.send` — texting, through the same action seam as email and CRM
// (docs/151 §8, docs/152 D1).
//
// Registered with `registerAction` like everything else, so events, audit and
// the gate chain fire once at the source rather than being re-implemented here.
// The actual send is `@wizeworks/sms/delivery`, which owns consent, suppression,
// quiet hours and the ceiling; this file is the automation-facing wrapper and
// deliberately contains no policy of its own.
//
// ── IT DECLARES A REAL GATE MANIFEST ─────────────────────────────────────────
//
// Unlike the CRM actions, this one has an EXTERNAL, BILLABLE effect: it hands a
// message to a vendor who charges for it. So it declares that rather than an
// empty manifest with a note, and the engine's gate chain treats it as spend.

import { z } from 'zod';
import type { ActionOutput, EffectInput, TenantCtx } from '@wizeworks/automation';
import { registerAction } from '@wizeworks/automation';
import { interpolateFields } from './entity.js';
import { sendTenantSms } from '@wizeworks/sms/delivery';

const SmsConfig = z.object({
  /** The message. Supports the same `{{field}}` interpolation the email actions
   *  use, so an automation can say "Hi {{customer.firstName}}". */
  body: z.string().min(1).max(1600),
  /** Which field on the trigger entity holds the number. Defaults to the
   *  customer's phone, which is where it is in almost every case. */
  toField: z.string().min(1).max(120).default('customer.phone'),
  /** `marketing` needs consent and waits for quiet hours; `transactional` does
   *  neither, because the person asked for it. Defaults to the CAUTIOUS one:
   *  an automation author who has not thought about it has almost certainly
   *  built a campaign, and mislabelling a campaign as transactional is how a
   *  sender gets blocked. */
  scope: z.enum(['marketing', 'transactional']).default('marketing'),
});

function optionalString(fields: Record<string, unknown>, key: string): string | null {
  const v = fields[key];
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

export function installSmsActions(): void {
  registerAction({
    type: 'sms.send',
    module: 'crm',
    gates: [],
    manifestNote:
      'sends a text message through the configured provider. External and BILLABLE, so the delivery layer enforces consent, STOP suppression, quiet hours and a per-tenant daily ceiling before any provider call; with no provider credential configured it resolves to the console provider and cannot spend',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      const cfg = SmsConfig.parse(effect.config);

      const to = optionalString(effect.fields, cfg.toField);
      // No number is not a failure — most contacts do not have one, and an
      // automation that also emails must not die on the ones that do not.
      if (!to) return { skipped: 'no_phone' };

      const result = await sendTenantSms(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        {
          to,
          body: interpolateFields(cfg.body, effect.fields),
          scope: cfg.scope,
          customerId: optionalString(effect.fields, 'customer.id'),
          // Their timezone when the trigger entity carries one. Quiet hours are
          // the RECIPIENT's, and the delivery layer falls back to the tenant's
          // configured default rather than guessing the sender's.
          timezone: optionalString(effect.fields, 'customer.timezone'),
        },
        process.env
      );

      // Every outcome is reported, including the refusals. An automation run
      // that says "held until 9am" is telling its author something true; one
      // that says nothing looks broken.
      return {
        outcome: result.outcome,
        ...(result.messageId ? { messageId: result.messageId } : {}),
        ...(result.reason ? { reason: result.reason } : {}),
        ...(result.retryAt ? { retryAt: result.retryAt.toISOString() } : {}),
        segments: result.segments,
      };
    },
  });
}
