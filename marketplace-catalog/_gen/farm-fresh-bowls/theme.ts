// Farm Fresh generator — brand palette + the manifest's brand/theme fragments.
// Colors come straight from docs/mockups/examples/farmfreshbowls.html so the semantic
// surfaces resolve to its exact tones. `brand` + `theme` are spread into the manifest
// verbatim (no node() calls here — pure data).

// ── Brand palette (from the mockup) ─────────────────────────────────────────────

export const LEAF = '#5C7A3D'; // primary green
export const MOSS = '#3E5C2A'; // deep green
export const CREAM = '#FBF8F1'; // page background / on-primary text
export const BERRY = '#C8324B'; // accent (CTAs, prices)
export const MANGO = '#F2A93B'; // secondary warm
export const SAGE = '#E8EEDF'; // base-200 (subtle): "we really do care" + testimonials bands
export const SAND = '#F3ECDE'; // base-300 (muted)
export const INK = '#2E3424'; // neutral (inverse): announcement, "how it works", footer
export const BODY = '#54513F'; // base-content (body copy)

// The mockup's `.card`: a WHITE shell that lifts off the cream page on a soft
// shadow + hairline border (the page itself is cream/base-100, so a bare card
// would melt into it — the white + shadow is what makes a card read as a card).
// The 28px corner already comes from the Card type's `rounded-box`.
export const CARD_CLS = 'bg-white shadow-lg border border-base-300';

// ── Manifest brand + theme ──────────────────────────────────────────────────────

export const brand = {
  businessName: 'Farm Fresh',
  tagline: 'Here to deliver health.',
  colors: {
    primary: LEAF,
    primaryForeground: CREAM,
    accent: BERRY,
    secondary: MANGO,
  },
  fonts: { heading: 'Quicksand', body: 'Nunito' },
  // Example social handles the install seeds into the site's per-site links so the
  // footer's SocialLinks renders icons out of the box (the tenant swaps these, like
  // the placeholder imagery). Platform keys map to brand icons in @sparx/site-ui.
  socials: [
    { platform: 'instagram', url: 'https://instagram.com/farmfreshbowls' },
    { platform: 'facebook', url: 'https://facebook.com/farmfreshbowls' },
    { platform: 'x', url: 'https://x.com/farmfreshbowls' },
    { platform: 'tiktok', url: 'https://tiktok.com/@farmfreshbowls' },
  ],
};

export const theme = {
  name: 'Farm Fresh',
  basePresetKey: 'market',
  // Presentation overlay (docs/33) — the SURFACE palette, taken straight from the
  // mockup so the semantic surfaces resolve to its exact colors: page = cream,
  // `subtle` = sage (the "we really do care" / testimonials bands), `inverse` =
  // ink (announcement, "how it works", footer), text = the warm ink body color.
  presentation: {
    v: 2,
    containerWidth: '1180px',
    light: {
      base100: CREAM,
      base200: SAGE,
      base300: SAND,
      baseContent: BODY,
      neutral: INK,
      neutralContent: CREAM,
      border: '#E7E0D0',
    },
  },
  brand: {
    colorPrimary: LEAF,
    colorPrimaryForeground: CREAM,
    colorAccent: BERRY,
    colorSecondary: MANGO,
    fontHeading: 'Quicksand',
    fontBody: 'Nunito',
    // Shape (docs/33 §3) — pill buttons/inputs/chips (9999px) + the mockup's exact
    // 28px (1.75rem) card/panel/media radius. `radiusBox` also rounds media, so the
    // emoji photo panels pick up the same corner.
    tokens: {
      shape: {
        radiusSelector: '9999px',
        radiusField: '9999px',
        radiusBox: '1.75rem',
      },
    },
  },
  apply: true,
};
