// Tenant email send-by-key (docs/93 §2).
//
// `sendTenantEmailByKey` is the single primitive every DIRECT transactional sender
// uses to emit a tenant→customer email (order confirmation, shipping, appointments,
// …). It renders the tenant's Builder-authored tree for the key — resolving the
// per-site override → tenant default → code-shipped fallback (getPublishedByKey) —
// against THIS recipient's live data, then publishes a pre-rendered `kind:'raw'`
// `email.send` the worker delivers as-is. One authoring system: the merchant edits
// the tree in /builder/email; callers reference it only by `key`.
//
// The render CORE (`renderBuilderEmailDoc`) is shared with the scheduled-send
// dispatch tick (email-dispatch.ts) so the automation send-by-key path and the
// direct path render identically — the only difference is the trigger (a queued
// ScheduledSend vs. an inline call) and, for automations, the trigger-time
// `entitySnapshot` fallback.

import type { FastifyBaseLogger } from 'fastify';
import { withTenant } from '@sparx/db';
import { publish } from '@sparx/api-core/pubsub';
import type { RawEmailSendPayload } from '@sparx/events';
import { renderSilicaEmail } from '@sparx/email/silica';
import { emailService } from '@sparx/builder';
import { brandService } from '@sparx/email-platform';
import {
  interpolateEmailTokens,
  resolvePath,
  type PublishedEmailDto,
} from '@sparx/builder-schemas';

import {
  applyEntitySnapshot,
  resolveSilicaEmailData,
  type EmailRecipientRef,
} from './email-data.js';
import { unsubscribeUrl } from './email-unsubscribe.js';
import { resolvePrimaryPropertyId } from './property.js';

const FALLBACK_FROM = 'sparx <noreply@sparx.email>';

/** `From` header from the site's EmailSettings, falling back to the platform
 *  default. Shared with the dispatch tick. */
