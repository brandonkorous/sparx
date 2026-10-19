// Publishes `email.send` for the customer-auth flows (password reset, email confirm). Same
// event path as staff auth (@wizeworks/auth email-events) — never a direct send.
// The tenant comes from the ambient request scope (tenantStore); the actual
// render + relay happens in email-worker.

import {
  createPublisher,
  publishEvent,
  type EmailSendPayload,
  type PublisherLogger,
} from '@wizeworks/events';
import { tenantStore } from '@wizeworks/db';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

export interface PublishCustomerAuthEmailInput {
  /** A link, never an OTP code. Both are the SHOP's own emails, to its own
   *  customer: the confirm link (sparx persona issue 329) and the password reset,
   *  which used the platform's staff template and arrived as "Set your sparx
   *  password" (sparx persona issue 345). */
  template: 'customer-password-reset' | 'customer-email-confirm';
  to: string;
  props: Record<string, unknown>;
}

/** Whether an email can leave this process at all. Better Auth swallows what a
 *  send callback throws, so a caller asks first (sparx persona issue 337). */
export function customerAuthEmailsCanLeave(): boolean {
  return !createPublisher({ logger }).discards;
}

export async function publishCustomerAuthEmail(
  input: PublishCustomerAuthEmailInput
): Promise<void> {
  const tenantId = tenantStore.getTenantIdOrThrow();
  const publisher = createPublisher({ logger });
  const payload: EmailSendPayload = {
    to: input.to,
    template: input.template,
    props: input.props,
    // Both emails are the SHOP's, to its own customer: from the business, with
    // replies to it (sparx persona issues 329 and 345). The worker fills the From in.
    sendAs: 'tenant' as const,
  };
  await publishEvent(publisher, 'email.send', tenantId, null, payload, logger);
}
