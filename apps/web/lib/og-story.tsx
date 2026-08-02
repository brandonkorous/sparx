import { ImageResponse } from 'next/og';
import { BRAND, MODULE_HEX, type ModuleKey } from '@sparx/brand';
import type { StoryState } from '@sparx/story-schemas';
import { storyTokens, type Token } from '@/components/marketing/landing-v3/story-tokens';
import { ModuleStrip } from '@/components/marketing/module-strip';
import { PAID_MODULES } from '@/components/marketing/modules-catalog';
import { OgWordmark } from './og-wordmark';

// The "your story, multiplied" social card — the marketing hero's told story,
// frozen. Rather than a generic headline, the card shows the actual first thing a
// new owner does (the module-tinted clause sentence resolving to a live address),
// which is the one image on the site nobody else's card could be.
//
// It renders from the SAME grammar the hero types (`storyTokens` in
// landing-v3/story-tokens) so the card and the homepage can never drift. The one
// thing that grammar can't carry onto an OG card is its `color-mix()` tints —
// satori resolves neither CSS custom properties nor `color-mix()` — so we bake a
// literal hue off each chip's `mod` key from `MODULE_HEX` (the single TS source in
// @sparx/brand, the sanctioned literal-hex context). Same reason the wordmark is
// the real vector via <OgWordmark> and the module strip reads MODULE_HEX.

export const OG_SIZE = { width: 1200, height: 630 } as const;

const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Prose between the chips + the address, in a legible (never faded) grey ink. */
const PROSE_INK = '#c7cbde';
/** The tense-verb chip and the address box — a neutral, not a module hue. */
const NEUTRAL_BG = 'rgba(255, 255, 255, 0.09)';
const NEUTRAL_INK = '#eef0f7';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** The chip FILL — the module hue at a low alpha over the navy, the baked
 *  equivalent of the hero's `color-mix(module 14%, transparent)`. */
