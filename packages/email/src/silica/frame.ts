// The branded send-frame for a silica email (docs/120 D2). silica's `toEmailHtml`
// projects a self-contained document, but the tenant's branded header (wordmark)
// and the CAN-SPAM legal footer (unsubscribe + physical address) are HOST chrome,
// not author content — the site owner composes the body, the platform wraps it.
// So we inject them as real silica `section` nodes around the author's body BEFORE
// projection, styled from the resolved brand, so they render through the same
// projector as everything else (no second rendering path).

import type {
  ContentNode,
  DividerNode,
  EmailBody,
  EmailDocument,
  EmailFrame,
  HtmlNode,
  SectionNode,
  SpacerNode,
  TextNode,
} from '@wizeworks/silicaui-builder/email';

import type { BrandTokens } from '../components/brand';

/** Per-recipient compliance values rendered into the marketing legal footer. */
export interface EmailCompliance {
  /** The one-click unsubscribe URL (also fed to the `List-Unsubscribe` header by
   *  the caller). Falls back to `#` in a static preview. */
  unsubscribeUrl?: string;
  /** The tenant's CAN-SPAM postal address. Omitted → no address line. */
  physicalAddress?: string;
}

/** A resolved footer link — an absolute URL (or `mailto:`) plus its label. The
 *  caller resolves these per-site (the account portal, a contact address, and the
 *  site's PUBLISHED legal pages) so the footer only ever shows live links. */
export interface FooterLink {
  label: string;
  href: string;
}

export interface ComposeOptions {
  brand: BrandTokens;
  /** Marketing sends inject the legal footer; transactional sends don't. */
  marketing: boolean;
  compliance?: EmailCompliance;
  /** Resolved utility + legal footer links (account · contact · privacy · terms · …).
   *  Empty/omitted → those rows are simply absent. */
  footerLinks?: FooterLink[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A per-compose id source — the frame nodes need ids (the schema requires them),
 *  but they never round-trip through the editor, so a stable local counter is
 *  enough (and keeps a render deterministic). */
function makeIder(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${n++}`;
}

/** A thin brand-colour bar across the very top — an immediate, quiet brand signal
 *  before the wordmark (a common transactional-email device). Uses the resolved brand
 *  primary directly, like the rest of the frame chrome (no `Auto` flag to repaint). */
function brandBarSection(brand: BrandTokens, id: () => string): SectionNode {
  const bar: SpacerNode = { id: id(), kind: 'spacer', height: 4 };
  return {
    id: id(),
    kind: 'section',
    bg: brand.primary,
    paddingX: 0,
    paddingY: 0,
    children: [bar],
  };
}

/** The wordmark header: the brand logo when set, else the site name as a bold
 *  heading, followed by a hairline divider — the header that used to be fixed
 *  `EmailLayout` chrome (docs/52 §1). */
function wordmarkSection(brand: BrandTokens, id: () => string): SectionNode {
  const child: ContentNode = brand.logoUrl
    ? // A raw <img> capped by HEIGHT, not width: silica's ImageNode exposes only
      // `width`, so a SQUARE brand mark (a spark, a monogram) at any header-reasonable
      // width renders just as tall and dominates the email. Capping height keeps a
      // square mark AND a horizontal wordmark to the same restrained header size, the
      // aspect ratio preserved by `width:auto`.
      ({
        id: id(),
        kind: 'html',
        html:
          `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.siteName ?? '')}" ` +
          `height="40" style="height:40px;width:auto;max-height:40px;display:block;border:0;outline:none;text-decoration:none" />`,
      } satisfies HtmlNode)
    : ({
        id: id(),
        kind: 'text',
        html: escapeHtml(brand.siteName ?? 'sparx'),
        align: 'left',
        color: brand.foreground,
        colorAuto: false,
        fontSize: 22,
        fontWeight: 'bold',
        // PIXELS, not a ratio — silica's projector emits `line-height: {n}px`. A `1.3`
        // here renders the wordmark on a 1px line, i.e. collapsed on top of itself.
        lineHeight: 29,
      } satisfies TextNode);
  const divider: DividerNode = {
    id: id(),
    kind: 'divider',
    color: brand.border,
    thickness: 1,
  };
  return {
    id: id(),
    kind: 'section',
    bg: brand.background,
    paddingX: 24,
    paddingY: 20,
    children: [child, divider],
  };
}

/** Display labels for the social platforms we footer-link, so a stored `twitter`
 *  reads "X" and casing is right ("TikTok", not "Tiktok"). Any other platform key
 *  is title-cased as a fallback rather than dropped. */
const SOCIAL_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  twitter: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
};

/** A centered row of `·`-separated links (`Your account · Contact · Privacy`), the
 *  shape both the utility/legal row and the social row take. Returns '' when there's
 *  nothing to show so the row drops out. `marginBottom` tunes the gap to the next
 *  tier; `1.9` line-height keeps a wrapped row readable. */
function linkRow(links: FooterLink[], base: string, color: string, marginBottom: number): string {
  const items = links
    .filter((l) => l?.href && l?.label)
    .map(
      (l) =>
        `<a href="${escapeHtml(l.href)}" style="color:${color};text-decoration:none">${escapeHtml(
          l.label
        )}</a>`
    );
  if (items.length === 0) return '';
  return `<p style="margin:0 0 ${marginBottom}px;font-size:13px;line-height:1.9;${base}">${items.join(
    ' &middot; '
  )}</p>`;
}

/** The site's socials mapped to labelled links for the social row (unsupported /
 *  urlless entries dropped). */
