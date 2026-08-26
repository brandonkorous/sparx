// The set of coded templates, as a VALUE.
//
// ══════════════════════════════════════════════════════════════════════════
// WHY THIS IS A SEPARATE, JSX-FREE MODULE
// ══════════════════════════════════════════════════════════════════════════
//
// `TemplateId` is a TypeScript union — it does not exist at runtime, so nothing
// can iterate it, and nothing could compare it against `email-worker`'s zod
// delivery gate. That gate is a hand-maintained list, and a template missing
// from it does not fail loudly: the event is acked, one warning is logged, and
// the email is gone. Four templates sat that way, two of them the codes people
// sign in with.
//
// So the set is also a value. It lives HERE rather than beside the union in
// `send.tsx` because that file is `.tsx` and pulls React in with it: a backend
// asserting "does the gate cover every template" should not have to load a
// rendering stack to ask. Reachable as `@wizeworks/email/template-ids`.
//
// The type import below is erased at build time, so this module stays free of
// any runtime dependency while remaining welded to the union.

import type { TemplateId } from './send';

export const TEMPLATE_IDS = [
  'password-reset',
  'welcome-merchant',
  'partner-welcome',
  'email-verification',
  'magic-link',
  'login-otp',
  'domain-renewal-reminder',
  'chat-notification',
  'market-settlement-report',
  'feedback-response',
  'job-application-received',
  'job-application-confirmation',
  'team-invitation',
  'form-submission-notification',
  'form-submission-confirmation',
  'tool-result',
  'billing-receipt',
  'billing-payment-failed',
  'billing-trial-ending',
  'subscription-update',
  'domain-live',
  'domain-expired',
  'email-domain-verified',
  'document-signature-request',
  'invoice-sent',
  'invitation-accepted',
  'team-member-removed',
  'team-role-changed',
  'module-toggle',
  'partner-application-received',
  'partner-earnings',
  'password-changed',
  'two-factor-changed',
  'new-device-signin',
  'feedback-received',
  'social-post-failed',
  'social-connection-expired',
  'inventory-report',
] as const satisfies readonly TemplateId[];

/**
 * Compile-time proof that the array covers the WHOLE union.
 *
 * `satisfies` above only stops an id that is not a template. This stops the
 * direction that actually bites — a new template added to the union and never
 * listed here, which would leave the coverage test passing while the new email
 * went undelivered. The build fails instead, and the error names the gap.
 */
type _Exhaustive =
  Exclude<TemplateId, (typeof TEMPLATE_IDS)[number]> extends never
    ? true
    : ['add these to TEMPLATE_IDS', Exclude<TemplateId, (typeof TEMPLATE_IDS)[number]>];
const _templateIdsAreExhaustive: _Exhaustive = true;
void _templateIdsAreExhaustive;