function fill(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toHex(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');
}

/** The chip INK — the module hue lifted toward white so it reads on the dark
 *  fill, the baked equivalent of `color-mix(module 58%, base-content)`. */
function lift(hex: string, t: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r + t * (255 - r))}${toHex(g + t * (255 - g))}${toHex(b + t * (255 - b))}`;
}

function chipColors(mod?: string): { bg: string; ink: string } {
  const hex = mod && mod !== 'neutral' ? (MODULE_HEX as Record<string, string>)[mod] : undefined;
  if (!hex) return { bg: NEUTRAL_BG, ink: NEUTRAL_INK };
  return { bg: fill(hex, 0.18), ink: lift(hex, 0.62) };
}

/** Perceptual luminance 0–1, for deciding how far a hue must be lifted to read. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A module hue lifted to carry a big headline word on the navy. The lift is
 *  luminance-ADAPTIVE, not fixed: a dark/desaturated hue (B2B slate, Builder
 *  indigo) needs far more lift than an already-bright one (Commerce orange) — a
 *  flat lift left slate reading as greyed-out. We raise each hue to a common
 *  lightness target so every module's "multiplied." reads as a deliberate accent.
 *  A module OG card tints "multiplied." in its own hue; platform cards keep ember. */
export function moduleHeadlineHue(mod: ModuleKey): string {
  const hex = (MODULE_HEX as Record<string, string>)[mod];
  if (!hex) return BRAND.primary;
  const target = 0.62;
  const t = Math.min(0.5, Math.max(0.12, (target - luminance(hex)) / (1 - luminance(hex))));
  return lift(hex, t);
}

/** One inline element per story token. Spacing + punctuation live INSIDE the text
 *  tokens (the grammar already emits ' for ', ' and ', '. I’ll ', …), so the row
 *  uses no column gap and `whiteSpace: 'pre'` keeps those spaces — that way a
 *  comma or period hugs the chip before it while words still get their space. */
function tokenEl(tok: Token, key: number) {
  if (tok.t === 'wbr') return null;
  if (tok.t === 'text') {
    return (
      <span key={key} style={{ color: PROSE_INK, whiteSpace: 'pre' }}>
        {tok.s}
      </span>
    );
  }
  const colors = tok.t === 'box' ? { bg: NEUTRAL_BG, ink: NEUTRAL_INK } : chipColors(tok.mod);
  return (
    <span
      key={key}
      style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: colors.bg,
        color: colors.ink,
        padding: '3px 15px',
        borderRadius: 11,
        fontWeight: 500,
        whiteSpace: 'pre',
      }}
    >
      {tok.t === 'chip' && tok.icon ? (
        <span
          style={{
            display: 'flex',
            width: 9,
            height: 9,
            borderRadius: 9999,
            backgroundColor: colors.ink,
            marginRight: 8,
          }}
        />
      ) : null}
      {tok.s}
    </span>
  );
}

export function renderStoryOg({
  story,
  headline,
  accentColor = BRAND.primary,
  footerRight = 'sparx.works',
}: {
  story: StoryState;
  /** Two-line headline: `lead` in white, `accent` in `accentColor`. */
  headline: { lead: string; accent: string };
  /** Colour of the headline's second line. Brand ember by default; a module card
   *  passes its own hue via `moduleHeadlineHue`. */
  accentColor?: string;
  /** Bottom-right label — the page's canonical URL. */
  footerRight?: string;
}): ImageResponse {
  const toks = storyTokens(story);

  // A longer story (a 7-module grocer vs a 4-module salon) needs smaller type to
  // stay inside 630px under the headline. Scale by how many chips/boxes it tells —
  // the salon's 7 hold 30px cleanly; past that we step down so nothing clips.
  const chipCount = toks ? [...toks.body].filter((t) => t.t === 'chip' || t.t === 'box').length : 0;
  const storyFont = chipCount <= 7 ? 30 : chipCount <= 9 ? 26 : 23;
  const storyRowGap = storyFont >= 30 ? 14 : 12;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: BRAND.ink,
        padding: '72px',
        fontFamily: SYSTEM_FONT,
      }}
    >
      {/* Top: the real vector wordmark */}
      <div style={{ display: 'flex' }}>
        <OgWordmark height={38} />
      </div>

      {/* Middle: headline + the told story + the live address */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontWeight: 700,
            fontSize: 90,
            lineHeight: 0.96,
            letterSpacing: '-0.035em',
          }}
        >
          <div style={{ display: 'flex', color: '#ffffff' }}>{headline.lead}</div>
          <div style={{ display: 'flex', color: accentColor }}>{headline.accent}</div>
        </div>

        {toks ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 0,
              rowGap: storyRowGap,
              maxWidth: 1050,
              fontSize: storyFont,
              fontWeight: 400,
            }}
          >
            {toks.body.map((tok, i) => tokenEl(tok, i))}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#8b93b3', fontSize: 27, marginRight: 14, whiteSpace: 'pre' }}>
            Find me at
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: NEUTRAL_BG,
              color: NEUTRAL_INK,
              padding: '4px 16px',
              borderRadius: 11,
              fontWeight: 500,
              fontSize: 26,
            }}
          >
            {story.name}
          </span>
          <span style={{ color: '#c3c7d8', fontSize: 26, whiteSpace: 'pre' }}>.sparx.zone</span>
        </div>
      </div>

      {/* Bottom: module strip + footer rule */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 26,
          borderTop: '1px solid rgba(255, 255, 255, 0.09)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontWeight: 500,
              fontSize: 14,
              color: '#5a628a',
            }}
          >
            {PAID_MODULES.length} modules
          </span>
          <ModuleStrip size={28} gap={9} wrap={false} modules={PAID_MODULES} />
        </div>
        <span style={{ fontSize: 18, color: '#5a628a' }}>{footerRight}</span>
      </div>
    </div>,
    { ...OG_SIZE }
  );
}
