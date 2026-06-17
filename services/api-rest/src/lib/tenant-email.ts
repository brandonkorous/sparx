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
import { renderEmailTree } from '@sparx/email';
import { emailService } from '@sparx/builder';
import { brandService } from '@sparx/email-platform';
import {
  interpolateEmailTokens,
  resolvePath,
  type BuilderNode,
  type PublishedEmailDto,
} from '@sparx/builder-schemas';

import { applyEntitySnapshot, resolveEmailData, type EmailRecipientRef } from './email-data.js';
import { unsubscribeUrl } from './email-unsubscribe.js';

const FALLBACK_FROM = 'sparx <noreply@sparx.email>';

/** `From` header from the tenant's EmailSettings, falling back to the platform
 *  default. Shared with the dispatch tick. */
export function buildFrom(fromName: string | null, fromAddress: string | null): string {
  if (!fromAddress) return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

/** Does the tree contain a node of `type` (depth-first)? Detects the
 *  `unsubscribe_link` node that a marketing tree must carry (docs/91 §8). */
export function treeHasNodeType(node: BuilderNode, type: string): boolean {
  if (node.type === type) return true;
  for (const child of node.children ?? []) if (treeHasNodeType(child, type)) return true;
  return false;
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
  /** Entity ids the tree resolves its bindings + `{{token}}`s against. */
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

  // Resolve only the sources the tree (+ subject/preheader) reference, then overlay
  // the trigger-time snapshot as a scalar fallback (no-op for direct sends). The
  // propertyId scopes `{{tenant.name}}` to the active site (docs/49 Phase 7) — the
  // SAME site whose brand this render uses below — so body copy and chrome agree.
  const emailData = applyEntitySnapshot(
    await resolveEmailData(
      ctx,
      args.doc.tree,
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
  const rendered = await renderEmailTree(
    {
      tree: args.doc.tree,
      subject: finalSubject,
      preheader: finalPreheader,
      to: args.to,
      data: emailData,
      compliance: {
        physicalAddress: args.physicalAddress ?? undefined,
        unsubscribeUrl: unsubUrl,
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
  if (marketing && !treeHasNodeType(doc.tree, 'unsubscribe_link')) {
    logger.warn(
      { tenantId, key: args.key },
      'tenant-email: marketing email missing unsubscribe node — refused (compliance)'
    );
    return { sent: false, reason: 'compliance' };
  }

  const settings = await withTenant(ctx, (tx) =>
    tx.emailSettings.findUnique({ where: { tenantId } })
  );
  const ref: EmailRecipientRef = { email: args.to, ...args.ref };
  const raw = await renderBuilderEmailDoc(ctx, {
    doc,
    to: args.to,
    propertyId: args.propertyId ?? null,
    ref,
    marketing,
    physicalAddress: settings?.physicalAddress ?? null,
  });

  await publish(logger, 'email.send', tenantId, null, {
    ...raw,
    from: buildFrom(settings?.fromName ?? null, settings?.fromAddress ?? null),
    ...(settings?.replyTo ? { replyTo: settings.replyTo } : {}),
    ...(args.variables ? { variables: args.variables } : {}),
  });
  return { sent: true };
}
