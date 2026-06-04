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
import { renderEmailTree, renderSections } from '@sparx/email';
import { emailService } from '@sparx/builder';
import { brandService } from '@sparx/email-platform';
import { normalizeBody, type EmailSectionInstance } from '@sparx/email-sections';
import { resolveBody } from './email-sections.js';
import { resolveEmailData } from './email-data.js';

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
  /** Pre-rendered broadcast/authored body — delivered as-is by the worker. */
  raw?: { subject: string; html: string; text: string; templateId?: string };
  /** Per-recipient deferred render: resolve the body for THIS recipient + render
   *  here, at dispatch. A section template (docs/31 §7) by `templateId`, or a
   *  Builder email tree (docs/52 §6) by `builderEmailId` — exactly one is set. */
  defer?: { templateId?: string; builderEmailId?: string; subject: string; preheader?: string };
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
          // For a deferred SECTION render, load the template's section list inside
          // the claim tx (RLS-scoped); rendering happens after the claim. A deferred
          // BUILDER-email render loads its published tree after the claim (its own
          // RLS-scoped read), so nothing to pre-load here.
          let deferSections: EmailSectionInstance[] | null = null;
          if (payload.defer?.templateId) {
            const tmpl = await tx.emailTemplate.findUnique({
              where: { id: payload.defer.templateId },
            });
            deferSections = normalizeBody(tmpl?.body ?? null).sections;
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
            payload,
            deferSections,
            from: buildFrom(settings?.fromName ?? null, settings?.fromAddress ?? null),
            replyTo: settings?.replyTo ?? undefined,
          };
        });

        if (!dispatch) continue;

        const { payload, to, from, replyTo, customerId, deferSections } = dispatch;
        const common = {
          to,
          from,
          ...(replyTo ? { replyTo } : {}),
          ...(payload.variables ? { variables: payload.variables } : {}),
        };

        let data: Record<string, unknown>;
        if (payload.defer?.builderEmailId) {
          // Designed (Builder) email, personalized: reload the published tree,
          // resolve THIS recipient's data, and render here at dispatch (docs/52 §6).
          const tenantCtx = { tenantId: row.tenant_id };
          const doc = await emailService.getPublishedById(tenantCtx, payload.defer.builderEmailId);
          if (!doc) {
            logger.warn(
              { sendId: row.id, builderEmailId: payload.defer.builderEmailId },
              'email-dispatch: designed email no longer published — skipping recipient'
            );
            continue;
          }
          const emailData = await resolveEmailData(tenantCtx, doc.tree, {
            email: to,
            customerId: customerId ?? undefined,
          });
          const brand = (await brandService.resolveEmailBrand(tenantCtx)) ?? undefined;
          const rendered = await renderEmailTree(
            {
              tree: doc.tree,
              subject: payload.defer.subject,
              preheader: payload.defer.preheader,
              to,
              data: emailData,
            },
            { brand }
          );
          data = {
            kind: 'raw',
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            ...common,
          };
        } else if (payload.defer && deferSections) {
          // Resolve this recipient's section data + render, here at dispatch.
          const tenantCtx = { tenantId: row.tenant_id };
          const sectionData = await resolveBody(tenantCtx, deferSections, {
            email: to,
            customerId: customerId ?? undefined,
          });
          const brand = (await brandService.resolveEmailBrand(tenantCtx)) ?? undefined;
          const rendered = await renderSections(
            {
              sections: deferSections,
              subject: payload.defer.subject,
              preheader: payload.defer.preheader,
              to,
              data: sectionData,
            },
            { brand }
          );
          data = {
            kind: 'raw',
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            ...common,
          };
        } else if (payload.raw) {
          // Pre-rendered (broadcast / authored) → delivered as-is.
          data = {
            kind: 'raw',
            subject: payload.raw.subject,
            html: payload.raw.html,
            text: payload.raw.text,
            ...(payload.raw.templateId ? { templateId: payload.raw.templateId } : {}),
            ...common,
          };
        } else {
          // template → worker renders + brands. Unknown templates are acked by
          // the worker until the component ships.
          data = { template: payload.template, props: payload.props ?? {}, ...common };
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