export function buildFrom(fromName: string | null, fromAddress: string | null): string {
  if (!fromAddress) return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

/** The four fields that decide WHO a message is from: the visible sender, the
 *  address a reply goes to, and the postal address the legal footer discloses. */
export interface SenderIdentity {
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  physicalAddress: string | null;
}

const NO_IDENTITY: SenderIdentity = {
  fromName: null,
  fromAddress: null,
  replyTo: null,
  physicalAddress: null,
};

/**
 * The sender identity for ONE SITE (docs/131 §3.4).
 *
 * Every send path resolves through here so there is a single place where "which
 * business is this from?" is answered. `propertyId` may be null on legacy call
 * paths that never carried a site; those resolve to the tenant's primary, which
 * is the same site the old per-tenant row described.
 *
 * A site with no row yields all-nulls rather than borrowing a sibling's: the
 * caller then sends as the platform, which is visibly generic. Inheriting a
 * sibling's identity would instead produce a message that looks completely
 * legitimate and names the wrong company.
 */
export async function loadSenderIdentity(
  tenantId: string,
  propertyId: string | null
): Promise<SenderIdentity> {
  const siteId = propertyId ?? (await resolvePrimaryPropertyId(tenantId));
  const row = await withTenant({ tenantId }, (tx) =>
    tx.emailSettings.findUnique({
      where: { tenantId_propertyId: { tenantId, propertyId: siteId } },
      select: {
        fromName: true,
        fromAddress: true,
        replyTo: true,
        physicalAddress: true,
      },
    })
  );
  return row ?? NO_IDENTITY;
}

/** A pre-rendered, branded email body the worker delivers as-is. */
export interface RenderedRawSend {
  kind: 'raw';
  subject: string;
  html: string;
  text: string;
  propertyId?: string;
  headers?: Record<string, string>;
}

export interface RenderBuilderEmailArgs {
  /** The resolved published email (per-site override → tenant default → fallback). */
  doc: PublishedEmailDto;
  to: string;
  /** The site this send is on behalf of — drives per-site brand + analytics. */
  propertyId?: string | null;
  /** Entity ids the document resolves its bindings + `{{token}}`s against. */
  ref: EmailRecipientRef;
  /** Whether this is a marketing send — supplies the one-click unsubscribe URL +
   *  List-Unsubscribe header (the caller decides; transactional sends pass false). */
  marketing: boolean;
  /** The tenant's CAN-SPAM postal address for the `physical_address` node. */
  physicalAddress?: string | null;
  /** Automation trigger-time scalar snapshot (a since-deleted entity's last-known
   *  values). Omitted by direct sends, which always have a live entity. */
  snapshot?: Record<string, unknown> | null;
  /** Override the email's own subject/preheader (the automation broadcast path). */
  subjectOverride?: string;
  preheaderOverride?: string | null;
}

/** Resolve this recipient's data for `doc`, interpolate the subject/preheader merge
 *  tokens, and render the tree to a branded raw payload. The shared render core for
 *  BOTH the direct primitive and the dispatch tick (docs/93 §2). */
export async function renderBuilderEmailDoc(
  ctx: { tenantId: string },
  args: RenderBuilderEmailArgs
): Promise<RenderedRawSend> {
  const subject = args.subjectOverride ?? args.doc.subject;
  const preheader =
    args.preheaderOverride !== undefined ? args.preheaderOverride : (args.doc.preheader ?? null);

  // Resolve only the sources the body (+ subject/preheader) reference, then overlay
  // the trigger-time snapshot as a scalar fallback (no-op for direct sends). The
  // propertyId scopes `{{tenant.name}}` to the active site (docs/49 Phase 7) — the
  // SAME site whose brand this render uses below — so body copy and chrome agree.
  const silicaDoc = args.doc.silicaDoc;
  const emailData = applyEntitySnapshot(
    await resolveSilicaEmailData(
      ctx,
      silicaDoc,
      args.ref,
      [subject, preheader ?? ''],
      args.propertyId
    ),
    args.snapshot ?? null
  );
  const resolveToken = (path: string): unknown => resolvePath({ root: emailData }, path);
  const finalSubject = interpolateEmailTokens(subject, resolveToken);
  const finalPreheader =
    preheader != null ? interpolateEmailTokens(preheader, resolveToken) : undefined;

  const unsubUrl = args.marketing ? unsubscribeUrl(ctx.tenantId, args.to) : undefined;
  const brand = (await brandService.resolveEmailBrand(ctx, args.propertyId ?? null)) ?? undefined;

  // ONE engine (docs/120 slice 7): every email — including one authored on the retired
  // sparx builder, which `emailService` converts on read — renders through silica.
  const rendered = renderSilicaEmail(
    {
      doc: silicaDoc,
      subject: finalSubject,
      preheader: finalPreheader ?? null,
      to: args.to,
      data: emailData,
      marketing: args.marketing,
      compliance: {
        ...(args.physicalAddress ? { physicalAddress: args.physicalAddress } : {}),
        ...(unsubUrl ? { unsubscribeUrl: unsubUrl } : {}),
      },
    },
    { brand }
  );

  return {
    kind: 'raw',
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    ...(args.propertyId ? { propertyId: args.propertyId } : {}),
    ...(unsubUrl
      ? {
          headers: {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }
      : {}),
  };
}

export interface SendTenantEmailArgs {
  /** The keyed default to send (e.g. `order-confirmation`). */
  key: string;
  to: string;
  /** The site this send is on behalf of (docs/49 Phase 7b). */
  propertyId?: string | null;
  /** Entity ids the tree resolves against — the `email` field is filled from `to`. */
  ref?: Omit<EmailRecipientRef, 'email'>;
  /** Declared intent for the compliance gate; defaults to transactional. A
   *  transactional send is never withheld for a missing unsubscribe node. */
  emailType?: 'transactional' | 'marketing';
  /** Extra Mailgun user variables (e.g. an automation/campaign id) for webhook
   *  attribution. tenant_id + property_id are stamped by the worker. */
  variables?: Record<string, string>;
}

export interface SendTenantEmailResult {
  sent: boolean;
  reason?: 'no-template' | 'compliance';
}

/**
 * Render + publish a tenant→customer email by key (docs/93 §2). Resolves the
 * published tree (per-site override → tenant default → code-shipped fallback),
 * enforces the marketing compliance gate, renders this recipient's data inline, and
 * publishes a pre-rendered `email.send`. Returns `{ sent:false }` (never throws on a
 * missing template or a refused marketing send) so a transactional email failure
 * never breaks the action that triggered it — callers log the reason.
 */
export async function sendTenantEmailByKey(
  logger: FastifyBaseLogger,
  tenantId: string,
  args: SendTenantEmailArgs
): Promise<SendTenantEmailResult> {
  const ctx = { tenantId };
  const doc = await emailService.getPublishedByKey(ctx, args.key, args.propertyId ?? null);
  if (!doc) {
    logger.warn(
      { tenantId, key: args.key },
      'tenant-email: no published tree or default — skipped'
    );
    return { sent: false, reason: 'no-template' };
  }

  const emailType = args.emailType ?? 'transactional';
  const marketing = emailType === 'marketing';
  // No unsubscribe-node gate any more (docs/120 slice 7). It existed because the
  // sparx builder made the opt-out an OPTIONAL node an author had to place; silica
  // COMPOSES the legal footer (unsubscribe + postal address) into every marketing
  // send, so it is satisfied structurally and can't be authored away.

  // The site this send is on behalf of decides the sender identity, exactly as it
  // already decides the template and the brand two lines above.
  const settings = await loadSenderIdentity(tenantId, args.propertyId ?? null);
  const ref: EmailRecipientRef = { email: args.to, ...args.ref };
  const raw = await renderBuilderEmailDoc(ctx, {
    doc,
    to: args.to,
    propertyId: args.propertyId ?? null,
    ref,
    marketing,
    physicalAddress: settings.physicalAddress,
  });

  await publish(logger, 'email.send', tenantId, null, {
    ...raw,
    // The recipient MUST ride in the event: email-worker's RawSendSchema requires
    // `to`, and a payload without it fails validation and is silently acked/dropped
    // (no send, no error). `renderBuilderEmailDoc` returns only the rendered body,
    // so `to` is added here — the same field the chat + automation-dispatch
    // publishers already carry. `satisfies RawEmailSendPayload` makes a future
    // omission a COMPILE error rather than a silent prod regression.
    to: args.to,
    from: buildFrom(settings.fromName, settings.fromAddress),
    ...(settings.replyTo ? { replyTo: settings.replyTo } : {}),
    ...(args.variables ? { variables: args.variables } : {}),
  } satisfies RawEmailSendPayload);
  return { sent: true };
}
