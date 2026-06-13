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
import { renderEmailTree } from '@sparx/email';
import { emailService } from '@sparx/builder';
import { brandService } from '@sparx/email-platform';
import { interpolateEmailTokens, resolvePath, type BuilderNode } from '@sparx/builder-schemas';
import { applyEntitySnapshot, resolveEmailData, type EmailRecipientRef } from './email-data.js';
import { unsubscribeUrl } from './email-unsubscribe.js';

const EMAIL_DISPATCH_LOCK_KEY = 4242_4244;
const DEFAULT_INTERVAL_MS = 60_000;
const FALLBACK_FROM = 'Sparx <noreply@sparx.email>';

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
  /** Per-recipient deferred render (docs/52 §6): reload the published Builder
   *  email tree by `builderEmailId`, resolve THIS recipient's data, render here. */
  defer?: { builderEmailId: string; subject: string; preheader?: string };
  /** Extra Mailgun user variables (broadcast_id, automation_key, campaign). */
  variables?: Record<string, string>;
}

export interface TickResult {
  acquired: boolean;
  processed: number;
  errors: number;
}

function buildFrom(fromName: string | null, fromAddress: string | null): string {
  if (!fromAddress) return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** Does the tree contain a node of `type` (depth-first)? Used to detect the
 *  `unsubscribe_link` node that marks a tree as marketing (docs/91 §8). */
function treeHasNodeType(node: BuilderNode, type: string): boolean {
  if (node.type === type) return true;
  for (const child of node.children ?? []) if (treeHasNodeType(child, type)) return true;
  return false;
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
            replyTo: settings?.replyTo ?? undefined,
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
        if (payload.defer?.builderEmailId) {
          // Designed (Builder) email, personalized: reload the published tree,
          // resolve THIS recipient's data, and render here at dispatch (docs/52 §6,
          // docs/91 §3). Entity refs name the exact entity the automation fired on;
          // the snapshot is the scalar fallback for a since-deleted entity.
          const tenantCtx = { tenantId: row.tenant_id };
          const doc = await emailService.getPublishedById(tenantCtx, payload.defer.builderEmailId);
          if (!doc) {
            logger.warn(
              { sendId: row.id, builderEmailId: payload.defer.builderEmailId },
              'email-dispatch: designed email no longer published — skipping recipient'
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
          const subject = payload.defer.subject;
          const preheader = payload.defer.preheader ?? null;
          // Resolve only the sources the tree (and the subject/preheader) reference,
          // then overlay the trigger-time snapshot as a scalar fallback.
          const emailData = applyEntitySnapshot(
            await resolveEmailData(tenantCtx, doc.tree, ref, [subject, preheader ?? '']),
            dispatch.entitySnapshot as Record<string, unknown> | null
          );
          const resolveToken = (path: string): unknown => resolvePath({ root: emailData }, path);
          const finalSubject = interpolateEmailTokens(subject, resolveToken);
          const finalPreheader =
            preheader != null ? interpolateEmailTokens(preheader, resolveToken) : undefined;
          // Marketing iff the tree carries an unsubscribe node (docs/91 §8): supply
          // the one-click URL + the List-Unsubscribe header; render the address node.
          const marketing = treeHasNodeType(doc.tree, 'unsubscribe_link');
          const unsubUrl = marketing ? unsubscribeUrl(row.tenant_id, to) : undefined;
          const brand = (await brandService.resolveEmailBrand(tenantCtx, propertyId)) ?? undefined;
          const rendered = await renderEmailTree(
            {
              tree: doc.tree,
              subject: finalSubject,
              preheader: finalPreheader,
              to,
              data: emailData,
              compliance: {
                physicalAddress: dispatch.physicalAddress ?? undefined,
                unsubscribeUrl: unsubUrl,
              },
            },
            { brand }
          );
          data = {
            kind: 'raw',
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            // Carry the site through so the worker stamps property_id for per-site
            // analytics (docs/49 Phase 7); the body is already site-branded above.
            ...(propertyId ? { propertyId } : {}),
            ...(unsubUrl
              ? {
                  headers: {
                    'List-Unsubscribe': `<${unsubUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                  },
                }
              : {}),
            ...common,
          };
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
