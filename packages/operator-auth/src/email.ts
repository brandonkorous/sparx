// Operator auth emails (password-set / reset). Operators have no tenant, so the
// render pipeline is attributed to the platform tenant for context only; the
// send still rides the normal `email.send` Pub/Sub bus (email-worker renders +
// relays), exactly like the tenant instance's publishAuthEmail. In dev (no
// GCP_PROJECT_ID) @sparx/events logs the payload — including the reset URL — to
// stdout, so a local operator can grab the link.

import {
  createPublisher,
  publishEvent,
  type EmailSendPayload,
  type PublisherLogger,
} from '@sparx/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

function emailTenantId(): string {
  // Attribute operator emails to the platform tenant (dogfood tenant, docs/80
  // §2) so the render pipeline has a context row. Unset → '' (email-worker
  // tolerates a tenant-less render for platform templates).
  return process.env.OPERATOR_EMAIL_TENANT_ID ?? process.env.SPARX_PLATFORM_TENANT_ID ?? '';
}

export interface PublishOperatorEmailInput {
  template: 'password-reset' | 'email-verification' | 'two-factor-changed';
  to: string;
  props: Record<string, unknown>;
  actorId: string | null;
}

export async function publishOperatorEmail(input: PublishOperatorEmailInput): Promise<void> {
  const publisher = createPublisher({ logger });
  const payload: EmailSendPayload = {
    to: input.to,
    template: input.template,
    props: input.props,
  };
  await publishEvent(publisher, 'email.send', emailTenantId(), input.actorId, payload, logger);
}
