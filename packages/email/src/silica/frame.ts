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
  HtmlNode,
  ImageNode,
  SectionNode,
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

export interface ComposeOptions {
  brand: BrandTokens;
  /** Marketing sends inject the legal footer; transactional sends don't. */
  marketing: boolean;
  compliance?: EmailCompliance;
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

/** The wordmark header: the brand logo when set, else the site name as a bold
 *  heading, followed by a hairline divider — the header that used to be fixed
 *  `EmailLayout` chrome (docs/52 §1). */
function wordmarkSection(brand: BrandTokens, id: () => string): SectionNode {
  const child: ContentNode = brand.logoUrl
    ? ({
        id: id(),
        kind: 'image',
        src: brand.logoUrl,
        alt: brand.siteName ?? '',
        width: 160,
        align: 'left',
      } satisfies ImageNode)
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

/** The CAN-SPAM legal footer (marketing only): the one-click unsubscribe line and
 *  the physical address, as a raw-HTML node so the per-send URL/address inline
 *  exactly. Muted, small type on the page background. */
function legalSection(
  brand: BrandTokens,
  compliance: EmailCompliance | undefined,
  id: () => string
): SectionNode {
  const unsubscribe = compliance?.unsubscribeUrl ?? '#';
  const address = compliance?.physicalAddress;
  const line = `margin:0 0 8px;font-size:12px;line-height:1.5;color:${brand.foreground};font-family:${brand.fontBody}`;
  const html =
    `<p style="${line}">You’re receiving this because you opted in. ` +
    `<a href="${unsubscribe}" style="color:${brand.primary}">Unsubscribe</a></p>` +
    (address
      ? `<p style="margin:0;font-size:12px;line-height:1.5;color:${brand.foreground};font-family:${brand.fontBody}">${escapeHtml(
          address
        )}</p>`
      : '');
  const node: HtmlNode = { id: id(), kind: 'html', html };
  return {
    id: id(),
    kind: 'section',
    bg: brand.muted,
    paddingX: 24,
    paddingY: 20,
    children: [node],
  };
}

/** Wrap the author's document with the branded header (+ marketing footer),
 *  returning a new `EmailDocument` ready to resolve + project. The author's body
 *  sections are preserved in order between the two frame sections. */
export function composeSendDocument(doc: EmailDocument, opts: ComposeOptions): EmailDocument {
  const id = makeIder('sx-frame');
  const header = wordmarkSection(opts.brand, id);
  const footer = opts.marketing ? legalSection(opts.brand, opts.compliance, id) : null;
  const children: SectionNode[] = [header, ...doc.root.children, ...(footer ? [footer] : [])];
  const root: EmailBody = { ...doc.root, children };
  return { ...doc, root };
}
