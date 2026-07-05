// Public site-forms submit endpoint (docs/115).
//
//   POST /v1/public/forms/submit ?tenant=<slug>[&property=<slug>]
//   A visitor submits a Builder ContactForm on a tenant site. The row is ALWAYS
//   stored (the durable inbox is the backbone), then — per the form's server-side
//   config — the owner is emailed, the submitter optionally auto-replied, and
//   `form.submitted` is published for the CRM lead consumer.
//
// Anonymous (no auth; the `/v1/public/` prefix is exempt). NOT module-gated:
// storing + emailing must work regardless of modules; only the CRM fan-out (in the
// consumer) checks the `crm` gate.
//
// SECURITY — the request carries ONLY identifiers + field values. Tenant/site are
// resolved server-side from slugs (never a client id); the form's routing config
// (recipients, which actions) is read from the PUBLISHED tree + the server-only
// FormDefinition, never from the request. The endpoint refuses a submission whose
// (page, formNodeId) doesn't resolve to a live ContactForm, so it can't be used to
// spam arbitrary tenants, and it can never be coerced into mailing an
// attacker-chosen address (no recipient ever comes from the body).

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';
import { publish } from '@sparx/api-core/pubsub';
import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';
import { formService } from '@sparx/builder';
import { publishPlatformEvent } from '@sparx/crm';

const Query = z.object({
  tenant: z.string().min(1).max(63),
  property: z.string().min(1).max(63).optional(),
});

const Body = z.object({
  formNodeId: z.string().min(1).max(255),
  // '' / null / omitted ⇒ the home page.
  pageSlug: z.string().max(255).nullish(),
  // Field name → value. Capped hard: contact forms are a handful of short fields.
  values: z
    .record(z.string().max(63), z.string().max(5000))
    .refine((v) => Object.keys(v).length <= 30, 'Too many fields.')
    .default({}),
  // Hidden anti-bot field — empty for a human.
  honeypot: z.string().max(255).optional(),
});

function clientIp(request: FastifyRequest): string | undefined {
  return request.ip || undefined;
}

function userAgent(request: FastifyRequest): string | undefined {
  const ua = request.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 1000) : undefined;
}

function referrer(request: FastifyRequest): string | undefined {
  const r = request.headers.referer ?? request.headers.referrer;
  return typeof r === 'string' ? r.slice(0, 1000) : undefined;
}

/** Trimmed non-empty string, or null. */
function pick(values: Record<string, string>, key: string): string | null {
  const v = values[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

const publicFormsRoutes: FastifyPluginAsync = (app) => {
  app.post(
    '/v1/public/forms/submit',
    {
      // A contact form is low-frequency. This is a coarse backstop; meaningful
      // per-visitor limiting needs the storefront proxy to forward X-Forwarded-For
      // (docs/115 §security) — otherwise every visitor shares the site pod's IP.
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request) => {
      const q = Query.parse(request.query);
      const body = Body.parse(request.body);

      // Tenant: slug → id against the non-RLS dispatch row (never a client id).
      const tenant = await prisma.tenant.findUnique({
        where: { slug: q.tenant },
        select: { id: true, email: true },
      });
      if (!tenant) throw notFound('Tenant', q.tenant);
      const tenantId = tenant.id;

      // Site: the named property, or the tenant's primary. Resolved under RLS.
      const property = await withTenant({ tenantId }, (tx) =>
        q.property
          ? tx.property.findFirst({
              where: { tenantId, slug: q.property },
              select: { id: true, name: true },
            })
          : tx.property.findFirst({
              where: { tenantId, isPrimary: true },
              select: { id: true, name: true },
            })
      );
      if (!property) throw notFound('Site', q.property ?? 'primary');
      const ctx = { tenantId, propertyId: property.id };
      const pageSlug = body.pageSlug && body.pageSlug !== '' ? body.pageSlug : null;

      // Resolve the form from the PUBLISHED tree — reject if there is no live form
      // at this address (an attacker can't spam a tenant with no such form).
      const form = await formService.resolveContactForm(ctx, {
        pageSlug,
        formNodeId: body.formNodeId,
      });
      if (!form) throw notFound('Form', body.formNodeId);

      const isBot = !!(body.honeypot && body.honeypot.trim() !== '');
      const values = body.values;
      const email = pick(values, 'email');
      const name = pick(values, 'name');
      const phone = pick(values, 'phone');
      const message = pick(values, 'message');

      // Always store the row (spam included, flagged — never silently lost).
      const submission = await formService.createFormSubmission(ctx, {
        formNodeId: body.formNodeId,
        pageSlug,
        formName: form.formName,
        name,
        email,
        phone,
        message,
        fields: values,
        context: {
          ip: clientIp(request) ?? null,
          userAgent: userAgent(request) ?? null,
          referrer: referrer(request) ?? null,
          submittedAt: new Date().toISOString(),
        },
        status: isBot ? 'spam' : 'new',
      });

      // A bot learns nothing: success, no fan-out.
      if (isBot) return ok({ received: true });

      const cfg = form.config;
      // Recipients come ONLY from the server-side config; fall back to the tenant's
      // account email so "email me" works even before the owner sets a recipient.
      const recipients = form.recipients.length
        ? form.recipients
        : tenant.email
          ? [tenant.email]
          : [];
      const siteName = property.name;
      const formName = form.formName ?? 'Contact form';

      const sends: Promise<void>[] = [];
      if (cfg.notify) {
        for (const to of recipients) {
          sends.push(
            publish(request.log, 'email.send', tenantId, null, {
              template: 'form-submission-notification',
              to,
              // Reply goes straight to the person who wrote in.
              ...(email ? { replyTo: email } : {}),
              props: {
                siteName,
                formName,
                name,
                email,
                phone,
                message,
                pageSlug,
                submittedAt: new Date().toISOString(),
              },
            })
          );
        }
      }
      if (cfg.autoresponder && email?.includes('@')) {
        sends.push(
          publish(request.log, 'email.send', tenantId, null, {
            template: 'form-submission-confirmation',
            to: email,
            props: {
              siteName,
              name,
              subject: cfg.autoresponderSubject,
              message: cfg.autoresponderMessage,
            },
          })
        );
      }
      await Promise.all(sends);

      // Drive the CRM lead consumer + analytics + automation fan-in. The consumer
      // re-checks the `crm` gate, so a stale `addToCrm` on a since-disabled tenant
      // is a safe no-op. Dual-published (mirrors module.activated): `publish` →
      // Pub/Sub (webhooks + automation), `publishPlatformEvent` → the in-process
      // bus the CRM consumer runs on in this api-rest process. The submission id is
      // the event id, so the consumer's dedupe processes each submission once.
      const formSubmittedPayload = {
        submissionId: submission.id,
        propertyId: property.id,
        formNodeId: body.formNodeId,
        name,
        email,
        phone,
        message,
        addToCrm: cfg.addToCrm,
      };
      await publish(request.log, 'form.submitted', tenantId, null, formSubmittedPayload);
      await publishPlatformEvent({
        id: submission.id,
        topic: 'form.submitted',
        tenantId,
        occurredAt: new Date(),
        payload: formSubmittedPayload,
      });

      return ok({ received: true });
    }
  );

  return Promise.resolve();
};

export default publicFormsRoutes;
