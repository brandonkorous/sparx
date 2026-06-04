import * as React from 'react';
import { render } from '@react-email/render';
import { Column, Img, Row, Section } from '@react-email/components';
// The React-free JSON→HTML serializer (the audited CMS path) — turns an authored
// Prose doc into sanitised, inline-safe HTML at send time (docs/52 §9).
import { renderDocToHtml } from '@sparx/cms-editor/serialize';
import {
  cardinalityOf,
  resolvePath,
  type AlignX,
  type BuilderNode,
  type DataSources,
  type GapScale,
  type Scope,
  type SpaceScale,
  type Surface,
} from '@sparx/builder-schemas';
import {
  BrandProvider,
  EmailButton,
  EmailDivider,
  EmailHeading,
  EmailMuted,
  EmailParagraph,
  spacing,
  typography,
  useBrand,
  type BrandTokens,
} from '../components';
import { EmailLayout } from '../templates/_layout';
import type { SendableEmail } from '../types';

// Render a Builder EMAIL node tree to a branded, table-based React Email document
// (docs/52 §3). The email analog of apps/site's builder-renderer.tsx: it walks the
// SAME BuilderNode tree and resolves bindings through the SAME runtime
// (resolvePath / cardinalityOf), but emits @react-email primitives with INLINE
// styles instead of <div> + flexbox + `--sf-*` vars — because mail clients strip
// <style> blocks and don't honour CSS custom properties.
//
// Email is fixed-width (the ~560px EmailLayout container) and non-interactive, so
// most of the box model collapses: height / backgroundWidth / contentWidth /
// overlay / textTone / pin / hiddenOn have no email analogue and are ignored. The
// honoured axes are `padding`, `surface` (bg + fg), `align` (text-align), and the
// container `layout` (stack = block flow; row/grid = <Row>/<Column>).

const FALLBACK_FROM = 'Sparx <noreply@sparx.email>';
function defaultFrom(): string {
  return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
}

const CONTAINERS = new Set(['Section', 'Stack', 'Grid', 'Card']);

const PADDING_PX: Record<SpaceScale, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
};
const GAP_PX: Record<GapScale, number> = {
  none: 0,
  sm: spacing.xs,
  md: spacing.md,
  lg: spacing.lg,
};
const TEXT_ALIGN: Record<AlignX, 'left' | 'center' | 'right'> = {
  start: 'left',
  center: 'center',
  end: 'right',
};

/** Surface → background/foreground from the resolved brand. Email has no token
 *  CSS vars, so these are concrete colors inlined on the Section. */
function surfaceStyle(surface: Surface, brand: BrandTokens): React.CSSProperties {
  switch (surface) {
    case 'subtle':
    case 'muted':
      return { backgroundColor: brand.muted };
    case 'inverse':
      return { backgroundColor: brand.foreground, color: brand.background };
    case 'brand':
      return { backgroundColor: brand.primary, color: brand.primaryForeground };
    default:
      return {};
  }
}

const str = (props: Record<string, unknown>, key: string): string => {
  const v = props[key];
  return typeof v === 'string' ? v : '';
};

/** A bound value as display text (mirrors the storefront renderer's `asText`). */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/** A bound value as an image URL — a plain URL string, an `{ url }` asset object,
 *  or the first entry of an images array (the shapes the data resolver / catalog
 *  placeholders produce). '' when there's no usable URL. */
function asImageUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return asImageUrl(value[0]);
  if (value && typeof value === 'object' && 'url' in value) {
    const url: unknown = value.url;
    return typeof url === 'string' ? url : '';
  }
  return '';
}

/** A CMS/TipTap document — the shape an authored Prose node stores in `props.doc`
 *  (and the shape a bound richtext field resolves to). */
function isProseDoc(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'doc'
  );
}

// ── Leaf rendering ─────────────────────────────────────────────────────────

