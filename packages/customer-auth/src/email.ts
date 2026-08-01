// Publishes `email.send` for the customer-auth flows (password reset). Same
// event path as staff auth (@sparx/auth email-events) — never a direct send.
// The tenant comes from the ambient request scope (tenantStore); the actual
// render + relay happens in email-worker.

import {
  createPublisher,
  publishEvent,
  type EmailSendPayload,
  type PublisherLogger,
} from '@sparx/events';
import { tenantStore } from '@sparx/db';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

export interface PublishCustomerAuthEmailInput {
  /** Reuses the existing platform template; a link, never an OTP code. */
  template: 'password-reset';
  to: string;
  props: Record<string, unknown>;
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
  };
  await publishEvent(publisher, 'email.send', tenantId, null, payload, logger);
}
