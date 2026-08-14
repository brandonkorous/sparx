import { ImageResponse } from 'next/og';
import {
  BRAND,
  ICON_BODY_PATH,
  ICON_NOSTRIL_PATHS,
  ICON_SNOUT_OPACITY,
  ICON_SNOUT_PATH,
  ICON_VIEWBOX,
  WORDMARK_ASPECT,
  WORDMARK_DOT_PATH,
  WORDMARK_LETTER_PATHS,
  WORDMARK_VIEWBOX,
} from '@piggles/brand';

// The social card for every Piggles page.
//
// Until this existed, sharing any of the nineteen pages produced a bare link —
// which matters more here than on most sites, because the satellite domains
// exist to be shared and linked and the card is the first thing a person sees of
// the brand.
//
// ── LITERAL COLOUR AND INLINE STYLE ARE CORRECT HERE, AND ONLY HERE ─────────
//
// satori resolves neither CSS custom properties nor class names — it renders a
// small subset of flexbox from inline `style` objects and nothing else. So an OG
// route is the sanctioned exception to BOTH the no-literal-colour rule and the
// no-inline-`style` rule (root CLAUDE.md RULE #1; `apps/web/lib/og-*.tsx` is the
// same shape for sparx). It is an exception because there is no alternative, not
// because rendering an image is special.
//
// Colours still come from `@piggles/brand`'s `BRAND` / `GROUP_HEX` constants
// rather than being typed in, so a brand change lands in one file and every card
// follows. **Never write a hex literal in this file.**
//
// ── WHY THIS IS LIGHT AND SPARX'S IS NEAR-BLACK ─────────────────────────────
//
// sparx renders its cards on `#0A0A0A`: confident, technical, cold. Piggles is
// warm off-white with dark ink and one pink. Two brands competing for the same
// customer must not produce cards that look like the same company, and the card
// is the most-shared single artefact either brand has — so this is the one place
// where "looks different from sparx" is a functional requirement rather than a
// preference.
//
// The mark and wordmark are the REAL vector lockups from `@piggles/brand`, not
// type set in a fallback font. satori renders `<svg>`/`<path>` provided the root
// element has an explicit `display`, which the wrapping `<div>` supplies.

export const OG_SIZE = { width: 1200, height: 630 } as const;

// satori needs a font it has; Nunito is not loaded at the edge and shipping the
// binary for one image is not worth the weight. The lockup carries the brand —
// the headline is set in the system stack on purpose.
const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

function Lockup({ height = 44 }: { height?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={height} height={height} viewBox={ICON_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
        <path d={ICON_BODY_PATH} fill={BRAND.primary} />
        <path d={ICON_SNOUT_PATH} fill={BRAND.primary} opacity={ICON_SNOUT_OPACITY} />
        {ICON_NOSTRIL_PATHS.map((d) => (
          <path key={d} d={d} fill={BRAND.primary} />
        ))}
      </svg>
      <svg
        width={Math.round(height * 0.72 * WORDMARK_ASPECT)}
        height={Math.round(height * 0.72)}
        viewBox={WORDMARK_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
      >
        {WORDMARK_LETTER_PATHS.map((d) => (
          <path key={d} d={d} fill={BRAND.ink} />
        ))}
        <path d={WORDMARK_DOT_PATH} fill={BRAND.primary} />
      </svg>
    </div>
  );
}

export function renderOg(opts: {
  /** The headline. Keep under ~70 characters — it steps down once and no further. */
  title: string;
  /** One supporting line. Optional, and often better left off. */
  subtitle?: string;
  /** Accent for the rule and the full stop. A group hue on an app page, the
   *  brand pink everywhere else. Pass `GROUP_HEX[group]` — never a literal. */
  accent?: string;
  /** Bottom-right. Defaults to the marketing host. */
  footer?: string;
}): ImageResponse {
  const { title, subtitle, accent = BRAND.primary, footer = 'meetpiggles.com' } = opts;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: BRAND.surfaceWarm,
        padding: '72px',
        fontFamily: SYSTEM_FONT,
      }}
    >
      <Lockup />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            fontWeight: 800,
            // Three tiers, because the two kinds of card here are very
            // different lengths. Every app page's title is its LABEL — one or
            // two words — and one word set at the sentence size leaves the
            // card looking like the headline failed to load. Sizing by length
            // rather than by page type keeps it one code path.
            fontSize: title.length <= 16 ? 132 : title.length > 46 ? 68 : 86,
            letterSpacing: '-0.03em',
            lineHeight: 1.04,
            color: BRAND.ink,
            maxWidth: 1000,
          }}
        >
          <span>{title}</span>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 9999,
              backgroundColor: accent,
              marginLeft: 8,
              marginBottom: 10,
            }}
          />
        </div>
        {subtitle ? (
          <span style={{ fontSize: 28, lineHeight: 1.4, color: BRAND.ink, maxWidth: 940 }}>
            {subtitle}
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 26,
          borderTop: `3px solid ${accent}`,
        }}
      >
        <span style={{ fontSize: 20, color: BRAND.ink }}>
          Business software for people who have a business to run
        </span>
        <span style={{ fontSize: 20, color: BRAND.ink }}>{footer}</span>
      </div>
    </div>,
    { ...OG_SIZE }
  );
}
