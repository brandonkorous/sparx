// Email-faithful leaf rendering for the Builder CANVAS (docs/52, docs/93).
//
// The page/site render path renders leaves through silicaui so the canvas
// preview matches the LIVE SITE. An email never renders through site-ui — it
// renders through @wizeworks/email's table-based primitives at a FIXED pixel scale
// (20px headings, 14px body, a single accent button). Reusing the site-ui
// Heading/Text/Button for an email is the wrong yardstick: it paints the
// storefront's hero sizes + the tenant's (often serif) heading font, so the email
// canvas read "like crap" — oversized, nothing like an inbox message.
//
// These components reproduce the @wizeworks/email primitives as REAL DOM, driven by
// the SAME `EMAIL_DESIGN` tokens the renderer inlines on send — so the SCALE
// (sizes, weights, spacing, radius, the accent CTA) is an exact match. Brand-
// derived values (text/accent color, fonts) read the tenant theme `.bx-canvas`
// exposes as `--color-*` vars; the EMAIL_DESIGN values are the inlined fallback when
// no brand is compiled (matching @wizeworks/email's `defaultBrand`).
//
// CAVEAT: the true send resolves its brand via email-platform's brand-service —
// the DEFAULT preset overlaid with the tenant's brand identity — whereas these
// vars carry the tenant's SITE theme. They agree on identity-level brand (primary,
// any brand-set fonts), but a tenant whose chosen SITE theme contributes a heading
// font / hairline color the email default doesn't can see that one axis shift
// between this preview and the send. Closing that needs the email canvas to be
// themed from the resolved email brand (a separate, deliberate change).
//
// CLASS OVERRIDES (Email v2 §3.6c): on top of the scale + brand chrome, each leaf
// accepts a `style` the host (`renderLeaf`) compiles from the node's `class` via the
// email-safe `emailStyleFor` against `CANVAS_EMAIL_PALETTE` below. It is merged LAST,
// so an author's size/weight/color/alignment/spacing wins over the default — exactly
// as the real send applies its `classStyleFor`, so the editor preview matches the mail.

import * as React from 'react';
import { EMAIL_DESIGN, type EmailPalette } from '@wizeworks/builder-schemas';

const { typography, colors, spacing, radius } = EMAIL_DESIGN;

// Tenant brand via the canvas theme vars, with the email default inlined as the
// fallback. Foreground/accent/fonts are brand-derived (the email brand-service
// maps them); muted is the fixed email token, exactly like the primitive.
const FG = `var(--color-base-content, ${colors.textPrimary})`;
const FONT_HEADING = `var(--font-heading, ${EMAIL_DESIGN.fontFamily})`;
const FONT_BODY = `var(--font-sans, ${EMAIL_DESIGN.fontFamily})`;
const PRIMARY = `var(--color-primary, ${colors.brand})`;
const PRIMARY_FG = `var(--color-primary-content, ${colors.textInverse})`;
const BORDER = `var(--color-border, ${colors.border})`;

// The palette the email-safe class compiler (`emailStyleFor`, Email v2 §3.6c)
// resolves a node's color tokens against, for the CANVAS. It mirrors the leaf's own
// brand source above — the silica theme vars with the EMAIL_DESIGN fallback — so a
// class-set color (`text-primary`, `bg-base-200`) tracks the live theme exactly like
// the built-in colors do, and the documented site-theme-vs-email-brand caveat applies
// uniformly (no NEW divergence). The non-color axes the compiler emits (size, weight,
// spacing, alignment, border, radius) are concrete and identical to the real send.
// The send's analog is `classStyleFor(class, brand)` in @wizeworks/email's render path.
export const CANVAS_EMAIL_PALETTE: EmailPalette = {
  primary: PRIMARY,
  primaryForeground: PRIMARY_FG,
  accent: `var(--color-accent, ${colors.brand})`,
  background: `var(--color-base-100, ${colors.surface})`,
  foreground: FG,
  muted: `var(--color-base-200, ${colors.surfaceMuted})`,
  border: BORDER,
};

/** A Heading at the email scale. The renderer collapses h2/h3 to the subheading
 *  size — only h1 is the display heading — so mirror that here for an exact match. */
