// The silica-native email render primitive (docs/120 Stage 3, D2) — the send-time
// counterpart to `renderEmailTree`, for an email authored on silicaui 0.17's
// `<EmailBuilder>`. It takes a silica `EmailDocument` and produces the SAME
// `SendableEmail` (subject + inlined table HTML + plain text) every caller already
// consumes, so the four render callers (builder preview/test, broadcasts,
// transactional by-key, the dispatch tick) branch on the document shape, not on a
// new return type.
//
// Unlike `renderEmailTree` (a React-Email walk over a sparx `BuilderNode` tree),
// this is React-FREE: silica's own `toEmailHtml` projector emits the table HTML,
// and plain text comes from a walk of the resolved node tree. That keeps this
// module importable from a backend (email-worker / api-rest) with no React in the
// bundle — hence the dedicated `@sparx/email/silica` entrypoint.
//
// The pipeline (D2):
//   1. compose the SEND document — a branded wordmark header section, the author's
//      body, and (marketing only) a CAN-SPAM legal footer — around the author doc;
//   2. resolve it ONCE through the sparx resolver (`createSilicaResolver`), which
//      substitutes `data` bindings AND interpolates silica's native `{{token}}`
//      support in text + button labels;
//   3. project the resolved doc to HTML with `toEmailHtml`, then run a thin
//      `{{token}}` pass for the fields silica's native interpolation doesn't reach
//      (subject / preheader / href / image src / raw HTML);
//   4. derive plain text from the resolved tree.

import {
  toEmailHtml,
  resolveEmailTree,
  type EmailDocument,
  type EmailHeadExtras,
  type EmailResolveHost,
} from '@wizeworks/silicaui-builder/email';
import { emailBrandFontHref } from '@sparx/site-themes';
import {
  createSilicaResolver,
  defaultSilicaFormat,
  interpolateEmailTokens,
  resolvePath,
  type DataSources,
} from '@sparx/builder-schemas';

import { defaultBrand, type BrandTokens } from '../components/brand';
import type { SendableEmail } from '../types';
import {
  applyBrandColors,
  emailBrandColorDefaults,
  emailBrandDarkColorDefaults,
} from './brand-colors';
import { buildDarkModeCss } from './dark-mode';
import { composeSendDocument, type EmailCompliance, type FooterLink } from './frame';
import { emailDocumentToText } from './to-text';

const FALLBACK_FROM = 'sparx <noreply@sparx.email>';

function defaultFrom(): string {
  return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
}

export interface RenderSilicaEmailInput {
  /** The silica email to send — a `BuilderEmail`'s published (or draft, for a
   *  preview) silica document. */
  doc: EmailDocument;
  to: string;
  from?: string;
  replyTo?: string;
  /** Override the document's own subject (the broadcast / automation path); falls
   *  back to `doc.subject`. Merge tokens in it are interpolated. */
  subject?: string;
  /** Override the document's preheader; `null` clears it. Falls back to
   *  `doc.preheader`. */
  preheader?: string | null;
  /** Resolved data sources for bound nodes + `{{token}}`s. Omit for a static
   *  render (bindings fall back to their authored values; tokens render empty). */
  data?: DataSources;
  /** Per-recipient compliance values (docs/91 §8) — the one-click unsubscribe URL
   *  and the tenant's physical address — rendered into the injected legal footer.
   *  Only emitted for a `marketing` send. */
  compliance?: EmailCompliance;
  /** A marketing send injects the legal footer (unsubscribe + address) and is
   *  gated on compliance upstream; a transactional send omits it. Default false. */
  marketing?: boolean;
  /** Resolved footer links (account · contact · privacy · terms · …) the caller
   *  built from the site's account portal + published legal pages. Rendered as the
   *  footer's utility/legal row; omitted → that row is absent. */
  footerLinks?: FooterLink[];
}

export interface RenderSilicaEmailOptions {
  /** The resolved tenant/site brand — colours, fonts, logo, and site name for the
   *  injected wordmark header + footer. Merged over the neutral default so a
   *  partial brand still renders. */
  brand?: Partial<BrandTokens>;
}

/** Render a silica `EmailDocument` to a `SendableEmail`. The email twin of
 *  `renderEmailTree` — same output contract, silica projector underneath. */
