import * as React from 'react';
import { render } from '@react-email/render';
import { Column, Img, Row, Section } from '@react-email/components';
// The React-free JSON→HTML serializer (the audited CMS path) — turns an authored
// Prose doc into sanitised, inline-safe HTML at send time (docs/52 §9).
import { renderDocToHtml } from '@sparx/cms-editor/serialize';
import {
  cardinalityOf,
  interpolateEmailTokens,
  normalizeEmailTree,
  resolvePath,
  type BuilderNode,
  type DataSources,
  type Scope,
} from '@sparx/builder-schemas';
import {
  BrandProvider,
  EmailButton,
  EmailDivider,
  EmailHeading,
  EmailLink,
  EmailMuted,
  EmailParagraph,
  EmailWordmark,
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
// styles instead of <div> + flexbox + `--st-*` vars — because mail clients strip
// <style> blocks and don't honour CSS custom properties.
//
// Email is fixed-width (the ~560px EmailLayout container) and non-interactive, so
// most of the class layer collapses: heights / full-bleed widths / overlays / text
// tones / pins / visibility have no email analogue and are ignored. The honoured
// concerns — direction, columns, gap, padding, surface, text-align — are PARSED
// back out of the node's Tailwind-native `class` string (docs/61), since the
// renderer emits inline styles rather than the classes themselves.

const FALLBACK_FROM = 'Sparx <noreply@sparx.email>';

// Header wordmark size token → px (logo height + name font scale from this). Mirrors
// the canvas leaf's mapping so the editor preview and the send agree.
const WORDMARK_SIZE_PX: Record<string, number> = { sm: 18, md: 22, lg: 28 };
function defaultFrom(): string {
  return process.env.SPARX_EMAIL_FROM ?? FALLBACK_FROM;
}

const CONTAINERS = new Set(['Section', 'Stack', 'Grid', 'Card']);

/** Compliance context resolved per-recipient at dispatch (docs/91 §8): the
 *  one-click unsubscribe URL the `unsubscribe_link` node renders + feeds into the
 *  `List-Unsubscribe` header, and the CAN-SPAM physical address the
 *  `physical_address` node renders (`EmailSettings.physicalAddress`). Empty in a
 *  static preview — the unsubscribe link then points at '#' and the address node
 *  renders nothing. Provided once at the tree root (parallel to BrandProvider) so
 *  the two leaf nodes read it without prop-drilling. */
export interface EmailComplianceContext {
  unsubscribeUrl?: string;
  physicalAddress?: string;
}
const ComplianceContext = React.createContext<EmailComplianceContext>({});

type EmailDirection = 'stack' | 'row' | 'grid';
type EmailSurface = 'none' | 'muted' | 'inverse' | 'brand';
interface EmailLayout {
  direction: EmailDirection;
  columns: number;
  gap: number;
  padding: number;
  surface: EmailSurface;
  textAlign: 'left' | 'center' | 'right';
}

// Padding / gap utilities (docs/61 box-to-class) → the email pixel scale. `p-3/6/
// 10/16` and `gap-2/4/6` are the values the converter emits.
const PADDING_BY_TOKEN: Record<string, number> = {
  'p-3': spacing.sm,
  'p-6': spacing.md,
  'p-10': spacing.lg,
  'p-16': spacing.xl,
};
const GAP_BY_TOKEN: Record<string, number> = {
  'gap-2': spacing.xs,
  'gap-4': spacing.md,
  'gap-6': spacing.lg,
};

/** Parse the email-relevant layout out of a node's `class` string. The token
 *  vocabulary is exactly what `box-to-class` emits (docs/61) — direction from
 *  `grid` / `flex-row` (any breakpoint), columns from `grid-cols-N`, gap from
 *  `gap-N`, padding from `p-N`, surface from `bg-*`, alignment from `text-*`. */
function readEmailLayout(cls: string | undefined): EmailLayout {
  const tokens = (cls ?? '').split(/\s+/).filter(Boolean);
  const set = new Set(tokens);
  const has = (t: string) => set.has(t);
  // base name without a responsive/state prefix (e.g. `@3xl:flex-row` → `flex-row`).
  const bare = (t: string) => t.slice(t.lastIndexOf(':') + 1);
  const bareSet = new Set(tokens.map(bare));

  const direction: EmailDirection = bareSet.has('grid')
    ? 'grid'
    : bareSet.has('flex-row')
      ? 'row'
      : 'stack';

  let columns = 1;
  for (const t of tokens) {
    const m = /grid-cols-(\d+)/.exec(t);
    if (m) columns = Math.max(columns, Number(m[1]));
  }

  let gap: number = spacing.md;
  for (const [token, px] of Object.entries(GAP_BY_TOKEN)) if (has(token)) gap = px;

  let padding = 0;
  for (const [token, px] of Object.entries(PADDING_BY_TOKEN)) if (has(token)) padding = px;

  const surface: EmailSurface = has('bg-primary')
    ? 'brand'
    : has('bg-neutral')
      ? 'inverse'
      : has('bg-base-200') || has('bg-base-300')
        ? 'muted'
        : 'none';

  const textAlign = has('text-center') ? 'center' : has('text-right') ? 'right' : 'left';

  return { direction, columns: Math.max(1, columns), gap, padding, surface, textAlign };
}

/** Surface → background/foreground from the resolved brand. Email has no token
 *  CSS vars, so these are concrete colors inlined on the Section. */
function surfaceStyle(surface: EmailSurface, brand: BrandTokens): React.CSSProperties {
  switch (surface) {
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

/** Whether a `conditional_block`'s resolved `when` value counts as "present" —
 *  an empty string / 0 / false / empty array / null all read as hidden, so an
 *  optional credit line, quote expiry, or dunning note only renders when its
 *  field actually carries a value. */
function truthyWhen(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** A line-item table over a resolved collection (`order/cart/quote/invoice.items`).
 *  Each item carries `name`/`description` · `quantity` · `unitPrice` · `lineTotal`
 *  (already display-formatted strings from the resolver). Compact three-column
 *  table — item · qty · amount — which renders cleanly at the ~560px email width.
 *  Renders nothing for an empty/absent collection. */
function LineItemTable({
  items,
  brand,
}: {
  items: unknown;
  brand: BrandTokens;
}): React.ReactElement | null {
  const rows = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  if (rows.length === 0) return null;
  const cellBase: React.CSSProperties = {
    ...typography.body,
    fontFamily: brand.fontBody,
    color: brand.foreground,
    padding: '8px 0',
    verticalAlign: 'top',
  };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {rows.map((item, i) => {
          const name = asText(item.name) || asText(item.description);
          const qty = asText(item.quantity);
          const amount = asText(item.lineTotal) || asText(item.unitPrice);
          return (
            <tr key={i} style={{ borderBottom: `1px solid ${brand.border}` }}>
              <td style={{ ...cellBase, textAlign: 'left' }}>{name}</td>
              <td style={{ ...cellBase, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {qty ? `× ${qty}` : ''}
              </td>
              <td style={{ ...cellBase, textAlign: 'right', whiteSpace: 'nowrap' }}>{amount}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Leaf rendering ─────────────────────────────────────────────────────────

function Leaf({
  node,
  value,
  bound,
  scope,
}: {
  node: BuilderNode;
  value: unknown;
  bound: boolean;
  scope: Scope;
}): React.ReactElement | null {
  const p = node.props;
  const brand = useBrand();
  const compliance = React.useContext(ComplianceContext);
  // Interpolate `{{source.field}}` merge tokens in a static string prop against
  // the current scope (docs/91 §3). A bound value is real data and never re-
  // interpolated; only author-written copy/links carry tokens.
  const interp = (s: string): string =>
    s.includes('{{') ? interpolateEmailTokens(s, (path) => resolvePath(scope, path)) : s;
  switch (node.type) {
    case 'Heading': {
      const level = str(p, 'level') || 'h2';
      const text = (bound ? asText(value) : '') || interp(str(p, 'text'));
      if (!text) return null;
      return <EmailHeading level={level === 'h1' ? 1 : 2}>{text}</EmailHeading>;
    }
    case 'Text': {
      const variant = str(p, 'variant') || 'body';
      const text = (bound ? asText(value) : '') || interp(str(p, 'text'));
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
      const label = ((bound ? asText(value) : '') || interp(str(p, 'label')) || 'Button').trim();
      const href = interp(str(p, 'href')) || '#';
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
      const src = boundSrc || interp(str(p, 'src'));
      if (!src) return null;
      return (
        <Img
          src={src}
          alt={interp(str(p, 'alt'))}
          width="100%"
          style={{ borderRadius: 8, margin: '0 auto' }}
        />
      );
    }
    case 'line_item_table':
      // A bound collection (order/cart/quote/invoice.items). `value` is the
      // resolved array; the component renders nothing when it's empty/absent.
      return <LineItemTable items={value} brand={brand} />;
    case 'unsubscribe_link': {
      // Marketing compliance (docs/91 §8). The real one-click URL arrives via the
      // compliance context at dispatch; '#' in a static preview.
      const href = compliance.unsubscribeUrl ?? '#';
      return (
        <EmailMuted>
          You’re receiving this because you opted in. <EmailLink href={href}>Unsubscribe</EmailLink>
        </EmailMuted>
      );
    }
    case 'physical_address': {
      // The tenant's CAN-SPAM postal address (EmailSettings.physicalAddress). No
      // address configured → nothing rendered (the gate, not the node, enforces
      // presence for marketing sends).
      const addr = compliance.physicalAddress;
      return addr ? <EmailMuted>{addr}</EmailMuted> : null;
    }
    case 'email_wordmark': {
      // The author-editable header (docs/52 §1): the brand wordmark + a divider, the
      // header that used to be fixed EmailLayout chrome. CONTENT (logo + store name)
      // comes from the brand context; the node carries only the TREATMENT/align/size.
      const treatment = (str(p, 'treatment') || 'lockup') as 'lockup' | 'logo' | 'name';
      const align = (str(p, 'align') || 'left') as 'left' | 'center';
      const sizePx = WORDMARK_SIZE_PX[str(p, 'size')] ?? 22;
      return (
        <>
          <EmailWordmark treatment={treatment} align={align} size={sizePx} />
          <EmailDivider />
        </>
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

  // A conditional block renders its children only when `props.when` resolves
  // truthy (docs/91 §3) — an optional credit line, quote expiry, dunning note.
  // It carries no binding (the gate is the `when` path), so it's handled before
  // the container/leaf split.
  if (node.type === 'conditional_block') {
    const when = typeof node.props.when === 'string' ? node.props.when : '';
    const show = when === '' ? true : truthyWhen(resolvePath(scope, when));
    if (!show) return null;
    const kids = node.children ?? [];
    return (
      <>
        {kids.map((child, i) => (
          <div
            key={`${child.id}-${i}`}
            style={i < kids.length - 1 ? { marginBottom: spacing.md } : undefined}
          >
            <EmailNode node={child} scope={scope} />
          </div>
        ))}
      </>
    );
  }

  const isContainer = CONTAINERS.has(node.type);
  // Email binds by field path only (no commerce entity pins / actions — no JS in a
  // mail client); a non-field binding resolves to nothing here.
  const bound = Boolean(node.binding?.path);
  const value = bound ? resolvePath(scope, node.binding!.path ?? '') : undefined;

  if (!isContainer) {
    return <Leaf node={node} value={value} bound={bound} scope={scope} />;
  }

  const kids = node.children ?? [];
  const box = readEmailLayout(node.class);
  const direction = box.direction;
  const gap = box.gap;
  const padding = box.padding;

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
    const cols = Math.max(1, Math.min(12, box.columns));
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
    ...surfaceStyle(box.surface, brand),
    padding: padding || (isCard ? spacing.md : 0),
    textAlign: box.textAlign,
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
  /** Per-recipient compliance values (docs/91 §8) — the one-click unsubscribe URL
   *  and the tenant's physical address — read by the `unsubscribe_link` /
   *  `physical_address` nodes. Omit for a static preview. */
  compliance?: EmailComplianceContext;
}

export interface RenderEmailTreeOptions {
  brand?: Partial<BrandTokens>;
}

/** Build the React Email element for an email tree (no render) — used by tests
 *  and callers that embed the tree. The branded frame (wordmark header + legal
 *  footer) wraps the body; the author composes only the body tree. */
export function composeEmailTree(
  input: Pick<RenderEmailTreeInput, 'tree' | 'subject' | 'preheader' | 'data' | 'compliance'>,
  opts: RenderEmailTreeOptions = {}
): React.ReactElement {
  const scope: Scope = { root: input.data ?? {} };
  // The header is now the first node of the tree (an `email_wordmark`), so the
  // layout no longer adds its own — `header={false}`. Normalize as a safety net: an
  // un-normalized tree (a legacy email that hasn't been re-saved) gets the wordmark
  // injected so every send still carries a header (docs/52 §1).
  const tree = normalizeEmailTree(input.tree);
  return (
    <BrandProvider brand={opts.brand}>
      <ComplianceContext.Provider value={input.compliance ?? {}}>
        <EmailLayout preview={input.preheader ?? input.subject} header={false}>
          <EmailNode node={tree} scope={scope} />
        </EmailLayout>
      </ComplianceContext.Provider>
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
