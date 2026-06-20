// Mosaic generator — brand palette + the manifest's brand/theme fragments. Colors
// come straight from docs/mockups/examples/notion.html so the semantic surfaces
// resolve to its exact tones. `brand` + `theme` are spread into the manifest verbatim
// (no node() calls here — pure data).

// ── Near-mono brand palette (from the mockup) ─────────────────────────────────────

export const INK = '#191918'; // near-black — neutral (inverse): dark cards, monogram
export const BODY = '#37352F'; // base-content (body copy)
export const MUTED = '#73726E'; // secondary text (labels, captions)
export const FAINT = '#9B9A97'; // tertiary text (meta, footer columns)
export const CREAM = '#F6F5F3'; // base-200 (subtle): the alternating section band
export const LINE = '#EAE9E5'; // border + base-300 hairlines
export const WHITE = '#FFFFFF'; // page background / on-dark text
export const BRAND = '#2383E2'; // primary blue — CTAs, links

// ── Bento accent palette (the design's PLAYFUL interior colors) ───────────────────
// These are NOT theme roles — they're baked as `bg-[#…]` classes in the bento tiles
// so they read identically regardless of the installing tenant's theme (the brand
// itself is just black + blue; color lives only inside the mosaic tiles).
export const BENTO = {
  yellow: '#FFC93C',
  coral: '#EF6F5C',
  blue: '#5C97E8',
  teal: '#1F9E8F',
  brown: '#A9744F',
  navy: '#211F33',
  lime: '#C8F2C2',
  limeDot: '#2E9E4F',
  limeText: '#1E7A38',
} as const;

// ── Manifest brand + theme ──────────────────────────────────────────────────────

export const brand = {
  businessName: 'Mosaic',
  tagline: 'The AI workspace that works for you.',
  colors: {
    primary: BRAND,
    primaryForeground: WHITE,
    accent: BENTO.teal,
    secondary: BENTO.yellow,
  },
  fonts: { heading: 'Inter', body: 'Inter' },
  // The "M" monogram (logo.ts) — a self-contained SVG data URI. The installer sets it
  // as the site identity logo (Wordmark, header + footer) and the favicon. Drawn as a
  // white stroke on the ink square so it reads on the white header AND in the footer.
  logoLightAssetId: 'brand-logo',
  faviconAssetId: 'brand-favicon',
  // Example social handles seeded into the site's per-site links so the footer's
  // SocialLinks renders out of the box (the tenant swaps these). The mockup footer
  // carries X, LinkedIn, YouTube.
  socials: [
    { platform: 'x', url: 'https://x.com/mosaicworkspace' },
    { platform: 'linkedin', url: 'https://linkedin.com/company/mosaicworkspace' },
    { platform: 'youtube', url: 'https://youtube.com/@mosaicworkspace' },
  ],
};

export const theme = {
  name: 'Mosaic',
  basePresetKey: 'apex',
  // Presentation overlay (docs/33) — the SURFACE palette, taken straight from the
  // mockup so the semantic surfaces resolve to its exact colors: page = white,
  // `subtle` = cream (the alternating section bands), `inverse` = ink (the dark
  // cards / "create your own" tile), text = the warm ink body color, hairline borders.
  presentation: {
    v: 2,
    containerWidth: '1024px',
    light: {
      base100: WHITE,
      base200: CREAM,
      base300: '#EDEBE7',
      baseContent: BODY,
      neutral: INK,
      neutralContent: WHITE,
      border: LINE,
    },
  },
  brand: {
    colorPrimary: BRAND,
    colorPrimaryForeground: WHITE,
    colorAccent: BENTO.teal,
    colorSecondary: BENTO.yellow,
    fontHeading: 'Inter',
    fontBody: 'Inter',
    // Shape (docs/33 §3) — the mockup's 8px (0.5rem) buttons/fields + 16px (1rem)
    // card/panel radius. `radiusBox` rounds cards/surfaced panels uniformly.
    tokens: {
      shape: {
        radiusSelector: '0.5rem',
        radiusField: '0.5rem',
        radiusBox: '1rem',
      },
    },
  },
  apply: true,
};
