// Forge generator — brand palette + the manifest's brand/theme fragments. Colors come
// straight from docs/mockups/examples/500designs.html so the semantic surfaces resolve
// to its exact tones. `brand` + `theme` are spread into the manifest verbatim (no node()
// calls here — pure data).
//
// Forge is a DARK, warm near-black studio site — the inverse of Mosaic's white page. It
// is authored the same way: the `presentation.light` palette is simply painted with the
// mockup's near-black surfaces (a dark default with no theme toggle), and the brand
// "look" carries the acid-green primary. Design-specific decoration (the gradient
// project thumbs, the ember category accent) bakes as `bg-[#…]` classes in the page
// modules — Mosaic's bento precedent — so it reads identically regardless of the
// installing tenant's theme, while the surfaces + primary re-theme on a fork.

// ── Warm near-black brand palette (from the mockup) ───────────────────────────────

export const NIGHT = '#1A1611'; // base-100 — the warm near-black page canvas
export const NIGHTER = '#121009'; // base-200 (subtle) — the recessed alternating bands
export const COAL = '#0B0A07'; // the deepest well — footer + showcase visual panel
export const PANEL = '#221D16'; // card surface (work / process / testimonial cards)
export const LINE = '#2B2620'; // border / base-300 hairlines (warm, low-contrast)
export const CREAM = '#ECE7DD'; // neutral — headings + on-dark light type, cream buttons
export const SAND = '#C9C3B6'; // base-content — body copy
export const DUST = '#8E887B'; // muted/tertiary text (eyebrows, captions, meta)
export const INK = '#15120D'; // text ON acid / cream (the dark foreground)
export const ACID = '#C6F24E'; // primary — the acid-green accent (CTAs, slash, glows)
export const ACIDSOFT = '#D9FB7A'; // primary hover tint
export const EMBER = '#FF6A3D'; // accent — a warm pop used on one project category

// ── Project-thumb gradient palette (the design's PLAYFUL interior colors) ──────────
// These are NOT theme roles — they're baked as `bg-[linear-gradient(...)]` / `bg-[#…]`
// classes on the faux case-study thumbnails so the gallery reads identically regardless
// of the installing tenant's theme (the brand itself is warm-black + acid; the color
// lives only inside the work thumbnails, exactly like Mosaic's bento tiles).
export const THUMB = {
  acid: ACID,
  ember: EMBER,
  sky: '#5C97E8',
  fuchsia: '#D957C8',
  forest: '#1F2B1A',
  rust: '#3A1D12',
  steel: '#15233A',
  plum: '#2A1538',
} as const;

// ── Manifest brand + theme ──────────────────────────────────────────────────────

export const brand = {
  businessName: 'Forge',
  tagline: 'Impactful brands & websites. Engineered growth.',
  colors: {
    primary: ACID,
    primaryForeground: INK,
    accent: EMBER,
    secondary: CREAM,
  },
  fonts: { heading: 'Space Grotesk', body: 'Sora' },
  // The "/" slash mark (logo.ts) — a self-contained SVG data URI. The installer sets it
  // as the site identity logo (Wordmark, header + footer) and the favicon. Drawn as an
  // acid slash on the warm-black square so it reads on the dark header AND the footer —
  // the slash is the design's signature device (it also marks every section heading).
  logoLightAssetId: 'brand-logo',
  faviconAssetId: 'brand-favicon',
  // Example social handles seeded into the site's per-site links so the footer's
  // SocialLinks renders out of the box (the tenant swaps these). Only platforms with a
  // brand glyph are seeded here; Dribbble lives as a plain footer text link.
  socials: [
    { platform: 'instagram', url: 'https://instagram.com/forge.studio' },
    { platform: 'x', url: 'https://x.com/forgestudio' },
    { platform: 'linkedin', url: 'https://linkedin.com/company/forgestudio' },
  ],
};

export const theme = {
  name: 'Forge',
  basePresetKey: 'apex',
  // Presentation overlay (docs/33) — the SURFACE palette, taken straight from the
  // mockup. Forge is a dark site, so the `light` (default) palette is painted with the
  // warm near-black surfaces: page = night, `subtle` = nighter (the recessed bands),
  // `inverse` = the acid contact band, cards = panel (baked per-node), body text = sand,
  // headings = cream (baked per-node), warm hairline borders.
  presentation: {
    v: 2,
    containerWidth: '1280px',
    light: {
      base100: NIGHT,
      base200: NIGHTER,
      base300: LINE,
      baseContent: SAND,
      neutral: CREAM,
      neutralContent: INK,
      border: LINE,
    },
  },
  brand: {
    colorPrimary: ACID,
    colorPrimaryForeground: INK,
    colorAccent: EMBER,
    colorSecondary: CREAM,
    fontHeading: 'Space Grotesk',
    fontBody: 'Sora',
    // Shape (docs/33 §3) — the mockup's soft 12px fields + 24px card/panel radius. The
    // pill CTAs force `rounded-full` per-button in media.ts (a button shouldn't drag the
    // field radius to 9999px and round the contact inputs too).
    tokens: {
      shape: {
        radiusSelector: '0.75rem',
        radiusField: '0.75rem',
        radiusBox: '1.5rem',
      },
    },
  },
  apply: true,
};
