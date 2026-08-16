// Per-message handler. Pure function so integration tests can drive it
// without spinning up a Pub/Sub subscription.
//
// Flow:
//   1. Validate the parsed event shape with zod against TemplateSend.
//   2. renderTemplate(input) from @sparx/email — returns html + plaintext.
//   3. getEmailProvider().send(rendered) — console or Postal depending on
//      SPARX_EMAIL_PROVIDER + POSTAL_API_KEY (selection happens inside
//      @sparx/email's providers/index.ts).
//
// Failure model — three categories:
//   - Unknown template id / zod parse failure
//       → outcome.status = 'rejected', ack the message, no retry.
//   - Provider rejects (4xx / suppressed / parameter error)
//       → outcome.status = 'rejected', ack, no retry.
//   - Provider transient (5xx / network / Postal down)
//       → throw, caller nacks and Pub/Sub redelivers.

import type { Logger } from 'pino';
import { z } from 'zod';
import { prisma } from '@sparx/db';
import {
  defaultBrand,
  getEmailProvider,
  MailgunParameterError,
  PostalParameterError,
  renderTemplate,
} from '@sparx/email';
import { analyticsService, brandService } from '@sparx/email-platform';
import { platformBrandIdentity } from '@wizeworks/brand-core';

// The delivery gate lives in its own module — see the header there for why,
// and for the four templates it silently dropped before it had a test.
import { TemplateSendSchema, Variables } from './template-schema.js';

// Pre-rendered "raw" send — used by broadcasts (render once, send to many) and
// authored-template sends. The body is already HTML/text; the worker delivers
// it as-is (no template render, no brand resolution).
const RawSendSchema = z.object({
  kind: z.literal('raw'),
  to: z.string().email(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  templateId: z.string().optional(),
  variables: Variables,
  // The site this pre-rendered send is on behalf of (docs/49 Phase 7). The body
  // is already branded (rendered at dispatch); this only rides along so the
  // worker stamps property_id for per-site analytics attribution.
  propertyId: z.string().nullable().optional(),
});

const EmailSendEvent = z.object({
  type: z.literal('email.send'),
  tenantId: z.string().min(1),
  actorId: z.string().nullable(),
  occurredAt: z.string(),
  data: z.union([RawSendSchema, TemplateSendSchema]),
});

export type EmailSendEvent = z.infer<typeof EmailSendEvent>;

export interface HandleOutcome {
  status: 'sent' | 'rejected';
  /** Provider's external id (Postal message id, or `con_*` in dev). */
  messageId: string;
  recipient: string;
  errorMessage?: string;
}

/**
 * The chrome for a tenant that has supplied no identity of its own.
 *
 * Which is most of them, early on — and until 2026-08-16 every one of those
 * sends went out saying "sparx", because `defaultBrand` is the pre-multibrand
 * default and nothing overrode it. A Piggles customer's receipt, trial notice
 * and password reset all arrived wearing another company's name.
 *
 * The NAME is fixed here, from `<BRAND>_BRAND_NAME`. The PALETTE deliberately is
 * not: what a brand-neutral platform email should look like is a design question
 * rather than a bug, and silently restyling every sparx email while fixing a
 * name would be smuggling one in. Tracked in piggles/docs/migration.
 *
 * `tenants` is the non-RLS dispatch row, so this reads on the plain client with
 * no tenant context — the same property that lets a Stripe webhook resolve a
 * tenant. Best-effort: a failed lookup renders the default rather than dropping
 * the mail, because a queue that stops is worse than a wrong word.
 */
async function platformFallbackBrand(tenantId: string, logger: Logger) {
  try {
    const row = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { platformBrand: true },
    });
    return { ...defaultBrand, siteName: platformBrandIdentity(row?.platformBrand).name };
  } catch (err) {
    logger.warn({ err }, 'platform brand lookup failed — rendering the default chrome');
    return defaultBrand;
  }
}

