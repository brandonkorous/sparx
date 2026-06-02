// Auth-side tenant-lifecycle event publisher. Mirrors email-events.ts —
// signUpMerchant emits a typed `tenant.created` event after the tenant row
// commits, which the legal-seed worker consumes to seed starter legal pages
// (docs/42 §3). Fire-and-forget: a Pub/Sub outage must never roll back an
// otherwise successful sign-up.

import {
  createPublisher,
  publishEvent,
  type PublisherLogger,
  type TenantCreatedPayload,
} from '@sparx/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

export interface PublishTenantCreatedInput {
  tenantId: string;
  actorId: string | null;
  slug: string;
  name: string;
}

export async function publishTenantCreated(input: PublishTenantCreatedInput): Promise<void> {
  const publisher = createPublisher({ projectId: process.env.GCP_PROJECT_ID, logger });
  const payload: TenantCreatedPayload = { slug: input.slug, name: input.name };
  await publishEvent(publisher, 'tenant.created', input.tenantId, input.actorId, payload, logger);
}
