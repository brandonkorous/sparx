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
import type { BuilderNode, DataSources } from '@sparx/builder-schemas';

import { TestSendInput } from '../schemas/templates';
import type { ServiceContext } from '../errors';
import { resolveEmailBrand } from './brand-service';
import { get as getSettings } from './settings-service';

const FALLBACK_FROM = 'Sparx <noreply@sparx.email>';

function buildFrom(fromName: string | null, fromAddress: string | null): string {
  if (!fromAddress) return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

/** Resolve a Builder email tree's bound DataSources (docs/52 §7). Injected by the
 *  caller (api-rest's emailDataResolver, which has @sparx/commerce) so this package
 *  stays commerce-free — the same pattern as ResolveSectionData. `recipient` is
 *  absent for the render-once path (preview / non-personalized broadcast), where
 *  per-recipient sources resolve empty. Defined here (the render module) and reused
 *  by broadcast-service. */
export type ResolveEmailData = (
  tree: BuilderNode,
  recipient?: { email: string; customerId?: string | null }
) => Promise<DataSources>;

// No-resolver default: static data only (bound nodes fall back to their props /
// render empty). Used by callers without commerce wiring (e.g. the MCP tool),
// mirroring makeStaticResolver for sections.
export const noEmailDataResolver: ResolveEmailData = () => Promise.resolve({});

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
 *  Resolves the tenant brand so the preview matches what ships. The injected
 *  `resolveData` resolves the tree's bound sources (products/promotion/posts) so
 *  the preview shows real data; per-recipient sources resolve empty here (no
 *  recipient), exactly like the section preview. */
export async function renderPreview(
  ctx: ServiceContext,
  doc: BuilderEmailDoc,
  resolveData: ResolveEmailData = noEmailDataResolver
): Promise<RenderedPreview> {
  const [brand, data] = await Promise.all([resolveEmailBrand(ctx), resolveData(doc.tree)]);
  const rendered = await renderEmailTree(
    {
      tree: doc.tree,
      subject: doc.subject,
      preheader: doc.preheader ?? undefined,
      to: 'preview@example.com',
      data,
    },
    { brand: brand ?? undefined }
  );
  return { subject: rendered.subject, html: rendered.html, text: rendered.text };
}

/** Render + immediately deliver a Builder email to one address — the staff smoke
 *  test (the synchronous escape hatch, like templateService.testSend). Stamps
 *  tenant_id so any resulting webhook events attribute correctly. The recipient's
 *  own data is resolved (the test address as the recipient), so a personalized
 *  email smoke-tests the per-recipient render too. */
export async function testSend(
  ctx: ServiceContext,
  doc: BuilderEmailDoc,
  rawInput: unknown,
  resolveData: ResolveEmailData = noEmailDataResolver
): Promise<DeliveryResult> {
  const { to } = TestSendInput.parse(rawInput);
  const [brand, settings, data] = await Promise.all([
    resolveEmailBrand(ctx),
    getSettings(ctx),
    resolveData(doc.tree, { email: to }),
  ]);
  const rendered = await renderEmailTree(
    { tree: doc.tree, subject: doc.subject, preheader: doc.preheader ?? undefined, to, data },
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
