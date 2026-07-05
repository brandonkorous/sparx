import * as React from 'react';

// "Made with sparx" — the platform attribution badge that floats in the bottom
// corner of every tenant public site (apps/site mounts it as un-deletable shell
// chrome, NOT a BuilderNode). A small, SELF-CONTAINED "glass" pill: it carries its
// own dark surface, border, and shadow so it reads unmistakably as a discrete
// badge on any tenant background — light, colored, or dark — and looks IDENTICAL
// on every sparx site (a recognizable mark, not a theme-tinted link).
//
// Two constraints that keep it safe to drop onto ANY tenant site:
//
//  1. SELF-CONTAINED. It depends on nothing from the host theme (no `currentColor`,
//     no `--st-*`/`--sparx-*` tokens): fixed dark surface + light text + literal
//     indigo "x". So it's legible and consistent regardless of the surface behind
//     it, and immune to the tenant's CSS (inline styles beat any stylesheet).
//
//  2. BRANDED ANCHOR. The link's accessible name is the BRAND ("Made with sparx"),
//     never keyword-stuffed. A branded credit link across many distinct domains is
//     a clean attribution/referral signal; a keyword-rich one at that scale reads
//     as link-spam. Keeping the anchor branded is the one guardrail that matters.
//
// Server component (no client JS): the base look is inline styles, and a colocated
// <style> adds the hover/focus lift.

// sparx Indigo, as a literal (constraint 1). Bright enough to read on the dark chip.
const SPARX_INDIGO = '#6366F1';

// Attribution destination: the marketing home, UTM-tagged so referral clicks from
// tenant sites are measurable (referral traffic + brand exposure is the real value
// of this badge, not link equity).
const DEFAULT_HREF =
  'https://sparx.works/?utm_source=powered_by&utm_medium=site_badge&utm_campaign=made_with_sparx';

const STYLE = `
.sx-made-with-sparx {
  transition:
    background-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}
.sx-made-with-sparx:hover {
  background: rgba(24, 24, 28, 0.94) !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.26) !important;
  transform: translateY(-1px);
}
.sx-made-with-sparx:focus-visible {
  outline: 2px solid ${SPARX_INDIGO};
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .sx-made-with-sparx {
    transition: none;
  }
  .sx-made-with-sparx:hover {
    transform: none;
  }
}
/* Mobile: shrink + tuck tighter into the corner so the badge stays out of the way
   on small screens (and clears the corner if a site adds a sticky bottom bar). The
   inline base styles win over stylesheets, so these overrides carry !important. */
@media (max-width: 640px) {
  .sx-made-with-sparx {
    font-size: 11px !important;
    padding: 4px 8px !important;
    bottom: 10px !important;
  }
  .sx-made-with-sparx[data-placement='right'] {
    right: 10px !important;
  }
  .sx-made-with-sparx[data-placement='left'] {
    left: 10px !important;
  }
}
`;

export interface MadeWithSparxProps {
  /** Attribution destination. Defaults to the sparx marketing home (UTM-tagged). */
  href?: string;
  /** Text size in px. Default 12 (extra small). */
  size?: number;
  /** Which bottom corner to anchor to. Default 'right'; the storefront flips this
   *  to 'left' when the chat launcher (also fixed bottom-right) is enabled. */
  placement?: 'right' | 'left';
}

export function MadeWithSparx({
  href = DEFAULT_HREF,
  size = 12,
  placement = 'right',
}: MadeWithSparxProps) {
  return (
    <>
      <style>{STYLE}</style>
      <a
        className="sx-made-with-sparx"
        data-placement={placement}
        href={href}
        target="_blank"
        // noreferrer (implies noopener) satisfies react/jsx-no-target-blank;
        // attribution is measured via the URL's UTM params, not the Referer
        // header, so stripping the referrer costs the badge nothing.
        rel="noopener noreferrer"
        aria-label="Made with sparx"
        style={{
          position: 'fixed',
          bottom: 14,
          ...(placement === 'left' ? { left: 16 } : { right: 16 }),
          zIndex: 40,
          display: 'inline-flex',
          alignItems: 'center',
          gap: Math.round(size * 0.34),
          padding: `${Math.round(size * 0.5)}px ${Math.round(size * 0.83)}px`,
          borderRadius: 999,
          // Self-contained dark "glass" surface — reads as a badge on any background.
          // Body is lifted slightly off pure-black (0.82α over #18181c) and the
          // border is strong enough (0.22) to still define the pill on a near-black
          // tenant footer, where the fill alone would vanish into the background.
          background: 'rgba(24, 24, 28, 0.82)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow: '0 3px 14px rgba(0, 0, 0, 0.2)',
          color: '#ffffff',
          fontSize: size,
          lineHeight: 1,
          textDecoration: 'none',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.7)' }}>Made with</span>
        <span
          style={{ fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255, 255, 255, 0.96)' }}
        >
          spar<span style={{ color: SPARX_INDIGO }}>x</span>
        </span>
      </a>
    </>
  );
}
