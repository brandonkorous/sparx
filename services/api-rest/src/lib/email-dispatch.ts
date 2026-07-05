// Email-dispatch tick.
//
// Runs every EMAIL_DISPATCH_INTERVAL_MS (default 60s) from the api-rest
// bootstrap. Finds ScheduledSend rows that are due (status='pending',
// due_at <= NOW()) across all tenants via the find_due_scheduled_sends(int)
// SECURITY DEFINER function (migration 20260609000000), marks each 'sent', and
// publishes an `email.send` Pub/Sub event so email-worker renders + delivers.
//
// Singleton across pods via a Postgres advisory lock (distinct key from the
// CMS/sitebuilder ticks). Per-row work rides withTenant({tenantId}) so the
// UPDATE still goes through tenant_isolation; the cross-tenant scan does not.

import type { FastifyBaseLogger } from 'fastify';
import { prisma, withTenant } from '@sparx/db';
import { publish } from '@sparx/api-core/pubsub';
import { emailService } from '@sparx/builder';
import type { EmailRecipientRef } from './email-data.js';
import { buildFrom, renderBuilderEmailDoc, treeHasNodeType } from './tenant-email.js';

const EMAIL_DISPATCH_LOCK_KEY = 4242_4244;
const DEFAULT_INTERVAL_MS = 60_000;

interface DueSend {
  id: string;
  tenant_id: string;
  due_at: Date;
}

interface SendPayload {
  template?: string;
  props?: Record<string, unknown>;
  automationKey?: string | null;
  /** Pre-rendered broadcast body — delivered as-is by the worker. */
  raw?: { subject: string; html: string; text: string; templateId?: string };
  /** Per-recipient deferred render (docs/52 §6, docs/91 §6): reload the published
   *  Builder email tree — by row `builderEmailId` (a tenant broadcast) OR built-in
   *  `builderEmailKey` (a system automation; resolves the per-site override →
   *  tenant default) — resolve THIS recipient's data, render here. `subject`/
   *  `preheader` are optional overrides (the key path falls back to the resolved
   *  email's own); `emailType` is the declared intent for the compliance gate. */
  defer?: {
    builderEmailId?: string;
    builderEmailKey?: string;
    subject?: string;
    preheader?: string;
    emailType?: 'transactional' | 'marketing';
  };
  /** Per-send Reply-To override (e.g. a contact-form notification replies to the
   *  submitter). Preferred over the tenant's configured reply-to when present. */
  replyTo?: string;
  /** Extra Mailgun user variables (broadcast_id, automation_key, campaign). */
  variables?: Record<string, string>;
}

export interface TickResult {
  acquired: boolean;
  processed: number;
  errors: number;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Record a terminal failure on a send the tick already marked 'sent' (an
 *  unpublished template, a compliance refusal). RLS-scoped via withTenant. */
async function markSendFailed(tenantId: string, sendId: string, reason: string): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.scheduledSend.update({
      where: { id: sendId },
      data: { status: 'failed', lastError: reason },
    })
  );
}

