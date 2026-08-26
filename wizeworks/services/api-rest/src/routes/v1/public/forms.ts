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
import { prisma, withTenant } from '@wizeworks/db';
import { publish } from '@wizeworks/api-core/pubsub';
import { ok } from '@wizeworks/api-core/envelope';
import { env } from '../../../env.js';
import { notFound } from '@wizeworks/api-core/errors';
import { formService } from '@wizeworks/builder';
import {
  type FormAttachment,
  MAX_FORM_ATTACHMENTS,
  scoreAnswers,
} from '@wizeworks/builder-schemas';
import { getStorage, formUploadAttachedKey } from '../../../lib/storage.js';
import { verifyFormUploadToken } from '../../../lib/form-upload-token.js';
import {
  GATED_DELIVERY_TTL_SECONDS,
  mintGatedDeliveryToken,
} from '../../../lib/gated-delivery-token.js';
import { captureFunnelStage, findFormCaptureTarget } from '../../../lib/funnel-entry.js';

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

// What a half-finished form sends on each Next. No attachments and no honeypot
// result other than "stop": a partial capture is not a delivery, so there is
// nothing for a bot to gain and nothing to promote out of staging.
const PartialBody = z.object({
  formNodeId: z.string().min(1).max(255),
  pageSlug: z.string().max(255).nullish(),
  values: z
    .record(z.string().max(63), z.string().max(5000))
    .refine((v) => Object.keys(v).length <= 30, 'Too many fields.')
    .default({}),
  /** Which step they just completed, 1-based. */
  step: z.number().int().positive().max(50),
  honeypot: z.string().max(255).optional(),
});

