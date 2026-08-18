// webhookService — ingests Mailgun delivery/engagement webhooks.
//
// Mailgun POSTs a JSON envelope: { signature: {timestamp, token, signature},
// "event-data": { event, recipient, message.headers, user-variables, ... } }.
// We verify the HMAC signature, attribute the event to a tenant via the
// `tenant_id` user variable (stamped on every send by email-worker), then:
//   • append an EmailEvent (the analytics source of truth), and
//   • on bounce/complaint/unsubscribe, record an EmailSuppression.
//
// The receiver is unauthenticated (Mailgun has no bearer token) — the
// signature IS the auth. Tenant context is synthesized from the verified
// payload, so the withTenant write is still RLS-scoped to the right tenant.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

import { recordFromWebhook } from './suppression-service';

export interface MailgunSignature {
  timestamp: string;
  token: string;
  signature: string;
}

/** Verify the Mailgun webhook HMAC: hex(HMAC-SHA256(signingKey, timestamp+token)). */
export function verifyMailgunSignature(sig: MailgunSignature, signingKey: string): boolean {
  if (!sig.timestamp || !sig.token || !sig.signature) return false;
  const expected = createHmac('sha256', signingKey)
    .update(sig.timestamp + sig.token)
    .digest('hex');
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig.signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Mailgun event → our EmailEvent.type. Permanent failures are bounces;
// temporary failures stay as `failed` (transient, not suppression-worthy).
function mapEventType(event: string, severity?: string): string | null {
  switch (event) {
    case 'accepted':
      return 'accepted';
    case 'delivered':
      return 'delivered';
    case 'opened':
      return 'opened';
    case 'clicked':
      return 'clicked';
    case 'complained':
      return 'complained';
    case 'unsubscribed':
      return 'unsubscribed';
    case 'failed':
      return severity === 'permanent' ? 'bounced' : 'failed';
    default:
      return null;
  }
}

// EmailEvent.type → the in-process platform-bus topic the CRM email-event
// consumer reacts to (engagement activity rows + unsubscribe → do-not-contact),
// or null when no consumer acts on it. The api-rest webhook route publishes this
// post-ingest — kept as a pure mapping here so @wizeworks/email-platform doesn't take
// a dependency on the CRM platform bus. `accepted`/`delivered`/`complained`/
// `failed` have no in-process consumer topic today (complaint/bounce still
// suppress at send time via the EmailSuppression list).
function platformTopicFor(type: string): string | null {
  switch (type) {
    case 'opened':
      return 'email.opened';
    case 'clicked':
      return 'email.clicked';
    case 'bounced':
      return 'email.bounced';
    case 'unsubscribed':
      return 'email.unsubscribed';
    default:
      return null;
  }
}

// type → suppression (scope, reason), or null if it doesn't suppress.
function suppressionFor(type: string): { scope: string; reason: string } | null {
  switch (type) {
    case 'bounced':
      return { scope: 'all', reason: 'bounce' };
    case 'complained':
      return { scope: 'all', reason: 'complaint' };
    case 'unsubscribed':
      return { scope: 'marketing', reason: 'unsubscribe' };
    default:
      return null;
  }
}

interface MailgunEventData {
  event?: string;
  timestamp?: number;
  recipient?: string;
  severity?: string;
  reason?: string;
  message?: { headers?: { 'message-id'?: string } };
  'user-variables'?: Record<string, unknown>;
  'delivery-status'?: { message?: string; description?: string; code?: number };
}

export interface IngestResult {
  handled: boolean;
  reason?: 'no_tenant' | 'unknown_event';
  tenantId?: string;
  type?: string;
  // Present when this event maps to an in-process platform topic the CRM
  // consumers act on. The webhook route publishes it onto the platform bus after
  // ingest commits — making the (otherwise-starved) email-event consumer fire in
  // production: engagement → CrmActivity, and unsubscribe → do-not-contact → exit
  // the marketing segment.
  platformEvent?: {
    topic: string;
    customerId: string | null;
    email: string;
    messageId: string | null;
    broadcastId: string | null;
    occurredAt: string;
  };
}

/** Ingest one verified Mailgun webhook envelope. Returns handled=false (still a
 *  200 to Mailgun) when the event can't be attributed or isn't one we track. */
export async function ingest(eventData: MailgunEventData): Promise<IngestResult> {
  const type = mapEventType(eventData.event ?? '', eventData.severity);
  if (!type) return { handled: false, reason: 'unknown_event' };

  const vars = eventData['user-variables'] ?? {};
  const tenantId = typeof vars.tenant_id === 'string' ? vars.tenant_id : undefined;
  if (!tenantId) return { handled: false, reason: 'no_tenant', type };

  // `accepted` is now recorded SYNCHRONOUSLY by email-worker at send time
  // (`analyticsService.recordAccepted`), because a working delivery webhook can't be
  // assumed. Writing it here too would double-count every send, so we drop Mailgun's
  // redundant `accepted` event — the worker's row is the source of truth. Every OTHER
  // event (delivered / opened / clicked / bounced / complained / unsubscribed / failed)
  // is only knowable from the webhook and still flows through below.
  if (type === 'accepted') return { handled: true, tenantId, type };

  const recipient = eventData.recipient ?? '';
  const broadcastId = typeof vars.broadcast_id === 'string' ? vars.broadcast_id : null;
  const automationKey = typeof vars.automation_key === 'string' ? vars.automation_key : null;
  const customerId = typeof vars.customer_id === 'string' ? vars.customer_id : null;
  const propertyVar = typeof vars.property_id === 'string' ? vars.property_id : null;
  const messageId = eventData.message?.headers?.['message-id'] ?? null;
  const occurredAt = eventData.timestamp ? new Date(eventData.timestamp * 1000) : new Date();
  const reason =
    eventData.reason ??
    eventData['delivery-status']?.description ??
    eventData['delivery-status']?.message ??
    null;

  await withTenant({ tenantId }, async (tx) => {
    // Per-site attribution (docs/49 Phase 7): the worker stamps `property_id` on
    // every per-site send so engagement analytics break down per site. Verify it
    // still resolves — RLS scopes findUnique to this tenant, and the FK would
    // abort the whole ingest if the site was deleted between send and event.
    // Older sends predate the stamp; fall back to the broadcast's site (FK-SetNull
    // keeps that valid even after a site delete). NULL = tenant-wide / primary.
    let propertyId: string | null = null;
    if (propertyVar) {
      const prop = await tx.property.findUnique({
        where: { id: propertyVar },
        select: { id: true },
      });
      propertyId = prop?.id ?? null;
    } else if (broadcastId) {
      const bc = await tx.broadcast.findUnique({
        where: { id: broadcastId },
        select: { propertyId: true },
      });
      propertyId = bc?.propertyId ?? null;
    }

    await tx.emailEvent.create({
      data: {
        tenantId,
        propertyId,
        type,
        recipient,
        messageId,
        broadcastId,
        automationKey,
        customerId,
        reason,
        occurredAt,
        raw: eventData as unknown as Prisma.InputJsonValue,
      },
    });

    const suppress = suppressionFor(type);
    if (suppress && recipient) {
      await recordFromWebhook(tx, tenantId, {
        email: recipient,
        scope: suppress.scope,
        reason: suppress.reason,
        customerId,
      });
    }
  });

  const platformTopic = platformTopicFor(type);
  return {
    handled: true,
    tenantId,
    type,
    ...(platformTopic
      ? {
          platformEvent: {
            topic: platformTopic,
            customerId,
            email: recipient,
            messageId,
            broadcastId,
            occurredAt: occurredAt.toISOString(),
          },
        }
      : {}),
  };
}