export function parseEvent(raw: unknown): EmailSendEvent | null {
  const result = EmailSendEvent.safeParse(raw);
  return result.success ? result.data : null;
}

export async function handle(event: EmailSendEvent, logger: Logger): Promise<HandleOutcome> {
  const data = event.data;
  const childLog = logger.child({
    tenantId: event.tenantId,
    template: 'kind' in data ? 'raw' : data.template,
  });

  try {
    let rendered;
    if ('kind' in data) {
      // Pre-rendered — deliver as-is.
      rendered = {
        from: data.from ?? defaultRawFrom(),
        to: data.to,
        replyTo: data.replyTo,
        subject: data.subject,
        html: data.html,
        text: data.text,
        templateId: data.templateId,
      };
    } else {
      // Resolve the email brand so transactional mail renders in the right
      // colors/logo. When the send carries a `propertyId` (docs/49 Phase 7b),
      // resolve the SITE's brand (its `brand_override` merged over the tenant
      // brand) so a template send on behalf of one site looks like that site;
      // null → tenant brand, and a tenant with no brand → sparx defaults.
      // Best-effort: a brand failure must not block delivery.
      let brand = null;
      try {
        brand = await brandService.resolveEmailBrand(
          { tenantId: event.tenantId },
          data.propertyId ?? null
        );
      } catch (brandErr) {
        childLog.warn({ err: brandErr }, 'brand resolution failed — rendering with defaults');
      }
      rendered = await renderTemplate(data, {
        brand: brand ?? (await platformFallbackBrand(event.tenantId, childLog)),
      });
    }

    // Stamp tenant_id (+ any caller variables: broadcast_id, automation_key) so
    // the webhook receiver can attribute delivery/engagement events. property_id
    // (docs/49 Phase 7) joins the engagement back to the SITE the send was on
    // behalf of, so EmailEvent analytics break down per site; absent → tenant-wide.
    const propertyId = data.propertyId ?? null;
    const result = await getEmailProvider().send({
      ...rendered,
      variables: {
        ...data.variables,
        tenant_id: event.tenantId,
        ...(propertyId ? { property_id: propertyId } : {}),
      },
    });

    // Record the provider ACCEPTANCE synchronously — the /messages call returned an id,
    // which is exactly what Mailgun's `accepted` webhook reports, but known now and
    // independent of whether that webhook ever reaches us. This is what makes send stats
    // (`get_email_stats`) reliable; the webhook still supplies delivered/opened/clicked.
    // BEST-EFFORT: a bookkeeping failure must never fail (and re-deliver) a sent email.
    const vars = data.variables ?? {};
    await analyticsService
      .recordAccepted({
        tenantId: event.tenantId,
        recipient: data.to,
        messageId: result.id,
        propertyId,
        broadcastId: vars.broadcast_id ?? null,
        automationKey: vars.automation_key ?? null,
        customerId: vars.customer_id ?? null,
      })
      .catch((err: unknown) => childLog.warn({ err }, 'recordAccepted failed — stat row skipped'));

    return {
      status: 'sent',
      messageId: result.id,
      recipient: data.to,
    };
  } catch (err) {
    if (isPermanent(err)) {
      childLog.warn({ err }, 'email rejected (permanent) — acking');
      return {
        status: 'rejected',
        messageId: '',
        recipient: data.to,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
    // Transient — re-throw so the caller nacks and Pub/Sub redelivers.
    throw err;
  }
}

function defaultRawFrom(): string {
  return process.env.SPARX_EMAIL_FROM ?? 'sparx <noreply@sparx.email>';
}

function isPermanent(err: unknown): boolean {
  // Provider-typed parameter-error classes — retrying won't help. Console
  // provider can't fail with anything that isn't a code bug (which we
  // WANT to surface, not silently ack), so only explicit provider
  // rejections count as permanent here.
  return err instanceof MailgunParameterError || err instanceof PostalParameterError;
}