const publicFormsRoutes: FastifyPluginAsync = (app) => {
  // ── A form somebody started and did not finish (docs/151 §7, docs/152 C2) ──
  //
  // Fires as the visitor moves forward through a multi-step form, so it is far
  // chattier than submit and rate-limited accordingly. It writes ONE row per
  // unfinished form and advances it in place.
  //
  // WHAT IT DELIBERATELY DOES NOT DO: no notification email, no autoresponder,
  // no CRM contact. Somebody typed an address and pressed Next; that is a real
  // disclosure to this site and is why the row may exist, but it is NOT consent
  // to be marketed to, and a feature that quietly treats it as one is how lead
  // capture becomes a complaint. It DOES enter its funnel, because that is the
  // tenant measuring their own site rather than contacting a stranger.
  app.post(
    '/v1/public/forms/partial',
    {
      // Higher than submit because it is per-step, still bounded. Same caveat as
      // submit: without X-Forwarded-For from the storefront proxy every visitor
      // shares the site pod's IP, so this is a coarse backstop.
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request) => {
      const q = Query.parse(request.query);
      const body = PartialBody.parse(request.body);

      // A bot gets a clean success and no row. Nothing was going to be delivered
      // anyway, so there is no reason to store what it typed.
      if (body.honeypot && body.honeypot.trim() !== '') return ok({ received: true });

      const email = pick(body.values, 'email');
      // No address means no lead — just a row about a stranger, which is not
      // something worth keeping. The client should not have called.
      if (!email) return ok({ received: true, recorded: false });

      const tenant = await prisma.tenant.findUnique({
        where: { slug: q.tenant },
        select: { id: true },
      });
      if (!tenant) throw notFound('Tenant', q.tenant);
      const tenantId = tenant.id;

      const property = await withTenant({ tenantId }, (tx) =>
        q.property
          ? tx.property.findFirst({
              where: { tenantId, slug: q.property },
              select: { id: true },
            })
          : tx.property.findFirst({
              where: { tenantId, isPrimary: true },
              select: { id: true },
            })
      );
      if (!property) throw notFound('Site', q.property ?? 'primary');
      const ctx = { tenantId, propertyId: property.id };
      const pageSlug = body.pageSlug && body.pageSlug !== '' ? body.pageSlug : null;

      // The same anti-forgery check submit does, and for the same reason: without
      // it this endpoint writes a row for any tenant a script names.
      const form = await formService.resolveContactForm(ctx, {
        pageSlug,
        formNodeId: body.formNodeId,
      });
      if (!form) throw notFound('Form', body.formNodeId);

      const captured = await formService.capturePartialSubmission(ctx, {
        formNodeId: body.formNodeId,
        pageSlug,
        formName: form.formName,
        name: pick(body.values, 'name'),
        email,
        phone: pick(body.values, 'phone'),
        fields: body.values,
        context: {
          ip: clientIp(request) ?? null,
          userAgent: userAgent(request) ?? null,
          referrer: referrer(request) ?? null,
          startedAt: new Date().toISOString(),
        },
        step: body.step,
      });

      // Only on the FIRST step we hear about. Re-announcing on every Next would
      // count one person once per step and make the campaign's entry number a
      // measure of form length rather than of people.
      if (captured.created) {
        const target = await findFormCaptureTarget(tenantId, property.id, body.formNodeId);
        if (target) {
          await captureFunnelStage({
            log: request.log,
            tenantId,
            funnelId: target.funnelId,
            stageKey: target.stageKey,
            subjectEmail: email,
            refs: { submissionId: captured.id },
            ip: request.ip,
            userAgent: userAgent(request) ?? '',
            now: new Date(),
          });
        }
      }

      return ok({ received: true, recorded: true });
    }
  );

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

      // The capture stitch (docs/151 §4, docs/152 B3). If a live funnel names this
      // form as where it starts, this submission IS its capture rung: the moment
      // an anonymous visitor became a person. Record it with the entry facts
      // derived from their own traffic today.
      //
      // Needs an address, because everything below a funnel's capture line is
      // keyed on a known subject and a form with no email field produces no
      // subject to key on.
      //
      // AFTER the submission is stored and the event published, and self-guarded
      // inside `captureFunnelStage`: the inbox row and the automation fan-out are
      // the tenant's actual business, and a reporting nicety must never be able
      // to cost them a lead.
      if (email) {
        const target = await findFormCaptureTarget(tenantId, property.id, body.formNodeId);
        if (target) {
          await captureFunnelStage({
            log: request.log,
            tenantId,
            funnelId: target.funnelId,
            stageKey: target.stageKey,
            subjectEmail: email,
            // A pointer for the funnel's detail view to follow back to what the
            // person actually wrote. Not a foreign key — a submission that is
            // later deleted renders as "no longer available".
            refs: { submissionId: submission.id },
            ip: request.ip,
            userAgent: userAgent(request) ?? '',
            now: new Date(),
          });
        }
      }

      // ── The file they asked for (docs/151 §7, docs/152 C4) ─────────────────
      //
      // Sent rather than linked from the thank-you, and that is the point: the
      // exchange is the address, so the asset has to be behind the address. A
      // download button on the success page would hand it to anyone who typed
      // anything, and the tenant would be hosting a public file that also
      // happens to collect email.
      //
      // The link is signed and expiring, and carries the storage KEY inside its
      // own signature, so nothing in the URL a visitor can edit names an object.
      // The asset stays in the private bucket; `/v1/public/deliver` streams it.
      //
      // Needs an address for the obvious reason, and skipped for a bot — a
      // honeypot submission has already returned above.
      //
      // The base URL is REQUIRED and not defaulted. An email is read somewhere
      // else entirely, so a relative link in one is simply broken — and sending
      // a broken download is worse than sending nothing, because the visitor
      // has already paid with their address and now believes they were given
      // something. Unset (dev, or a misconfigured deploy) logs loudly instead.
      const deliveryBase = env.MEDIA_PUBLIC_URL;
      if (form.config.delivery && email && !deliveryBase) {
        request.log.error(
          { formNodeId: body.formNodeId },
          'gated delivery: MEDIA_PUBLIC_URL is unset, so the download link would be relative and unusable in an email — not sending'
        );
      }
      if (form.config.delivery && email && deliveryBase) {
        const delivery = form.config.delivery;
        const token = mintGatedDeliveryToken({
          tid: tenantId,
          key: delivery.key,
          name: delivery.filename,
          mime: delivery.mimeType,
          sub: email.toLowerCase(),
          exp: Math.floor(Date.now() / 1000) + GATED_DELIVERY_TTL_SECONDS,
        });
        // `publish` never throws — a Pub/Sub hiccup is logged, not surfaced. The
        // right trade here: the submission is already stored, so a mail glitch
        // must not turn into a red error for somebody who did everything right.
        await publish(request.log, 'email.send', tenantId, null, {
          template: 'gated-delivery',
          to: email,
          props: {
            siteName: property.name,
            name,
            subject: delivery.subject,
            message: delivery.message,
            filename: delivery.filename,
            url: `${deliveryBase}/v1/public/deliver/${token}`,
            expiresInDays: Math.round(GATED_DELIVERY_TTL_SECONDS / 86_400),
          },
        });
      }

      // What the visitor is TOLD, for a quiz or calculator (docs/152 C3).
      //
      // Computed here from the server-only weights and returned, rather than the
      // browser working it out: the same arithmetic decides their CRM score, and
      // two implementations of one calculation is how a visitor comes to be shown
      // one result while the sales team sees another. The CRM half runs in the
      // capture worker, off the same stored answers.
      const quiz = form.config.scoring ? scoreAnswers(form.config.scoring, values) : null;

      return ok({
        received: true,
        ...(quiz?.outcome || quiz?.amountLabel
          ? {
              result: {
                headline: quiz.outcome?.headline ?? null,
                body: quiz.outcome?.body ?? null,
                amountLabel: quiz.amountLabel,
              },
            }
          : {}),
      });
    }
  );

  return Promise.resolve();
};

export default publicFormsRoutes;
