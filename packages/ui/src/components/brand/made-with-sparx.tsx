import * as React from 'react';

import { SparxMark } from './sparx-mark';

// "Made with sparx" — the platform attribution badge that renders in the footer
// of every tenant public site (apps/site injects it as un-deletable shell chrome,
// NOT a BuilderNode). A quiet, brand-forward pill: the sparx monogram + wordmark,
// linking back to the marketing site.
//
// Two deliberate constraints make it safe to drop onto ANY tenant site:
//
//  1. SELF-CONTAINED COLOR. Tenant sites are scoped to their own `--st-*` theme
//     and do NOT load @sparx/ui's tokens.css, so `--sparx-primary` won't resolve
//     there. The indigo "x" is therefore the literal hex, and this badge is
//     sparx's brand island — the host theme must never recolor it. EVERYTHING
//     else rides `currentColor` (the footer's own ink), so the pill stays legible
//     on a white, black, or colored footer without knowing the background.
//
//  2. BRANDED ANCHOR. The link's accessible name is the BRAND ("Made with sparx"),
//     never keyword-stuffed. A branded footer link across many distinct domains is
//     a clean attribution/referral signal; a keyword-rich one at that scale reads
//     as link-spam. Keeping the anchor branded is the one guardrail that matters.
//
// Server component (no client JS): the base look is inline styles (which beat any
// tenant stylesheet), and a colocated <style> adds hover/focus polish.

// sparx Indigo, as a literal — see constraint (1) above.
const SPARX_INDIGO = '#6366F1';

// Attribution destination: the marketing home, UTM-tagged so referral clicks from
// tenant footers are measurable (referral traffic + brand exposure is the real
// value of this badge, not link equity).
const DEFAULT_HREF =
  'https://sparx.works/?utm_source=powered_by&utm_medium=site_badge&utm_campaign=made_with_sparx';

const STYLE = `
.sx-made-with-sparx {
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease;
}
.sx-made-with-sparx:hover {
  background: color-mix(in srgb, currentColor 8%, transparent) !important;
  border-color: color-mix(in srgb, currentColor 26%, transparent) !important;
}
.sx-made-with-sparx:focus-visible {
  outline: 2px solid ${SPARX_INDIGO};
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .sx-made-with-sparx {
    transition: none;
  }
}
`;

export interface MadeWithSparxProps {
  /** Attribution destination. Defaults to the sparx marketing home (UTM-tagged). */
  href?: string;
  /** Mark + text size in px. Default 13. */
  size?: number;
  /** Extra class on the outer centering strip (for placement overrides). */
  className?: string;
}

export function MadeWithSparx({ href = DEFAULT_HREF, size = 13, className }: MadeWithSparxProps) {
  return (
    <div
      className={className}
      style={{ display: 'flex', justifyContent: 'center', padding: '1.25rem 1rem' }}
    >
      <style>{STYLE}</style>
      <a
        className="sx-made-with-sparx"
        href={href}
        target="_blank"
        // noreferrer (implies noopener) satisfies react/jsx-no-target-blank;
        // attribution is measured via the URL's UTM params, not the Referer
        // header, so stripping the referrer costs the badge nothing.
        rel="noopener noreferrer"
        aria-label="Made with sparx"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: Math.round(size * 0.55),
          padding: `${Math.round(size * 0.42)}px ${Math.round(size * 0.85)}px`,
          borderRadius: 999,
          border: '1px solid color-mix(in srgb, currentColor 15%, transparent)',
          background: 'color-mix(in srgb, currentColor 4%, transparent)',
          color: 'inherit',
          fontSize: size,
          lineHeight: 1,
          textDecoration: 'none',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          whiteSpace: 'nowrap',
        }}
      >
        {/* Monogram leads in MONOCHROME (currentColor) — the one indigo spark lands
            on the wordmark's "x" below. Two indigo x's in one quiet credit read
            logo-heavy; a single spark is both calmer and the actual brand rule, and
            a mono monogram is contrast-safe on any footer (incl. colored). */}
        <SparxMark size={Math.round(size * 1.05)} accentColor="currentColor" />
        <span
          style={{ fontWeight: 500, color: 'color-mix(in srgb, currentColor 56%, transparent)' }}
        >
          Made with
        </span>
        <span style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
          spar<span style={{ color: SPARX_INDIGO }}>x</span>
        </span>
      </a>
    </div>
  );
}