export async function runEmailDispatchTick(logger: FastifyBaseLogger): Promise<TickResult> {
  const lock = await prisma.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_lock(${EMAIL_DISPATCH_LOCK_KEY}::int) AS acquired
  `;
  if (!lock[0]?.acquired) {
    logger.debug('email-dispatch: lock held by another pod, skipping');
    return { acquired: false, processed: 0, errors: 0 };
  }

  try {
    const due = await prisma.$queryRaw<DueSend[]>`
      SELECT id, tenant_id, due_at FROM find_due_scheduled_sends(100)
    `;
    if (due.length === 0) return { acquired: true, processed: 0, errors: 0 };

    logger.info({ count: due.length }, 'email-dispatch: dispatching due sends');

    let processed = 0;
    let errors = 0;

    for (const row of due) {
      try {
        const dispatch = await withTenant({ tenantId: row.tenant_id }, async (tx) => {
          const send = await tx.scheduledSend.findUnique({ where: { id: row.id } });
          if (send?.status !== 'pending') return null;
          const payload = (send.payload as SendPayload | null) ?? {};
          if (!payload.template && !payload.raw && !payload.defer) {
            await tx.scheduledSend.update({
              where: { id: send.id },
              data: { status: 'failed', lastError: 'No template, raw, or defer body in payload' },
            });
            return null;
          }
          const settings = await tx.emailSettings.findUnique({
            where: { tenantId: row.tenant_id },
          });
          await tx.scheduledSend.update({
            where: { id: send.id },
            data: { status: 'sent', sentAt: new Date(), attempts: { increment: 1 } },
          });
          return {
            to: send.recipient,
            customerId: send.customerId,
            // The site this send is on behalf of (docs/49 Phase 7) — drives the
            // per-site brand for the deferred render below.
            propertyId: send.propertyId,
            // Entity refs + trigger-time snapshot for a designed (Builder) email
            // (docs/91 §3); physical address for the compliance footer node.
            entityRefs: send.entityRefs,
            entitySnapshot: send.entitySnapshot,
            physicalAddress: settings?.physicalAddress ?? null,
            payload,
            from: buildFrom(settings?.fromName ?? null, settings?.fromAddress ?? null),
            // A per-send Reply-To (a form notification → the visitor) wins over the
            // tenant's default reply address.
            replyTo: payload.replyTo ?? settings?.replyTo ?? undefined,
          };
        });

        if (!dispatch) continue;

        const { payload, to, from, replyTo, customerId, propertyId } = dispatch;
        const common = {
          to,
          from,
          ...(replyTo ? { replyTo } : {}),
          ...(payload.variables ? { variables: payload.variables } : {}),
        };

        let data: Record<string, unknown>;
        if (payload.defer) {
          // Designed (Builder) email, personalized: reload the published tree,
          // resolve THIS recipient's data, and render here at dispatch (docs/52 §6,
          // docs/91 §3, §6). The email is named by row id (a tenant broadcast) OR
          // built-in key (a system automation — getPublishedByKey resolves the
          // per-site override → tenant default). Entity refs name the exact entity
          // the automation fired on; the snapshot is the scalar fallback for a
          // since-deleted entity.
          const tenantCtx = { tenantId: row.tenant_id };
          const doc = payload.defer.builderEmailKey
            ? await emailService.getPublishedByKey(
                tenantCtx,
                payload.defer.builderEmailKey,
                propertyId
              )
            : payload.defer.builderEmailId
              ? await emailService.getPublishedById(tenantCtx, payload.defer.builderEmailId)
              : null;
          if (!doc) {
            const which = payload.defer.builderEmailKey
              ? { builderEmailKey: payload.defer.builderEmailKey }
              : { builderEmailId: payload.defer.builderEmailId };
            logger.warn(
              { sendId: row.id, ...which },
              'email-dispatch: designed email not published — marking failed'
            );
            await markSendFailed(row.tenant_id, row.id, 'designed email not published');
            continue;
          }
          // Compliance gate (docs/91 §8 / docs/90 §5): a send whose DECLARED intent
          // is marketing must carry an unsubscribe node — refuse (recorded on the
          // send) otherwise. CAN-SPAM/CASL: no marketing mail without a working
          // opt-out. With no declared intent (the legacy broadcast id path)
          // marketing-ness is inferred from the tree, so there is nothing to refuse.
          const treeHasUnsub = treeHasNodeType(doc.tree, 'unsubscribe_link');
          const marketing = payload.defer.emailType
            ? payload.defer.emailType === 'marketing'
            : treeHasUnsub;
          if (marketing && !treeHasUnsub) {
            logger.warn(
              { sendId: row.id, builderEmailKey: payload.defer.builderEmailKey },
              'email-dispatch: marketing email missing unsubscribe node — refused (compliance)'
            );
            await markSendFailed(
              row.tenant_id,
              row.id,
              'compliance: a marketing email must contain an unsubscribe link'
            );
            continue;
          }
          const refs = (dispatch.entityRefs as Record<string, unknown> | null) ?? {};
          const ref: EmailRecipientRef = {
            email: to,
            customerId: customerId ?? strOrNull(refs.customerId),
            orderId: strOrNull(refs.orderId),
            cartId: strOrNull(refs.cartId),
            quoteId: strOrNull(refs.quoteId),
            billingDocumentId: strOrNull(refs.billingDocumentId),
            b2bAccountId: strOrNull(refs.b2bAccountId),
          };
          // Render via the shared core (docs/93 §2): resolve this recipient's data
          // (overlaying the trigger-time snapshot), interpolate the subject/preheader
          // — the send's optional override, else the email's own (tenant-editable)
          // values, none on the key path — and render to a branded raw payload.
          const raw = await renderBuilderEmailDoc(tenantCtx, {
            doc,
            to,
            propertyId,
            ref,
            marketing,
            physicalAddress: dispatch.physicalAddress,
            snapshot: dispatch.entitySnapshot as Record<string, unknown> | null,
            subjectOverride: payload.defer.subject,
            preheaderOverride: payload.defer.preheader,
          });
          data = { ...raw, ...common };
        } else if (payload.raw) {
          // Pre-rendered (broadcast) → delivered as-is.
          data = {
            kind: 'raw',
            subject: payload.raw.subject,
            html: payload.raw.html,
            text: payload.raw.text,
            ...(payload.raw.templateId ? { templateId: payload.raw.templateId } : {}),
            // The broadcast's site → property_id stamp for per-site analytics
            // (docs/49 Phase 7). The body was already branded at compose time.
            ...(propertyId ? { propertyId } : {}),
            ...common,
          };
        } else {
          // template → worker renders + brands. The site this send is on behalf
          // of (docs/49 Phase 7b) rides along so the worker resolves the SITE's
          // brand; null → tenant brand. Unknown templates are acked by the
          // worker until the component ships.
          data = {
            template: payload.template,
            props: payload.props ?? {},
            ...(propertyId ? { propertyId } : {}),
            ...common,
          };
        }

        await publish(logger, 'email.send', row.tenant_id, null, data);

        processed += 1;
      } catch (err) {
        errors += 1;
        logger.error({ err, sendId: row.id }, 'email-dispatch: failed to dispatch send');
      }
    }

    return { acquired: true, processed, errors };
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${EMAIL_DISPATCH_LOCK_KEY}::int)`;
  }
}

export function startEmailDispatchLoop(
  logger: FastifyBaseLogger,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      await runEmailDispatchTick(logger);
    } catch (err) {
      logger.error({ err }, 'email-dispatch: tick threw — will retry next interval');
    }
    if (stopped) return;
    timer = setTimeout(() => void tick(), intervalMs);
  };

  timer = setTimeout(() => void tick(), intervalMs);
  logger.info({ intervalMs }, 'email-dispatch: loop started');

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    logger.info('email-dispatch: loop stopped');
  };
}
