// builderEmailService — render + test-send for a Builder email (docs/52, docs/120).
// It takes a BuilderEmail's silica `EmailDocument` (+ subject/preheader) and renders
// it through `renderSilicaEmail`, resolving the tenant brand the same way every other
// email render does.
//
// ONE engine (docs/120 slice 7). The legacy `renderEmailTree` is deleted; an email
// authored on the retired sparx builder is converted to a silica document by
// `emailService` on read, so nothing downstream of here has two paths to reason about.
//
// The document is INJECTED by the caller (api-rest loads it from @sparx/builder's
// emailService) so this package stays free of a @sparx/builder dependency — the same
// injection pattern templateService uses for section data (docs/31 §8).

import {
  renderSilicaEmail,
  buildEmailFrame,
  emailBrandColorDefaults,
  emailBrandDarkColorDefaults,
  darkModeRules,
  lintEmailRender,
} from '@sparx/email/silica';
import type {
  EmailCheck,
  EmailColorDefaults,
  EmailFrame,
  EmailLinkTracking,
  FooterLink,
} from '@sparx/email/silica';
import { defaultBrand } from '@sparx/email';
import type { DataSources, SilicaEmailDocument } from '@sparx/builder-schemas';

import { TestSendInput } from '../schemas/templates';
import type { ServiceContext } from '../errors';
import { resolveEmailBrand } from './brand-service';
import { get as getSettings } from './settings-service';
import { buildTenantFrom } from './platform-sender';

/** Resolve a silica email document's bound DataSources (docs/52 §7, docs/120).
 *  Injected by the caller (api-rest's `silicaEmailDataResolver`, which has
 *  @sparx/commerce) so this package stays commerce-free. `recipient` is absent for the
 *  render-once path (preview / non-personalized broadcast), where per-recipient sources
 *  resolve empty. `propertyId` scopes per-site sources (today: `{{tenant.name}}`) to the
 *  active site (docs/49 Phase 7) — passed by callers that learn the site at call time
 *  (the broadcast render-once path passes `broadcast.propertyId`); preview/test-send
 *  bind it into the resolver instead. Defined here (the render module) and reused by
 *  broadcast-service. */
export type ResolveSilicaEmailData = (
  doc: SilicaEmailDocument,
  recipient?: { email: string; customerId?: string | null },
  propertyId?: string | null
) => Promise<DataSources>;

// No-resolver default: static data only (bound nodes resolve empty). Used by callers
// without commerce wiring (e.g. the MCP tool).
export const noSilicaEmailDataResolver: ResolveSilicaEmailData = () => Promise.resolve({});

/** A Builder email reduced to what the render needs — the published (or draft) silica
 *  document plus its document fields. The caller loads this from @sparx/builder, where
 *  a pre-cutover row is converted from its sparx tree, so `silicaDoc` is always real. */
export interface BuilderEmailDoc {
  silicaDoc: SilicaEmailDocument;
  subject: string;
  preheader: string | null;
}

export interface RenderedPreview {
  subject: string;
  html: string;
  text: string;
  /** Pre-send checklist run over the composed document + projected HTML — surfaced in
   *  the studio's "Preview & Check" so a business owner catches a blank personalization
   *  tag, a dead link, or a Gmail-clipping body BEFORE they hit send. */
  checks: EmailCheck[];
  /** The dark-theme override rules (ungated — no `@media`), for the studio's Light/Dark
   *  preview toggle. Empty when the brand has no dark palette. The SEND wraps the same
   *  rules in `@media (prefers-color-scheme: dark)`; the preview applies them directly
   *  because an iframe can't be forced to report a dark OS preference. */
  darkCss: string;
}

/** Render a Builder email to inlined HTML + plain text for the editor preview.
 *  Resolves the brand so the preview matches what ships. `propertyId` scopes the
 *  brand to the active site (docs/49 Phase 7): when the editor is authoring a
 *  per-site email, the preview paints THAT site's name / colors / fonts / logo —
 *  the same `resolveEmailBrand(ctx, propertyId)` merge the real send uses — so the
 *  preview can't diverge from the canvas. Absent → the tenant brand (single-site).
 *  The injected `resolveData` resolves the document's bound sources so the preview
 *  shows real data; per-recipient sources resolve empty here (no recipient). */
