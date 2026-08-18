// Site-form action executors (docs/115) — the send half of "handle a form
// submission" as an automation, so the whole form response (notify → auto-reply →
// add-to-CRM) is ONE visible, editable flow rather than hardcoded endpoint logic.
//
// Both actions PUBLISH via `enqueueSend` (a ScheduledSend row the api-rest email-
// dispatch tick turns into an `email.send`) — never a direct deliver — so this runs
// in the lean automation-worker without the render closure, exactly like the other
// email executors. They render the coded `form-submission-notification` /
// `form-submission-confirmation` templates (@wizeworks/email).
//
// Each SELF-GATES on the form's own toggle (`form.notify` / `form.autoresponder`,
// resolved from the server-only FormDefinition) so the non-technical inspector stays
// the control surface: the seeded "Handle form submissions" automation carries both
// actions unconditionally, and each one no-ops when its form has that toggle off.
//
// Gate manifest: both produce an EXTERNAL effect (an email leaves the system) but are
// PLATFORM-transactional (a form notification/confirmation isn't marketing), so —
// like email.send_internal — they are NOT gated on the email module; only the global
// tenant-active + kill-switch gates apply.

import {
  registerAction,
  type ActionOutput,
  type EffectInput,
  type TenantCtx,
} from '@wizeworks/automation';
import { enqueueSend } from '@wizeworks/email-sends';

import { fieldValueToString, optionalEntityId, resolveTenantActor } from './entity.js';

function strField(fields: EffectInput['fields'], key: string): string | null {
  const v = fields[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function listField(fields: EffectInput['fields'], key: string): string[] {
  const v = fields[key];
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    : [];
}

/** "full_name" → "Full name". The server only sees a control's `name`, not its
 *  Field label, so we humanize the key for the notification. */
function humanizeKey(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}

/** The submitted fields as an ordered, humanized {label,value} list for the notify
 *  email — a form's fields are whatever named inputs the author composed, so we
 *  render the whole set (`form.fieldEntries`, built by the resolver). */
function buildAnswers(fields: EffectInput['fields']): { label: string; value: string }[] {
  const raw = fields['form.fieldEntries'];
  if (!Array.isArray(raw)) return [];
  const out: { label: string; value: string }[] = [];
  for (const e of raw) {
    if (
      e &&
      typeof e === 'object' &&
      'key' in e &&
      typeof (e as { key: unknown }).key === 'string'
    ) {
      const key = (e as { key: string }).key;
      const value = (e as { value?: unknown }).value;
      out.push({
        label: humanizeKey(key),
        value: fieldValueToString(value),
      });
    }
  }
  return out;
}

let installed = false;

/** Register the site-form action executors exactly once (idempotent). */
export function installFormActions(): void {
  if (installed) return;
  installed = true;

  registerAction({
    type: 'form.notify',
    // Platform-transactional (a form notification is not marketing) — no email-module
    // gate, mirroring email.send_internal. Tenant-active + kill-switch still apply.
    module: null,
    gates: [],
    manifestNote:
      'external effect: enqueues a transactional form-notification email to the site owner/recipients (reply-to the submitter); platform-level — no email-module gate',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      if (effect.fields['form.notify'] !== true) return { skipped: 'notify_off' };
      const submissionId = optionalEntityId(effect.fields, 'form.submissionId');
      if (!submissionId) return { skipped: 'no_submission' };

      // Recipients come from the server-only FormDefinition (resolved into fields);
      // fall back to the tenant notify address so "email me" works before a recipient
      // is set. A recipient NEVER comes from the submission — no open relay.
      let recipients = listField(effect.fields, 'form.recipients');
      if (recipients.length === 0) {
        const fallback = (await resolveTenantActor(ctx)).email;
        if (fallback) recipients = [fallback];
      }
      if (recipients.length === 0) return { skipped: 'no_recipient' };

      const replyTo = strField(effect.fields, 'customer.email') ?? undefined;
      const props = {
        siteName: strField(effect.fields, 'form.siteName'),
        formName: strField(effect.fields, 'form.formName'),
        name: strField(effect.fields, 'customer.fullName'),
        email: strField(effect.fields, 'customer.email'),
        pageSlug: strField(effect.fields, 'form.pageSlug'),
        submittedAt: strField(effect.fields, 'form.submittedAt'),
        answers: buildAnswers(effect.fields),
        attachmentNames: listField(effect.fields, 'form.attachmentNames'),
      };

      let enqueued = 0;
      for (const to of recipients) {
        const res = await enqueueSend(
          { tenantId: ctx.tenantId, tx: ctx.tx },
          {
            recipient: to,
            scope: 'transactional',
            replyTo,
            // One notify per (submission, recipient) even across a run retry.
            dedupeKey: `form-notify:${submissionId}:${to.toLowerCase()}`,
            body: { template: 'form-submission-notification', props },
            variables: { source: 'automation:form' },
          }
        );
        if (res.enqueued) enqueued += 1;
      }
      return { submissionId, recipients: recipients.length, enqueued };
    },
  });

  registerAction({
    type: 'form.autoreply',
    module: null,
    gates: [],
    manifestNote:
      'external effect: enqueues a transactional confirmation email to the form submitter; platform-level — no email-module gate',
    async execute(ctx: TenantCtx, effect: EffectInput): Promise<ActionOutput> {
      if (effect.fields['form.autoresponder'] !== true) return { skipped: 'autoresponder_off' };
      const submissionId = optionalEntityId(effect.fields, 'form.submissionId');
      if (!submissionId) return { skipped: 'no_submission' };
      const to = strField(effect.fields, 'customer.email');
      if (!to?.includes('@')) return { skipped: 'no_recipient' };

      const props = {
        siteName: strField(effect.fields, 'form.siteName'),
        name: strField(effect.fields, 'customer.fullName'),
        subject: strField(effect.fields, 'form.autoresponderSubject'),
        message: strField(effect.fields, 'form.autoresponderMessage'),
      };
      const res = await enqueueSend(
        { tenantId: ctx.tenantId, tx: ctx.tx },
        {
          recipient: to,
          scope: 'transactional',
          dedupeKey: `form-autoreply:${submissionId}`,
          body: { template: 'form-submission-confirmation', props },
          variables: { source: 'automation:form' },
        }
      );
      return { submissionId, enqueued: res.enqueued, suppressed: res.suppressed };
    },
  });
}