function socialLinks(brand: BrandTokens): FooterLink[] {
  return (brand.socials ?? [])
    .filter((s) => s?.url && s.url.trim().length > 0)
    .map((s) => {
      const key = s.platform.toLowerCase().trim();
      return {
        label: SOCIAL_LABEL[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
        href: s.url,
      };
    });
}

/**
 * The footer, composed on EVERY send — so no email just stops dead after the last
 * button. A hairline rule sets it off from the body, then, centered and tiered from
 * most prominent to fine print:
 *
 *   1. the business name, linked home (identity / sign-off);
 *   2. the utility + legal link row — the account portal, contact, and the site's
 *      PUBLISHED legal pages (privacy · terms · returns · …), resolved by the caller
 *      so every link is live;
 *   3. the social links row;
 *   4. on a MARKETING send, the CAN-SPAM one-click unsubscribe line (a transactional
 *      send has nothing to opt out of);
 *   5. a small legal line — business name + postal address.
 *
 * Each tier steps DOWN in size so the eye reads identity first and fine print last.
 * A raw-HTML node so per-send URLs inline exactly; muted, small, centered type — a
 * footer is the sanctioned place for small text.
 */
function footerSection(
  brand: BrandTokens,
  opts: { marketing: boolean; compliance?: EmailCompliance; footerLinks?: FooterLink[] },
  id: () => string
): SectionNode {
  const name = escapeHtml(brand.siteName ?? 'sparx');
  const base = `font-family:${brand.fontBody};color:${brand.foreground};text-align:center`;
  const parts: string[] = [
    // `{{site.url}}` resolves in the shared token pass over the composed document —
    // the same site this send is on behalf of, so the sign-off links home.
    `<p style="margin:0 0 12px;font-size:15px;font-weight:bold;line-height:1.4;${base}">` +
      `<a href="{{site.url}}" style="color:inherit;text-decoration:none">${name}</a></p>`,
    // Utility + legal links (account, contact, privacy, terms…) then socials — both
    // in the brand link colour so the two rows read as one link block.
    linkRow(opts.footerLinks ?? [], base, brand.primary, 8),
    linkRow(socialLinks(brand), base, brand.primary, 12),
  ];
  if (opts.marketing) {
    const unsubscribe = opts.compliance?.unsubscribeUrl ?? '#';
    parts.push(
      `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;${base}">You’re receiving this because you opted in. ` +
        `<a href="${unsubscribe}" style="color:${brand.primary}">Unsubscribe</a></p>`
    );
  }
  // The legal fine print — business name + postal address, one line at the very
  // bottom. CAN-SPAM wants the address on marketing; a transactional receipt reads
  // better with it too.
  if (opts.compliance?.physicalAddress) {
    parts.push(
      `<p style="margin:0;font-size:12px;line-height:1.5;${base}">${name} &middot; ${escapeHtml(
        opts.compliance.physicalAddress
      )}</p>`
    );
  }
  // sparx attribution — the tenant's customer sees who powers the business, a quiet
  // "who built this?" lead-gen signal, and parity with the legacy `EmailLayout` footer
  // that already carries it. Smallest tier, links home with a source tag; "sparx" takes
  // the brand link colour so it sits inside the tenant's palette rather than shouting.
  parts.push(
    `<p style="margin:14px 0 0;font-size:12px;line-height:1.5;${base}">Sent with ` +
      `<a href="https://sparx.works/?ref=powered-by" style="color:${brand.primary};text-decoration:none;font-weight:600">sparx</a></p>`
  );
  // A top rule inside the footer content gives the separation a section can't (no
  // border on sections) without depending on the faint muted-vs-white bg contrast.
  const html = `<div style="border-top:1px solid ${brand.border};padding-top:20px">${parts
    .filter(Boolean)
    .join('')}</div>`;
  const node: HtmlNode = { id: id(), kind: 'html', html };
  return {
    id: id(),
    kind: 'section',
    bg: brand.muted,
    paddingX: 24,
    paddingY: 24,
    children: [node],
  };
}

/** Build the branded chrome as silicaui 0.34's host-owned `EmailFrame` — the brand
 *  bar + wordmark ABOVE the body (`header`) and the tiered legal footer BELOW it
 *  (`footer`). This is the SINGLE source of truth for the frame: the send splices it
 *  around the author's body (`composeSendDocument`), and the email studio hands the
 *  IDENTICAL frame to `<EmailBuilder frame={…}>` so the edit canvas renders the real
 *  brand bar / wordmark / footer as inert chrome — the author designs against exactly
 *  what ships, and the compliance footer stays un-deletable because it's never a node
 *  in the saved document. */
export function buildEmailFrame(opts: ComposeOptions): EmailFrame {
  const id = makeIder('sx-frame');
  return {
    header: [brandBarSection(opts.brand, id), wordmarkSection(opts.brand, id)],
    footer: [
      footerSection(
        opts.brand,
        { marketing: opts.marketing, compliance: opts.compliance, footerLinks: opts.footerLinks },
        id
      ),
    ],
    label: 'Brand frame',
  };
}

/** Wrap the author's document with the branded header (+ marketing footer),
 *  returning a new `EmailDocument` ready to resolve + project. The author's body
 *  sections are preserved in order between the frame's header and footer sections —
 *  the same `EmailFrame` the editor canvas renders (via `buildEmailFrame`), so send
 *  and canvas can never disagree on the chrome. */
export function composeSendDocument(doc: EmailDocument, opts: ComposeOptions): EmailDocument {
  const frame = buildEmailFrame(opts);
  const children: SectionNode[] = [
    ...(frame.header ?? []),
    ...doc.root.children,
    ...(frame.footer ?? []),
  ];
  const root: EmailBody = { ...doc.root, children };
  return { ...doc, root };
}
