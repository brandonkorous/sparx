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
import {
  getEmailProvider,
  MailgunParameterError,
  PostalParameterError,
  renderTemplate,
} from '@sparx/email';
import { brandService } from '@sparx/email-platform';

const Variables = z.record(z.string(), z.string()).optional();

// Fields every template send carries, independent of the template id. Spread
// into each discriminated-union member so they stay in one place.
//   propertyId (docs/49 Phase 7b): the site this send is on behalf of — drives
//   per-site brand resolution in handle(). Absent/null → tenant-wide brand.
const TemplateMeta = {
  to: z.string().email(),
  from: z.string().optional(),
  replyTo: z.string().optional(),
  variables: Variables,
  propertyId: z.string().nullable().optional(),
};

const TemplateSendSchema = z.discriminatedUnion('template', [
  z.object({
    template: z.literal('password-reset'),
    ...TemplateMeta,
    props: z.object({
      name: z.string().optional(),
      resetUrl: z.string().url(),
      expiresInMinutes: z.number().int().positive().optional(),
      intro: z.string().optional(),
      outro: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('welcome-merchant'),
    ...TemplateMeta,
    props: z.object({
      name: z.string().optional(),
      storeName: z.string().min(1),
      dashboardUrl: z.string().url(),
      intro: z.string().optional(),
      outro: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('email-verification'),
    ...TemplateMeta,
    props: z.object({
      name: z.string().optional(),
      verifyUrl: z.string().url(),
      expiresInMinutes: z.number().int().positive().optional(),
      intro: z.string().optional(),
      outro: z.string().optional(),
    }),
  }),
  z.object({
    template: z.literal('domain-renewal-reminder'),
    ...TemplateMeta,
    props: z.object({
      domainName: z.string().min(1),
      daysUntilExpiry: z.number().int().positive(),
      expiresAt: z.string(),
      renewUrl: z.string().url(),
      autoRenew: z.boolean().optional(),
    }),
  }),
  z.object({
    template: z.literal('order-confirmation'),
    ...TemplateMeta,
    props: z.object({
      customerName: z.string().min(1),
      orderNumber: z.string().min(1),
      totalCents: z.number().int().nonnegative(),
      currency: z.string().length(3),
      orderId: z.string().min(1),
      orderStatusUrl: z.string().url().optional(),
      lineItems: z
        .array(
          z.object({
            name: z.string().min(1),
            quantity: z.number().int().positive(),
            unitTotalCents: z.number().int().nonnegative(),
          })
        )
        .optional(),
      shippingAddress: z
        .object({
          name: z.string().min(1),
          line1: z.string().min(1),
          line2: z.string().optional(),
          city: z.string().min(1),
          region: z.string().optional(),
          postalCode: z.string().min(1),
          country: z.string().length(2),
        })
        .optional(),
    }),
  }),
  z.object({
    template: z.literal('shipping-confirmation'),
    ...TemplateMeta,
    props: z.object({
      customerName: z.string().min(1),
      orderNumber: z.string().min(1),
      carrier: z.string().min(1),
      trackingNumber: z.string().min(1),
      trackingUrl: z.string().url().optional(),
      estimatedDelivery: z.string().optional(),
      shippingAddress: z
        .object({
          name: z.string().min(1),
          line1: z.string().min(1),
          line2: z.string().optional(),
          city: z.string().min(1),
          region: z.string().optional(),
          postalCode: z.string().min(1),
          country: z.string().length(2),
        })
        .optional(),
    }),
  }),
  z.object({
    template: z.literal('chat-notification'),
    ...TemplateMeta,
    props: z.object({
      customerName: z.string().min(1),
      messageSnippet: z.string(),
      conversationUrl: z.string().url(),
      storeName: z.string().optional(),
    }),
  }),
]);

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
      // null → tenant brand, and a tenant with no brand → Sparx defaults.
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
      rendered = await renderTemplate(data, { brand: brand ?? undefined });
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
  return process.env.SPARX_EMAIL_FROM ?? 'Sparx <noreply@sparx.email>';
}

function isPermanent(err: unknown): boolean {
  // Provider-typed parameter-error classes — retrying won't help. Console
  // provider can't fail with anything that isn't a code bug (which we
  // WANT to surface, not silently ack), so only explicit provider
  // rejections count as permanent here.
  return err instanceof MailgunParameterError || err instanceof PostalParameterError;
}