export function renderSilicaEmail(
  input: RenderSilicaEmailInput,
  opts: RenderSilicaEmailOptions = {}
): SendableEmail {
  const brand: BrandTokens = { ...defaultBrand, ...opts.brand };
  const data: DataSources = input.data ?? {};

  // The resolver is the SAME one the storefront + site editor use — sparx's
  // binding spine behind silica's two `ResolveHost` primitives (D4). Its shape is
  // exactly `EmailResolveHost`, so it drops straight into `resolveEmailTree`.
  const host: EmailResolveHost = createSilicaResolver({
    root: data,
    format: defaultSilicaFormat,
    // The email conditional (docs/120): a node bound to data this recipient doesn't
    // have is DROPPED, not left showing a dangling label ("Reason:" with no reason,
    // "Shipping to:" with no address). This replaces the legacy `conditional_block`
    // node type, and is what makes a bound section a pure show/hide wrapper — a
    // section has no default bindable field, so resolution fills nothing on it.
    // Must match the editor host's resolver exactly, or preview would drift from send.
    hideWhenEmpty: true,
  });
  const resolveToken = (path: string): unknown => resolvePath({ root: data }, path);

  // 1. Repaint the author's document in the tenant brand (every field still on its
  //    silica default; a hand-picked color is frozen and survives), then compose the
  //    branded header + legal footer around it. Order matters: the frame's own nodes
  //    are already brand-colored and carry no `Auto` flags, so they're composed AFTER
  //    the repaint and never walked by it.
  const branded = applyBrandColors(input.doc, brand);
  const sendDoc = composeSendDocument(branded, {
    brand,
    marketing: input.marketing ?? false,
    compliance: input.compliance,
    footerLinks: input.footerLinks,
  });

  // 2. Resolve once — substitutes `data` bindings and silica's native `{{token}}`
  //    interpolation (text + button labels). The resolved root carries concrete
  //    values with the binding markers stripped.
  const resolvedRoot = resolveEmailTree(sendDoc.root, host);
  const resolvedDoc: EmailDocument = { ...sendDoc, root: resolvedRoot };

  // 3. Project to HTML, then interpolate the tokens native resolution doesn't
  //    reach (href / image src / raw HTML nodes survive projection verbatim).
  //
  //    The tenant's brand FACES are loaded with a Google Fonts <link> built from the
  //    same source the storefront uses (`emailBrandFontHref` over the resolved brand's
  //    font stacks) — tenant-generic, never a hardcoded platform face. Apple Mail /
  //    iOS Mail honour it; Gmail/Outlook strip the <link> and fall back to the stack.
  const fontHref = emailBrandFontHref([brand.fontHeading, brand.fontBody]);
  const fontRaw = fontHref
    ? '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      `<link rel="stylesheet" href="${fontHref.replace(/&/g, '&amp;')}">`
    : '';
  //    Dark mode: the send declares `color-scheme: light dark` (silica emits the meta),
  //    and — when the brand carries its site's dark palette — an `@media (prefers-color-
  //    scheme: dark)` block that flips surfaces/text/borders to that dark theme via the
  //    projector's `head.css` hook. Built from the diff between the light role map the
  //    doc was just painted with and the brand's dark role map, so it aligns to the site.
  const darkColors = emailBrandDarkColorDefaults(brand);
  const darkCss = darkColors ? buildDarkModeCss(emailBrandColorDefaults(brand), darkColors) : '';
  const head: EmailHeadExtras | undefined =
    fontRaw || darkCss
      ? { ...(fontRaw ? { raw: fontRaw } : {}), ...(darkCss ? { css: darkCss } : {}) }
      : undefined;
  const html = interpolateEmailTokens(
    toEmailHtml(resolvedDoc, head ? { head } : undefined),
    resolveToken
  );

  // 4. Plain text from the resolved tree, tokens interpolated the same way.
  const text = interpolateEmailTokens(emailDocumentToText(resolvedDoc), resolveToken);

  const subject = interpolateEmailTokens(input.subject ?? input.doc.subject, resolveToken);

  return {
    from: input.from ?? defaultFrom(),
    to: input.to,
    replyTo: input.replyTo,
    subject,
    html,
    text,
  };
}
