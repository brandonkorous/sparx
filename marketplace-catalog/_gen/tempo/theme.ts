// Tempo generator — brand palette + the manifest's brand/theme fragments. Colors come
// straight from docs/mockups/examples/adidas.html so the semantic surfaces resolve to
// its exact tones. `brand` + `theme` are spread into the manifest verbatim (no node()
// calls here — pure data).
//
// Tempo is a STARK black-on-white sportswear site: a white page, near-black ink type
// and CTAs (adidas CTAs are black, not colored), with a sale red + a club green as the
// only chromatic roles. The PLAYFUL campaign color (the team-color hero, the colorway
// tiles, the editorial gradients) is NOT a theme role — it bakes as `bg-[#…]` classes in
// the page modules (Mosaic's bento precedent), so it reads identically regardless of the
// installing tenant's theme while the surfaces + primary re-theme on a fork.

// ── Stark brand palette (from the mockup) ─────────────────────────────────────────

export const INK = '#111111'; // near-black — primary, neutral (inverse), body headings
export const PAPER = '#ffffff'; // page background / on-dark text
export const SOFT = '#f5f5f5'; // base-200 (subtle): product-card + tile wells
export const HAIRLINE = '#e3e3e3'; // border + base-300 hairlines
export const GRAY = '#767677'; // muted/secondary text (captions, meta, nav utility)
export const SALE = '#e3251f'; // accent — sale tags, strike-through prices
export const CLUB = '#1c6b3e'; // secondary — the membership ("club") band green
export const CLUBDARK = '#13502e'; // a deeper club green (hover / gradient floor)

// ── Campaign palette (the design's PLAYFUL interior colors) ───────────────────────
// These are NOT theme roles — they're baked as `bg-[#…]` / gradient classes in the hero
// + colorway tiles + editorial panels so the campaign reads identically regardless of
// the installing tenant's theme (the brand itself is just black + white + red + green;
// color lives only inside the campaign tiles, exactly like Mosaic's bento).
export const CAMPAIGN = {
  blue: '#1d4ed8', // the jersey / "team color" blue
  royal: '#0a0d2b', // the deep hero backdrop navy
  gold: '#facc15', // the hero kit gold
  amber: '#f59e0b',
  crimson: '#b91c1c',
  green: '#15803d',
  teal: '#0e7490',
  violet: '#6d28d9',
  pink: '#db2777',
  rust: '#a16207',
} as const;

// ── Manifest brand + theme ──────────────────────────────────────────────────────

export const brand = {
  businessName: 'Tempo',
  tagline: 'Built to move.',
  colors: {
    primary: INK,
    primaryForeground: PAPER,
    accent: SALE,
    secondary: CLUB,
  },
  fonts: { heading: 'Archivo', body: 'Inter' },
  // The "»" motion-mark (logo.ts) — a self-contained SVG data URI. The installer sets it
  // as the site identity logo (Wordmark, header + footer) and the favicon. Drawn as two
  // skewed ink chevron bars on a transparent square so it reads on the white header AND
  // (inverted) the ink footer. The motion-mark is Tempo's signature device — it stamps
  // every campaign tile in place of the mockup's trademarked three-stripes.
  logoLightAssetId: 'brand-logo',
  faviconAssetId: 'brand-favicon',
  // Example social handles seeded into the site's per-site links so the footer's
  // SocialLinks renders out of the box (the tenant swaps these). The mockup footer
  // carries Facebook, Instagram, X, YouTube.
  socials: [
    { platform: 'instagram', url: 'https://instagram.com/tempo' },
    { platform: 'facebook', url: 'https://facebook.com/tempo' },
    { platform: 'x', url: 'https://x.com/tempo' },
    { platform: 'youtube', url: 'https://youtube.com/@tempo' },
  ],
};

export const theme = {
  name: 'Tempo',
  basePresetKey: 'drop',
  // Presentation overlay (docs/33) — the SURFACE palette, taken straight from the
  // mockup so the semantic surfaces resolve to its exact colors: page = paper white,
  // `subtle` = soft gray (the product-card + tile wells), `inverse` = ink (the dark
  // editorial banner + footer), text = near-black ink, hairline borders. Container is
  // the mockup's 1480px `max-w-shell`.
  presentation: {
    v: 2,
    containerWidth: '1480px',
    light: {
      base100: PAPER,
      base200: SOFT,
      base300: HAIRLINE,
      baseContent: INK,
      neutral: INK,
      neutralContent: PAPER,
      border: HAIRLINE,
    },
  },
  brand: {
    colorPrimary: INK,
    colorPrimaryForeground: PAPER,
    colorAccent: SALE,
    colorSecondary: CLUB,
    fontHeading: 'Archivo',
    fontBody: 'Inter',
    // Shape (docs/33 §3) — adidas is HARD-EDGED: square cards/panels and rectangular
    // CTAs/inputs. Everything is radius 0, the strongest single structural signal of
    // the stark sportswear voice (the inverse of Farm Fresh's pills + Mosaic's 16px).
    tokens: {
      shape: {
        radiusSelector: '0',
        radiusField: '0',
        radiusBox: '0',
      },
    },
  },
  apply: true,
};