export function EmailHeadingLeaf({
  level,
  children,
  style,
}: {
  level: 'h1' | 'h2' | 'h3';
  children: React.ReactNode;
  /** Builder class-compiled overrides (Email v2), merged LAST so an author's
   *  size/weight/color/alignment wins over the email default — matching the send. */
  style?: React.CSSProperties;
}) {
  const scale = level === 'h1' ? typography.heading : typography.subheading;
  const Tag = level === 'h1' ? 'h1' : 'h2';
  return (
    <Tag
      style={{
        ...scale,
        color: FG,
        fontFamily: FONT_HEADING,
        margin: `0 0 ${spacing.sm}px`,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/** body → paragraph; eyebrow/meta → the muted, smaller chrome (the renderer's
 *  EmailParagraph vs EmailMuted split). */
export function EmailTextLeaf({
  variant,
  children,
  style,
}: {
  variant: 'body' | 'eyebrow' | 'meta';
  children: React.ReactNode;
  /** Builder class-compiled overrides (Email v2), merged last. */
  style?: React.CSSProperties;
}) {
  if (variant === 'body') {
    return (
      <p
        style={{
          ...typography.body,
          color: FG,
          fontFamily: FONT_BODY,
          margin: `0 0 ${spacing.md}px`,
          ...style,
        }}
      >
        {children}
      </p>
    );
  }
  return (
    <p
      style={{
        ...typography.muted,
        color: colors.textMuted,
        fontFamily: FONT_BODY,
        margin: `${spacing.md}px 0 0`,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/** The accent button — the email's filled primary CTA (the canvas never fires its
 *  action, so a styled span is enough, matching how other canvas buttons render). */
export function EmailButtonLeaf({
  children,
  style,
}: {
  children: React.ReactNode;
  /** Builder class-compiled overrides (Email v2), merged last — an author can recolor
   *  or resize the CTA from its class while the layout/hit-area defaults remain. */
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        backgroundColor: PRIMARY,
        color: PRIMARY_FG,
        borderRadius: radius.button,
        fontSize: typography.body.fontSize,
        fontWeight: 500,
        padding: '10px 18px',
        textDecoration: 'none',
        display: 'inline-block',
        fontFamily: FONT_BODY,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** A hairline rule at the email's rhythm (matches the primitive's color + margin). */
export function EmailDividerLeaf() {
  return (
    <hr style={{ border: 0, borderTop: `1px solid ${BORDER}`, margin: `${spacing.lg}px 0` }} />
  );
}

// Header wordmark size token → px (logo height + name font scale from this). Mirrors
// @wizeworks/email's render-email-tree mapping so the canvas preview and the send agree.
const WORDMARK_SIZE_PX: Record<string, number> = { sm: 18, md: 22, lg: 28 };

/** The editable email HEADER (docs/52 §1) at the email scale — the brand wordmark
 *  the merchant edits in /builder/email, mirroring @wizeworks/email's `EmailWordmark` +
 *  the trailing divider. CONTENT (logo + store name) comes from the active brand
 *  (the canvas frame's sender identity, threaded as `emailBrand`); the node carries
 *  only the TREATMENT/align/size. Each treatment degrades gracefully (logo with no
 *  logo → name; lockup with one part → that part). */
export function EmailWordmarkLeaf({
  treatment = 'lockup',
  align = 'left',
  size = 'md',
  logoUrl,
  name,
}: {
  treatment?: 'lockup' | 'logo' | 'name';
  align?: 'left' | 'center';
  size?: 'sm' | 'md' | 'lg';
  logoUrl?: string | null;
  name?: string | null;
}) {
  const px = WORDMARK_SIZE_PX[size] ?? 22;
  const hasLogo = Boolean(logoUrl);
  const hasName = Boolean(name);
  const wantLogo = treatment !== 'name' && hasLogo;
  const wantName = treatment !== 'logo' && hasName;
  const showLogo = wantLogo;
  const showName = wantName || !wantLogo;
  return (
    <>
      <div style={{ textAlign: align }}>
        {showLogo && logoUrl ? (
          <img
            src={logoUrl}
            alt={name ?? ''}
            style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              height: Math.round(px * 1.4),
              maxHeight: Math.round(px * 1.6),
              width: 'auto',
              ...(showName ? { marginRight: 8 } : {}),
            }}
          />
        ) : null}
        {showName ? (
          <span
            style={{
              fontFamily: FONT_HEADING,
              fontSize: px,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: FG,
              verticalAlign: 'middle',
            }}
          >
            {name}
          </span>
        ) : null}
      </div>
      <EmailDividerLeaf />
    </>
  );
}

/** Authored rich text serialized to HTML, wrapped in the email body base so prose
 *  inherits the email's font/size/color — headings keep the browser's own sizing,
 *  exactly like the real send (no <style> block to lean on). */
export function EmailProseLeaf({ html, style }: { html: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{ ...typography.body, color: FG, fontFamily: FONT_BODY, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** A resolved cell value as text — mirrors the renderer's `asText`. */
function cellText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

/** The order/cart/quote/invoice line-item table — name · qty · amount, a compact
 *  three-column layout at the email body scale, mirroring @wizeworks/email's
 *  `LineItemTable` (docs/93). Rows are the resolved collection; the canvas passes
 *  representative sample rows when nothing is bound, so the structure always shows. */
export function EmailLineItemsLeaf({ items }: { items: Record<string, unknown>[] }) {
  const cell: React.CSSProperties = {
    ...typography.body,
    color: FG,
    fontFamily: FONT_BODY,
    padding: '8px 0',
    verticalAlign: 'top',
  };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {items.map((item, i) => {
          const name = cellText(item.name) || cellText(item.description);
          const qty = cellText(item.quantity);
          const amount = cellText(item.lineTotal) || cellText(item.unitPrice);
          return (
            <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ ...cell, textAlign: 'left' }}>{name}</td>
              <td style={{ ...cell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {qty ? `× ${qty}` : ''}
              </td>
              <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>{amount}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