export async function renderPreview(
  ctx: ServiceContext,
  doc: BuilderEmailDoc,
  resolveSilicaData: ResolveSilicaEmailData = noSilicaEmailDataResolver,
  propertyId?: string | null,
  footerLinks?: FooterLink[],
  tracking?: EmailLinkTracking
): Promise<RenderedPreview> {
  const [brand, data] = await Promise.all([
    resolveEmailBrand(ctx, propertyId),
    resolveSilicaData(doc.silicaDoc),
  ]);
  const rendered = renderSilicaEmail(
    {
      doc: doc.silicaDoc,
      to: 'preview@example.com',
      subject: doc.subject,
      preheader: doc.preheader,
      data,
      // The account/contact/legal links the real send composes into the footer — pass
      // them here too so the preview footer isn't just the business name (docs/impl
      // transactional-email §7). Resolved per-site by the caller.
      footerLinks,
      // Tag on-site links so the preview shows the SAME tracked URLs the send ships
      // (docs/impl transactional-email Slice 10). Absent → untagged (no site context).
      ...(tracking ? { tracking } : {}),
    },
    { brand: brand ?? undefined }
  );
  // Checks read the AUTHORED subject/preheader (raw `{{tokens}}` intact) so a misspelled
  // tag is caught by path, and the FINAL projected HTML so the size check matches what
  // actually ships (frame included). The tracking context adds the plain-language
  // "your clicks are counted" line, scoped to this email's campaign.
  const checks = lintEmailRender({
    doc: doc.silicaDoc,
    html: rendered.html,
    subject: doc.subject,
    preheader: doc.preheader,
    ...(tracking ? { tracking: { hosts: tracking.hosts, campaign: tracking.campaign } } : {}),
  });
  // The dark override rules for the Light/Dark preview toggle, from the SAME resolved
  // brand the render used (merged over defaults so a partial/absent brand still resolves
  // its dark neutrals). Empty when the brand carries no dark palette.
  const effectiveBrand = { ...defaultBrand, ...(brand ?? {}) };
  const darkColors = emailBrandDarkColorDefaults(effectiveBrand);
  const darkCss = darkColors
    ? darkModeRules(emailBrandColorDefaults(effectiveBrand), darkColors)
    : '';
  return { subject: rendered.subject, html: rendered.html, text: rendered.text, checks, darkCss };
}

/** Everything the email studio's canvas needs to render the email exactly as it
 *  ships — resolved from the active site's brand, ONCE, server-side. */
export interface EmailChrome {
  /** The brand bar + wordmark (header) and tiered legal footer (footer) rendered as
   *  inert chrome around the authored body (silicaui 0.34 `<EmailBuilder frame>`). */
  frame: EmailFrame;
  /** The role→hex color map the send paints with. The studio builds its canvas theme
   *  from THIS (not the site page theme) so silica's live repaint colors every block
   *  in exactly the brand + fixed-semantic colors the inbox gets. */
  colors: EmailColorDefaults;
}

/** The canvas chrome + color map for the active site (docs/impl transactional-email
 *  §7). Both derive from the SAME `resolveEmailBrand(ctx, propertyId)` the preview +
 *  send use, so the edit canvas can't diverge from what ships. `marketing:false` (no
 *  per-recipient unsubscribe line on the canvas) + no per-send compliance — the canvas
 *  is a design surface, not one recipient's copy. The caller resolves `footerLinks`
 *  (its content package has the legal-placement source); absent → the footer's utility
 *  row is just the account link. */
export async function buildChrome(
  ctx: ServiceContext,
  propertyId?: string | null,
  footerLinks?: FooterLink[]
): Promise<EmailChrome> {
  const brand = (await resolveEmailBrand(ctx, propertyId)) ?? defaultBrand;
  return {
    frame: buildEmailFrame({ brand, marketing: false, footerLinks }),
    colors: emailBrandColorDefaults(brand),
  };
}

/** The deliverable a staff test-send produces: a fully-rendered email ready to
 *  hand to the email-worker as a `raw` `email.send` event. */
export interface PreparedTestSend {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

/** Render a Builder email's DRAFT for a one-off staff test-send and return the
 *  deliverable — but do NOT deliver it here. The caller publishes an `email.send`
 *  event so the email-worker delivers it through the configured provider; the
 *  worker is the single email egress path, and direct sends are an OTP-only escape
 *  hatch (CLAUDE.md). The recipient's own data is resolved (the test address as the
 *  recipient) so a personalized email smoke-tests the per-recipient render too.
 *  `propertyId` scopes the brand to the active site (docs/49 Phase 7) so the test
 *  copy is branded EXACTLY as a real send for that site — matching the preview +
 *  canvas. Absent → the tenant brand (single-site). */
export async function prepareTestSend(
  ctx: ServiceContext,
  doc: BuilderEmailDoc,
  rawInput: unknown,
  resolveSilicaData: ResolveSilicaEmailData = noSilicaEmailDataResolver,
  propertyId?: string | null,
  footerLinks?: FooterLink[],
  tracking?: EmailLinkTracking
): Promise<PreparedTestSend> {
  const { to } = TestSendInput.parse(rawInput);
  const [brand, settings] = await Promise.all([
    resolveEmailBrand(ctx, propertyId),
    // The same site as the brand on the line above (docs/131 §3.4) — a test send
    // that renders one business's brand under another's From line would be a
    // smoke test of something that never happens.
    getSettings(ctx, propertyId ?? null),
  ]);

  // The test copy is rendered by the SAME projector + frame the real send uses, so
  // it's a true smoke test rather than an approximation — including the footer's
  // account/contact/legal links (the live automation path passes these; a test send
  // that dropped them would smoke-test a footer no recipient ever gets).
  const rendered = renderSilicaEmail(
    {
      doc: doc.silicaDoc,
      to,
      subject: doc.subject,
      preheader: doc.preheader,
      data: await resolveSilicaData(doc.silicaDoc, { email: to }),
      footerLinks,
      // A test send goes through the SAME tag pass as a real send, so a staff click
      // is attributed identically (docs/impl transactional-email Slice 10).
      ...(tracking ? { tracking } : {}),
    },
    { brand: brand ?? undefined }
  );

  return {
    from: await buildTenantFrom(ctx.tenantId, settings.fromName, settings.fromAddress),
    to,
    replyTo: settings.replyTo ?? undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  };
}
