import * as React from 'react';

// "Made with sparx" — the platform attribution credit that floats in the bottom
// corner of every tenant public site (apps/site mounts it as un-deletable shell
// chrome, NOT a BuilderNode). Fixed-position and blended (transparent at rest, no
// box, no band) so it reads as part of the site's own chrome rather than a
// tacked-on section below the footer.
//
// Constraints that keep it safe to drop onto ANY tenant site:
//
//  1. SELF-CONTAINED COLOR. Tenant sites are scoped to their own `--st-*` theme
//     and do NOT load @sparx/ui's tokens.css, so `--sparx-primary` won't resolve
//     there. The indigo "x" is therefore the literal hex; everything else rides
//     `currentColor` (the site's own ink), so it stays legible on a light or dark
//     theme without knowing the surface behind it.
//
//  2. BRANDED ANCHOR. The link's accessible name is the BRAND ("Made with sparx"),
//     never keyword-stuffed. A branded credit link across many distinct domains is
//     a clean attribution/referral signal; a keyword-rich one at that scale reads
//     as link-spam. Keeping the anchor branded is the one guardrail that matters.
//
// Server component (no client JS): the base look is inline styles (which beat any
// tenant stylesheet), and a colocated <style> adds the rest→hover affordance.

// sparx Indigo, as a literal — see constraint (1) above.
const SPARX_INDIGO = '#6366F1';

// Attribution destination: the marketing home, UTM-tagged so referral clicks from
// tenant sites are measurable (referral traffic + brand exposure is the real value
// of this badge, not link equity).
const DEFAULT_HREF =
  'https://sparx.works/?utm_source=powered_by&utm_medium=site_badge&utm_campaign=made_with_sparx';

// Rest = quiet and blended (no chip); hover/focus = full opacity + a whisper of a
// currentColor chip as the affordance. Padding is constant so the chip doesn't
// shift the text on hover.
const STYLE = `
.sx-made-with-sparx {
  opacity: 0.68;
  transition:
    opacity 0.16s ease,
    background-color 0.16s ease;
}
.sx-made-with-sparx:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 7%, transparent);
}
.sx-made-with-sparx:focus-visible {
  opacity: 1;
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
  /** Text size in px. Default 13. */
  size?: number;
  /** Which bottom corner to anchor to. Default 'right'; the storefront flips this
   *  to 'left' when the chat launcher (also fixed bottom-right) is enabled. */
  placement?: 'right' | 'left';
}

export function MadeWithSparx({
  href = DEFAULT_HREF,
  size = 13,
  placement = 'right',
}: MadeWithSparxProps) {
  return (
    <>
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
          position: 'fixed',
          bottom: 12,
          ...(placement === 'left' ? { left: 14 } : { right: 14 }),
          zIndex: 40,
          display: 'inline-flex',
          alignItems: 'center',
          gap: Math.round(size * 0.32),
          padding: `${Math.round(size * 0.35)}px ${Math.round(size * 0.6)}px`,
          borderRadius: 999,
          color: 'inherit',
          fontSize: size,
          lineHeight: 1,
          textDecoration: 'none',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontWeight: 500 }}>Made with</span>
        <span style={{ fontWeight: 700, letterSpacing: '-0.03em' }}>
          spar<span style={{ color: SPARX_INDIGO }}>x</span>
        </span>
      </a>
    </>
  );
}
