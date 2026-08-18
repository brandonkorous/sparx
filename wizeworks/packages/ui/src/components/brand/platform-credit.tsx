import * as React from 'react';

// The platform attribution badge — a small tab welded to the bottom edge of the
// viewport on every tenant public site (`wizeworks/apps/site` mounts it as
// un-deletable shell chrome, NOT a BuilderNode).
//
// ── WHY THIS IS PARAMETERIZED AND NOT A CONSTANT ───────────────────────────
//
// It was `MadeWithSparx`, with the name, the accent hex and the destination
// written into it. `wizeworks/apps/site` serves tenant sites for BOTH brands, so
// every Piggles business's public footer said "Made with sparx" — the most
// public surface in the platform, crediting a company its owner had never heard
// of and linking their visitors to it.
//
// The values now arrive from `platformBrandIdentity()`, keyed on the tenant's
// `platform_brand`. This file names no brand, which is what lets it live in
// `wizeworks/`; `@sparx/brand` re-exports it pre-filled and keeps its own call
// sites unchanged.
//
// Two constraints that keep it safe to drop onto ANY tenant site, both unchanged:
//
//  1. SELF-CONTAINED. It depends on nothing from the host theme (no
//     `currentColor`, no `--st-*` tokens): fixed dark surface + light text +
//     the accent as a literal. Legible and consistent regardless of the surface
//     behind it, and immune to the tenant's CSS (inline styles beat any
//     stylesheet).
//
//  2. BRANDED ANCHOR. The link's accessible name is the BRAND ("Made with X"),
//     never keyword-stuffed. A branded credit link across many distinct domains
//     is a clean attribution signal; a keyword-rich one at that scale reads as
//     link-spam. Keeping the anchor branded is the one guardrail that matters.
//
// Server component (no client JS): the base look is inline styles, and a
// colocated <style> adds the hover/focus lift.

export interface PlatformCreditProps {
  /** The product's name, as a person reads it. */
  name: string;
  /** Attribution destination — the brand's marketing home, UTM-tagged by the
   *  caller so referral clicks from tenant sites are measurable. */
  href: string;
  /** The brand's accent, as a literal hex (constraint 1 — no tokens here). */
  accentColor: string;
  /** How many TRAILING characters of `name` wear the accent. sparx sets 1 for
   *  its Ember "x"; 0 renders the name in one weight, which is right for a name
   *  whose last letter means nothing in particular. */
  accentChars?: number;
  /** Text size in px. Default 12 (extra small). */
  size?: number;
  /** Which bottom corner to anchor to. Default 'right'; the storefront flips
   *  this to 'left' when the chat launcher (also fixed bottom-right) is on. */
  placement?: 'right' | 'left';
}

export function PlatformCredit({
  name,
  href,
  accentColor,
  accentChars = 0,
  size = 12,
  placement = 'right',
}: PlatformCreditProps) {
  const split = Math.min(Math.max(accentChars, 0), name.length);
  const stem = split > 0 ? name.slice(0, name.length - split) : name;
  const tail = split > 0 ? name.slice(name.length - split) : '';

  // Scoped to the accent so two brands' badges can't collide in one stylesheet
  // — which cannot happen today, but a global class name that encodes one
  // brand's colour is how it would start.
  const style = `
.wz-platform-credit {
  transition:
    background-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}
.wz-platform-credit:hover {
  background: rgba(24, 24, 28, 0.94) !important;
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.28) !important;
}
.wz-platform-credit:focus-visible {
  outline: 2px solid ${accentColor};
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .wz-platform-credit { transition: none; }
  .wz-platform-credit:hover { transform: none; }
}
/* Mobile: shrink + tuck tighter into the corner so the badge stays out of the
   way on small screens (and clears the corner if a site adds a sticky bottom
   bar). Stays flush with bottom: 0 so it still reads as welded to the viewport
   edge. The inline base styles win over stylesheets, so these carry !important. */
@media (max-width: 640px) {
  .wz-platform-credit {
    font-size: 11px !important;
    padding: 4px 8px 5px !important;
    bottom: 0 !important;
  }
  .wz-platform-credit[data-placement='right'] { right: 10px !important; }
  .wz-platform-credit[data-placement='left'] { left: 10px !important; }
}
`;

  return (
    <>
      <style>{style}</style>
      <a
        className="wz-platform-credit"
        data-placement={placement}
        href={href}
        target="_blank"
        // noreferrer (implies noopener) satisfies react/jsx-no-target-blank;
        // attribution is measured via the URL's UTM params, not the Referer
        // header, so stripping the referrer costs the badge nothing.
        rel="noopener noreferrer"
        aria-label={`Made with ${name}`}
        style={{
          position: 'fixed',
          // Flush with the viewport edge (no gap beneath) so it reads as welded
          // to the bottom of the browser rather than a pill floating above.
          bottom: 0,
          ...(placement === 'left' ? { left: 16 } : { right: 16 }),
          zIndex: 40,
          display: 'inline-flex',
          alignItems: 'center',
          gap: Math.round(size * 0.34),
          // Extra bottom padding vs. top: with no rounded bottom corners to give
          // the text breathing room against the edge, the pad does that job.
          padding: `${Math.round(size * 0.4)}px ${Math.round(size * 0.83)}px ${Math.round(size * 0.2)}px`,
          // Top corners only — the bottom stays square and flush, like a tab
          // welded to the browser edge instead of a pill hovering above it.
          borderRadius: '10px 10px 0 0',
          // Self-contained dark "glass" surface — reads as a badge on any
          // background. Body is lifted off pure-black (0.82α over #18181c) and
          // the border is strong enough (0.22) to still define the tab on a
          // near-black tenant footer, where the fill alone would vanish.
          background: 'rgba(24, 24, 28, 0.82)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          // No bottom border — it dissolves into the viewport edge instead of
          // drawing a seam between the tab and the "browser" it is built into.
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderBottom: 'none',
          // Shadow casts upward only — there is nothing below the tab.
          boxShadow: '0 -3px 14px rgba(0, 0, 0, 0.2)',
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
          {stem}
          {tail ? <span style={{ color: accentColor }}>{tail}</span> : null}
        </span>
      </a>
    </>
  );
}