function Leaf({
  node,
  value,
  bound,
}: {
  node: BuilderNode;
  value: unknown;
  bound: boolean;
}): React.ReactElement | null {
  const p = node.props;
  const brand = useBrand();
  switch (node.type) {
    case 'Heading': {
      const level = str(p, 'level') || 'h2';
      const text = (bound ? asText(value) : '') || str(p, 'text');
      if (!text) return null;
      return <EmailHeading level={level === 'h1' ? 1 : 2}>{text}</EmailHeading>;
    }
    case 'Text': {
      const variant = str(p, 'variant') || 'body';
      const text = (bound ? asText(value) : '') || str(p, 'text');
      if (!text) return null;
      // Eyebrow / meta read as the muted, smaller chrome; body is a paragraph.
      return variant === 'body' ? (
        <EmailParagraph>{text}</EmailParagraph>
      ) : (
        <EmailMuted>{text}</EmailMuted>
      );
    }
    case 'Prose': {
      // Free-form authored rich text (docs/52 §9). Serialize the stored CMS/TipTap
      // doc to sanitised HTML (the audited, React-free serializer) and inline it.
      // A bound richtext field wins when it resolves to a doc; a bound string
      // renders as one representative paragraph. Base typography is set on the
      // wrapper so prose inherits the email body's font/color — headings keep the
      // mail client's own sizing (no <style> block to lean on).
      if (bound && typeof value === 'string') {
        return value ? <EmailParagraph>{value}</EmailParagraph> : null;
      }
      const doc = bound && isProseDoc(value) ? value : p.doc;
      const html = renderDocToHtml(doc);
      if (!html) return null;
      return (
        <div
          style={{ ...typography.body, color: brand.foreground, fontFamily: brand.fontBody }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    case 'Button': {
      const label = ((bound ? asText(value) : '') || str(p, 'label') || 'Button').trim();
      const href = str(p, 'href') || '#';
      return <EmailButton href={href}>{label}</EmailButton>;
    }
    case 'Divider':
      return <EmailDivider />;
    case 'Image':
    case 'ImageDisplay': {
      // `Image` is a static URL (props.src); `ImageDisplay` is a bound image — a
      // product / cart / post image resolved per item. A bound value (URL string,
      // `{ url }` asset, or images array) wins over the static src.
      const boundSrc = bound ? asImageUrl(value) : '';
      const src = boundSrc || str(p, 'src');
      if (!src) return null;
      return (
        <Img
          src={src}
          alt={str(p, 'alt')}
          width="100%"
          style={{ borderRadius: 8, margin: '0 auto' }}
        />
      );
    }
    default:
      return null;
  }
}

// ── Recursive node ───────────────────────────────────────────────────────────

function EmailNode({
  node,
  scope,
}: {
  node: BuilderNode;
  scope: Scope;
}): React.ReactElement | null {
  const brand = useBrand();
  const isContainer = CONTAINERS.has(node.type);
  const bound = Boolean(node.binding);
  const value = bound ? resolvePath(scope, node.binding!.path) : undefined;

  if (!isContainer) {
    return <Leaf node={node} value={value} bound={bound} />;
  }

  const kids = node.children ?? [];
  const layout = node.layout;
  const direction = layout?.direction ?? 'stack';
  const gap = GAP_PX[layout?.gap ?? 'md'];
  const padding = PADDING_PX[node.box.padding];

  // Resolve the effective (node, scope) pairs this container renders: an array
  // binding ITERATES the children once per item; an object binding sets scope and
  // renders once; otherwise the children render in the current scope. Mirrors the
  // storefront renderer's cardinality handling so semantics never drift.
  const card = bound ? cardinalityOf(value) : 'empty';
  let units: { node: BuilderNode; scope: Scope }[];
  if (bound && card === 'array') {
    units = (value as unknown[]).flatMap((item, i) =>
      kids.map((child) => ({ node: child, scope: { ...scope, item, index: i } }))
    );
  } else if (bound && card === 'object') {
    units = kids.map((child) => ({ node: child, scope: { ...scope, item: value } }));
  } else {
    units = kids.map((child) => ({ node: child, scope }));
  }

  const cellStyle = (count: number): React.CSSProperties => ({
    width: `${100 / Math.max(1, count)}%`,
    padding: gap ? `0 ${gap / 2}px` : 0,
    verticalAlign: 'top',
  });

  let body: React.ReactNode;
  if (direction === 'row') {
    body = (
      <Row>
        {units.map((u, i) => (
          <Column key={`${u.node.id}-${i}`} style={cellStyle(units.length)}>
            <EmailNode node={u.node} scope={u.scope} />
          </Column>
        ))}
      </Row>
    );
  } else if (direction === 'grid') {
    const cols = Math.max(1, Math.min(12, layout?.columns ?? 3));
    const rows: { node: BuilderNode; scope: Scope }[][] = [];
    for (let i = 0; i < units.length; i += cols) rows.push(units.slice(i, i + cols));
    body = rows.map((r, ri) => (
      <Row key={ri} style={{ marginBottom: gap }}>
        {r.map((u, ci) => (
          <Column key={`${u.node.id}-${ci}`} style={cellStyle(cols)}>
            <EmailNode node={u.node} scope={u.scope} />
          </Column>
        ))}
      </Row>
    ));
  } else {
    // Stack — block flow, each child separated by the gap (the established
    // section-render idiom: a wrapping div with marginBottom).
    body = units.map((u, i) => (
      <div
        key={`${u.node.id}-${i}`}
        style={i < units.length - 1 ? { marginBottom: gap } : undefined}
      >
        <EmailNode node={u.node} scope={u.scope} />
      </div>
    ));
  }

  // Card is a bordered surface; other containers are plain. The Section carries
  // the surface bg/fg, padding, text-align, and (Card) a hairline border.
  const isCard = node.type === 'Card';
  const sectionStyle: React.CSSProperties = {
    ...surfaceStyle(node.box.surface, brand),
    padding: padding || (isCard ? spacing.md : 0),
    textAlign: TEXT_ALIGN[node.box.align],
    ...(isCard ? { border: `1px solid ${brand.border}`, borderRadius: 8 } : {}),
  };

  return <Section style={sectionStyle}>{body}</Section>;
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface RenderEmailTreeInput {
  /** The email body tree (a BuilderEmail's published or draft root). */
  tree: BuilderNode;
  subject: string;
  preheader?: string | null;
  to: string;
  from?: string;
  replyTo?: string;
  /** Resolved data sources for bound nodes. Omit for a static render (bound
   *  leaves then fall back to their props; the Phase-1 case). */
  data?: DataSources;
}

export interface RenderEmailTreeOptions {
  brand?: Partial<BrandTokens>;
}

/** Build the React Email element for an email tree (no render) — used by tests
 *  and callers that embed the tree. The branded frame (wordmark header + legal
 *  footer) wraps the body; the author composes only the body tree. */
export function composeEmailTree(
  input: Pick<RenderEmailTreeInput, 'tree' | 'subject' | 'preheader' | 'data'>,
  opts: RenderEmailTreeOptions = {}
): React.ReactElement {
  const scope: Scope = { root: input.data ?? {} };
  return (
    <BrandProvider brand={opts.brand}>
      <EmailLayout preview={input.preheader ?? input.subject}>
        <EmailNode node={input.tree} scope={scope} />
      </EmailLayout>
    </BrandProvider>
  );
}

/** Render a Builder email tree to a SendableEmail (subject + inlined html +
 *  auto-generated plain text). Mirrors renderSections (docs/52 §3). */
export async function renderEmailTree(
  input: RenderEmailTreeInput,
  opts: RenderEmailTreeOptions = {}
): Promise<SendableEmail> {
  const element = composeEmailTree(input, opts);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return {
    from: input.from ?? defaultFrom(),
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    html,
    text,
  };
}
