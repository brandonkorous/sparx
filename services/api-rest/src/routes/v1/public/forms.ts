// Public site-forms submit endpoint (docs/115).
//
//   POST /v1/public/forms/submit ?tenant=<slug>[&property=<slug>]
//   A visitor submits a Builder ContactForm on a tenant site. The endpoint does
//   exactly three things: verify a live form exists at this address, ALWAYS store
//   the submission row (the durable inbox is the backbone), and publish
//   `form.submitted`. EVERY side effect — notify the owner, confirm to the
//   submitter, add to the CRM — is the platform automation engine's job now (the
//   seeded "Handle form submissions" automation, docs/115), which resolves the
//   form's server-side routing config + recipients and acts. This keeps the whole
//   form response one visible, editable flow instead of hardcoded endpoint logic.
//
// Anonymous (no auth; the `/v1/public/` prefix is exempt). NOT module-gated:
// storing + announcing must work regardless of modules; each automation action
// carries its own module gate (the CRM step no-ops until CRM is on).
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
import { type FormAttachment, MAX_FORM_ATTACHMENTS } from '@sparx/builder-schemas';
import { getStorage, formUploadAttachedKey } from '../../../lib/storage.js';
import { verifyFormUploadToken } from '../../../lib/form-upload-token.js';

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
  // Signed upload tokens for any files the visitor attached (docs/115 Part D) —
  // each proves an object was uploaded, via our token flow, to THIS tenant. The
  // key/name/mime are read from the SIGNED token, never trusted from the client.
  attachments: z.array(z.string().min(1).max(4096)).max(MAX_FORM_ATTACHMENTS).optional(),
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

/** Verify each attachment token and promote its object from the lifecycle-GC'd
 *  staging prefix to permanent storage. The token is the ONLY source of truth for
 *  the key/name/mime — the client never names an object. A token that fails to
 *  verify, targets another tenant, or whose staged object is missing is SKIPPED
 *  (logged), never fatal: a broken attachment must not lose the message. The moved
 *  key is keyed by the token's uid, so it's independent of the submission id. */
async function promoteAttachments(
  request: FastifyRequest,
  tenantId: string,
  tokens: readonly string[]
): Promise<FormAttachment[]> {
  if (tokens.length === 0) return [];
  const storage = getStorage();
  const out: FormAttachment[] = [];
  for (const token of tokens.slice(0, MAX_FORM_ATTACHMENTS)) {
    const v = verifyFormUploadToken(token);
    if (!v.ok || v.claims.tid !== tenantId) {
      request.log.warn(
        { reason: v.ok ? 'tenant-mismatch' : v.reason },
        'form submit: attachment token rejected'
      );
      continue;
    }
    const { uid, key: stagingKey, name, mime } = v.claims;
    // Confirm the staged object exists (the PUT wrote it) + read its true size.
    const staged = await storage.readObject(stagingKey).catch(() => null);
    if (!staged) {
      request.log.warn({ uid }, 'form submit: staged upload missing');
      continue;
    }
    const byteSize = staged.size ?? 0;
    staged.body.destroy();
    // Promote out of staging's lifecycle reach into permanent storage.
    const attachedKey = formUploadAttachedKey(tenantId, uid, name);
    await storage.copyObject(stagingKey, attachedKey);
    await storage.deleteObject(stagingKey);
    out.push({ key: attachedKey, filename: name, mimeType: mime, byteSize });
  }
  return out;
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

      // Promote attached files out of staging (non-bots only — a bot's staged
      // uploads are left to the staging-prefix lifecycle GC). Never fatal.
      const attachments = isBot
        ? []
        : await promoteAttachments(request, tenantId, body.attachments ?? []);

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
        attachments,
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

      // Announce the submission. `publish` tees onto the automation fan-in topic, so
      // the seeded "Handle form submissions" automation fires (notify → auto-reply →
      // add-to-CRM), resolving the form's server-side routing config + recipients
      // itself — the endpoint never touches routing. The payload is also what external
      // webhook subscribers receive; the automation re-reads the authoritative config,
      // so `addToCrm` here is only a convenience hint for those subscribers.
      await publish(request.log, 'form.submitted', tenantId, null, {
        submissionId: submission.id,
        propertyId: property.id,
        formNodeId: body.formNodeId,
        name,
        email,
        phone,
        message,
        addToCrm: form.config.addToCrm,
        attachmentCount: attachments.length,
      });

      return ok({ received: true });
    }
  );

  return Promise.resolve();
};

export default publicFormsRoutes;
