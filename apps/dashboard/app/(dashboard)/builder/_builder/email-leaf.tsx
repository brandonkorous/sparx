// Email-faithful leaf rendering for the Builder CANVAS (docs/52, docs/93).
//
// The page/site canvas renders leaves through @sparx/site-ui so the preview
// matches the LIVE SITE. An email never renders through site-ui — it renders
// through @sparx/email's table-based primitives at a FIXED pixel scale (20px
// headings, 14px body, a single accent button). Reusing the site-ui
// Heading/Text/Button for an email is the wrong yardstick: it paints the
// storefront's hero sizes + the tenant's (often serif) heading font, so the email
// canvas read "like crap" — oversized, nothing like an inbox message.
//
// These components reproduce the @sparx/email primitives as REAL DOM, driven by
// the SAME `EMAIL_DESIGN` tokens the renderer inlines on send — so the SCALE
// (sizes, weights, spacing, radius, the accent CTA) is an exact match. Brand-
// derived values (text/accent color, fonts) read the tenant theme `.bx-canvas`
// exposes as `--st-*` vars; the EMAIL_DESIGN values are the inlined fallback when
// no brand is compiled (matching @sparx/email's `defaultBrand`).
//
// CAVEAT: the true send resolves its brand via email-platform's brand-service —
// the DEFAULT preset overlaid with the tenant's brand identity — whereas these
// vars carry the tenant's SITE theme. They agree on identity-level brand (primary,
// any brand-set fonts), but a tenant whose chosen SITE theme contributes a heading
// font / hairline color the email default doesn't can see that one axis shift
// between this preview and the send. Closing that needs the email canvas to be
// themed from the resolved email brand (a separate, deliberate change).

import * as React from 'react';
import { EMAIL_DESIGN } from '@sparx/builder-schemas';

const { typography, colors, spacing, radius } = EMAIL_DESIGN;

// Tenant brand via the canvas theme vars, with the email default inlined as the
// fallback. Foreground/accent/fonts are brand-derived (the email brand-service
// maps them); muted is the fixed email token, exactly like the primitive.
const FG = `var(--st-base-content, ${colors.textPrimary})`;
const FONT_HEADING = `var(--st-font-heading, ${EMAIL_DESIGN.fontFamily})`;
const FONT_BODY = `var(--st-font-body, ${EMAIL_DESIGN.fontFamily})`;
const PRIMARY = `var(--st-primary, ${colors.brand})`;
const PRIMARY_FG = `var(--st-primary-content, ${colors.textInverse})`;
const BORDER = `var(--st-border, ${colors.border})`;

/** A Heading at the email scale. The renderer collapses h2/h3 to the subheading
 *  size — only h1 is the display heading — so mirror that here for an exact match. */
export function EmailHeadingLeaf({
  level,
  children,
}: {
  level: 'h1' | 'h2' | 'h3';
  children: React.ReactNode;
}) {
  const scale = level === 'h1' ? typography.heading : typography.subheading;
  const Tag = level === 'h1' ? 'h1' : 'h2';
  return (
    <Tag style={{ ...scale, color: FG, fontFamily: FONT_HEADING, margin: `0 0 ${spacing.sm}px` }}>
      {children}
    </Tag>
  );
}

/** body → paragraph; eyebrow/meta → the muted, smaller chrome (the renderer's
 *  EmailParagraph vs EmailMuted split). */
export function EmailTextLeaf({
  variant,
  children,
}: {
  variant: 'body' | 'eyebrow' | 'meta';
  children: React.ReactNode;
}) {
  if (variant === 'body') {
    return (
      <p
        style={{
          ...typography.body,
          color: FG,
          fontFamily: FONT_BODY,
          margin: `0 0 ${spacing.md}px`,
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
      }}
    >
      {children}
    </p>
  );
}

/** The accent button — the email's filled primary CTA (the canvas never fires its
 *  action, so a styled span is enough, matching how other canvas buttons render). */
export function EmailButtonLeaf({ children }: { children: React.ReactNode }) {
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
// @sparx/email's render-email-tree mapping so the canvas preview and the send agree.
const WORDMARK_SIZE_PX: Record<string, number> = { sm: 18, md: 22, lg: 28 };

/** The editable email HEADER (docs/52 §1) at the email scale — the brand wordmark
 *  the merchant edits in /builder/email, mirroring @sparx/email's `EmailWordmark` +
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
export function EmailProseLeaf({ html }: { html: string }) {
  return (
    <div
      style={{ ...typography.body, color: FG, fontFamily: FONT_BODY }}
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
 *  three-column layout at the email body scale, mirroring @sparx/email's
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
