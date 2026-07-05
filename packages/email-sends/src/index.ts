// @sparx/email-sends — the email enqueue primitive.
//
// The email module's send pipeline is: a `ScheduledSend` row (pending, due_at) →
// the api-rest `email-dispatch` tick (lib/email-dispatch.ts) marks it sent and
// publishes an `email.send` Pub/Sub event → email-worker renders + delivers.
// `enqueueSend` is the PRODUCER side of that pipeline: suppression-check, then
// write one ScheduledSend row. It deliberately depends on NOTHING but @sparx/db
// (no @sparx/email render lib, no React) so a backend worker — the
// automation-worker's email.send_campaign / send_internal executors — can enqueue
// a send without pulling the whole email-platform UI/render closure into its
// image. @sparx/email-platform owns the management surface (templates, broadcasts,
// automations); this owns only the queue write the engine needs.
//
// The body mirrors the `SendPayload` the dispatch tick decodes: a coded
// `template` + props, a pre-rendered `raw` body, or a `defer` reference to a
// published Builder email rendered per-recipient at dispatch (docs/52 §6).

import { withTenant, type Prisma, type TenantContext } from '@sparx/db';

/**
 * A `defer` body references a published Builder email, rendered per-recipient at
 * dispatch (docs/52 §6, docs/91 §6). The email is named EITHER by its row `id`
 * (a tenant broadcast targeting one specific email) OR by its built-in `key` (a
 * system automation referencing a provisioned default — `getPublishedByKey`
 * resolves the per-site override → tenant default at dispatch). Exactly one of
 * `builderEmailId` / `builderEmailKey`.
 *
 * `subject`/`preheader` are an OPTIONAL override — when omitted (the key path),
 * dispatch uses the resolved email's own (tenant-editable) subject/preheader.
 * `emailType` is the declared intent (docs/91 §8): it drives the suppression
 * scope and the compliance gate (a `marketing` send whose tree lacks an
 * unsubscribe node is refused). Absent ⇒ marketing-ness is inferred from the tree.
 */
export interface DeferBody {
  builderEmailId?: string;
  builderEmailKey?: string;
  subject?: string;
  preheader?: string;
  emailType?: 'transactional' | 'marketing';
}

/** One of the three body sources the email-dispatch tick understands. */
export type ScheduledSendBody =
  | { template: string; props?: Record<string, unknown> }
  | { raw: { subject: string; html: string; text: string; templateId?: string } }
  | { defer: DeferBody };

export interface EnqueueSendSpec {
  /** Destination address (a customer's email, or a staff inbox for internal). */
  recipient: string;
  /** Soft reference to the CRM customer, when the send is customer-addressed. */
  customerId?: string | null;
  /**
   * The site this send is on behalf of (docs/49 Phase 7b). Persisted on the
   * ScheduledSend so the dispatch tick can resolve the SITE's brand at render.
   * Null (the default) = a tenant-wide send → tenant brand.
   */
  propertyId?: string | null;
  /**
   * Suppression scope. `marketing` is blocked by a marketing-scope OR an `all`
   * suppression; `transactional` only by an `all` suppression. Defaults to
   * `transactional` (the safe-to-send default for system/internal mail).
   */
  scope?: 'transactional' | 'marketing';
  /** Delay before the send becomes due (seconds). Defaults to 0 (next tick). */
  delaySeconds?: number;
  /**
   * Idempotency / frequency-cap key. The ScheduledSend table is
   * UNIQUE(tenant_id, dedupe_key), so a duplicate key is skipped (no error) —
   * pass a stable key to dedupe retries or cap repeats.
   */
  dedupeKey?: string | null;
  /** The email body source (template | raw | defer). */
  body: ScheduledSendBody;
  /**
   * Per-send Reply-To override (e.g. a contact-form notification replies to the
   * visitor who wrote in, not the tenant's default reply address). Rides in the
   * payload JSON; the email-dispatch tick prefers it over the tenant's configured
   * reply-to. Omitted ⇒ the tenant default applies.
   */
  replyTo?: string;
  /** Extra Mailgun user-variables threaded onto the eventual send. */
  variables?: Record<string, string>;
  /**
   * For a `defer` (Builder email) send: the entity ids the deferred render
   * resolves the email's DataSources against (docs/91 §3) — `{ customerId,
   * orderId, cartId, quoteId, billingDocumentId, b2bAccountId }`.
   */
  entityRefs?: Record<string, string | null> | null;
  /** The automation's flat, trigger-time resolved field map — a scalar fallback at
   *  render when a live entity no longer resolves. */
  entitySnapshot?: Record<string, unknown> | null;
}

export interface EnqueueResult {
  /** A new ScheduledSend row was created (false if suppressed or a dedupe hit). */
  enqueued: boolean;
  /** The recipient is on the suppression list for this scope — nothing queued. */
  suppressed: boolean;
}

/** Build the JSON payload the dispatch tick decodes, omitting absent keys so the
 *  stored JSON never carries `undefined`. */
function toPayload(spec: EnqueueSendSpec): Prisma.InputJsonValue {
  const payload: Record<string, unknown> = {};
  if ('template' in spec.body) {
    payload.template = spec.body.template;
    if (spec.body.props) payload.props = spec.body.props;
  } else if ('raw' in spec.body) {
    payload.raw = spec.body.raw;
  } else {
    payload.defer = spec.body.defer;
  }
  if (spec.replyTo) payload.replyTo = spec.replyTo;
  if (spec.variables) payload.variables = spec.variables;
  return payload as Prisma.InputJsonValue;
}

/**
 * Enqueue one email for delivery by writing a ScheduledSend row.
 *
 * Honors the suppression list before writing (a suppressed recipient is a no-op,
 * `{ enqueued: false, suppressed: true }`). Composes into `ctx.tx` when the caller
 * passes one (the automation engine's per-step tx), so the enqueue commits
 * atomically with the run-step that produced it. Returns whether a row landed.
 */
export async function enqueueSend(
  ctx: TenantContext,
  spec: EnqueueSendSpec
): Promise<EnqueueResult> {
  const scope = spec.scope ?? 'transactional';
  const recipient = spec.recipient;

  return withTenant(ctx, async (tx) => {
    const suppressed = await tx.emailSuppression.count({
      where: { email: recipient.toLowerCase(), scope: { in: [scope, 'all'] } },
    });
    if (suppressed > 0) return { enqueued: false, suppressed: true };

    // createMany + skipDuplicates so a dedupeKey collision (frequency cap /
    // retry) is silently skipped instead of throwing on the unique constraint.
    const result = await tx.scheduledSend.createMany({
      data: [
        {
          tenantId: ctx.tenantId,
          recipient,
          customerId: spec.customerId ?? null,
          propertyId: spec.propertyId ?? null,
          payload: toPayload(spec),
          dueAt: new Date(Date.now() + (spec.delaySeconds ?? 0) * 1000),
          status: 'pending',
          dedupeKey: spec.dedupeKey ?? null,
          ...(spec.entityRefs ? { entityRefs: spec.entityRefs } : {}),
          ...(spec.entitySnapshot
            ? { entitySnapshot: spec.entitySnapshot as Prisma.InputJsonValue }
            : {}),
        },
      ],
      skipDuplicates: true,
    });

    return { enqueued: result.count > 0, suppressed: false };
  });
}
