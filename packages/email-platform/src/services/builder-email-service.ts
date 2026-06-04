// builderEmailService — render + test-send for a Builder email (docs/52). The
// node-tree successor to the authored-section path in templateService: it takes a
// BuilderEmail's body tree (+ subject/preheader) and renders it through
// @sparx/email's renderEmailTree, resolving the tenant brand the same way every
// other email render does.
//
// The tree is INJECTED by the caller (api-rest loads it from @sparx/builder's
// emailService) so this package stays free of a @sparx/builder dependency — the
// same injection pattern templateService uses for section data (docs/31 §8).
//
// Phase 2 (docs/52 §9): preview + test-send. The broadcast send path (Phase 3)
// reuses renderEmailTree the same way.

import { renderEmailTree, sendEmail, type DeliveryResult } from '@sparx/email';
import type { BuilderNode } from '@sparx/builder-schemas';

import { TestSendInput } from '../schemas/templates';
import type { ServiceContext } from '../errors';
import { resolveEmailBrand } from './brand-service';
import { get as getSettings } from './settings-service';

const FALLBACK_FROM = 'Sparx <noreply@sparx.email>';

function buildFrom(fromName: string | null, fromAddress: string | null): string {
  if (!fromAddress) return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

/** A Builder email reduced to what the render needs — the published or draft body
 *  tree plus its document fields. The caller loads this from @sparx/builder. */
export interface BuilderEmailDoc {
  tree: BuilderNode;
  subject: string;
  preheader: string | null;
}

export interface RenderedPreview {
  subject: string;
  html: string;
  text: string;
}

/** Render a Builder email to inlined HTML + plain text for the editor preview.
 *  Resolves the tenant brand so the preview matches what ships. Static (Phase 1)
 *  trees render with no data; data-aware trees pass `data` in Phase 4. */
export async function renderPreview(
  ctx: ServiceContext,
  doc: BuilderEmailDoc
): Promise<RenderedPreview> {
  const brand = (await resolveEmailBrand(ctx)) ?? undefined;
  const rendered = await renderEmailTree(
    {
      tree: doc.tree,
      subject: doc.subject,
      preheader: doc.preheader ?? undefined,
      to: 'preview@example.com',
    },
    { brand }
  );
  return { subject: rendered.subject, html: rendered.html, text: rendered.text };
}

/** Render + immediately deliver a Builder email to one address — the staff smoke
 *  test (the synchronous escape hatch, like templateService.testSend). Stamps
 *  tenant_id so any resulting webhook events attribute correctly. */
export async function testSend(
  ctx: ServiceContext,
  doc: BuilderEmailDoc,
  rawInput: unknown
): Promise<DeliveryResult> {
  const { to } = TestSendInput.parse(rawInput);
  const [brand, settings] = await Promise.all([resolveEmailBrand(ctx), getSettings(ctx)]);
  const rendered = await renderEmailTree(
    { tree: doc.tree, subject: doc.subject, preheader: doc.preheader ?? undefined, to },
    { brand: brand ?? undefined }
  );
  return sendEmail({
    from: buildFrom(settings.fromName, settings.fromAddress),
    to,
    replyTo: settings.replyTo ?? undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    variables: { tenant_id: ctx.tenantId },
  });
}
