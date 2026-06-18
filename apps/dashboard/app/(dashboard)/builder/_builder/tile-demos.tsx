'use client';

// Demo renderers for the inspector's preview tiles (picker-fields.tsx). Every chip
// RENDERS the actual effect — a glyph at the real size / weight / family / tracking,
// a little box carrying the real shadow / border / ring — so the picker previews the
// result instead of naming it in a dropdown. Kept apart from picker-fields so that
// file stays the thin control surface and this stays the (data-heavy) demo table.

import * as React from 'react';

export type TileKind =
  | 'radius'
  | 'aspect'
  | 'weight'
  | 'columns'
  | 'size'
  | 'family'
  | 'shadow'
  | 'border'
  | 'borderStyle'
  | 'ring'
  | 'tracking'
  | 'leading'
  | 'blur';

// Each map keys an option VALUE (class-controls.ts) to the concrete CSS used inside
// the 34px chip. The numbers are tuned to READ at chip scale, not 1:1 with the real
// utility (a true text-6xl or blur-lg would overflow / obliterate the glyph) — the
// relative progression is what the picker communicates; the label carries the exact
// step.
const RADIUS_DEMO: Record<string, string> = {
  none: '0',
  sm: '3px',
  md: '7px',
  lg: '12px',
  pill: '999px',
};
const ASPECT_DEMO: Record<string, string> = {
  square: '1 / 1',
  video: '16 / 9',
  '4/3': '4 / 3',
  '3/4': '3 / 4',
};
const WEIGHT_DEMO: Record<string, number> = { normal: 400, medium: 500, semibold: 600, bold: 700 };
const SIZE_DEMO: Record<string, number> = {
  sm: 10,
  base: 12,
  lg: 14,
  xl: 17,
  '2xl': 20,
  '4xl': 25,
  '6xl': 30,
};
const SHADOW_DEMO: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.18)',
  md: '0 2px 5px rgba(0,0,0,0.22)',
  lg: '0 5px 12px rgba(0,0,0,0.26)',
};
const BORDER_W_DEMO: Record<string, number> = { none: 0, thin: 1, strong: 2.5 };
const RING_DEMO: Record<string, number> = { none: 0, thin: 1, medium: 2, thick: 4 };
const TRACK_DEMO: Record<string, string> = { tight: '-0.06em', normal: '0.01em', wide: '0.22em' };
const LEAD_DEMO: Record<string, number> = {
  tight: 0.9,
  snug: 1.05,
  normal: 1.3,
  relaxed: 1.55,
  loose: 1.9,
};
const BLUR_DEMO: Record<string, string> = {
  sm: 'blur(0.7px)',
  md: 'blur(1.4px)',
  lg: 'blur(2.4px)',
};

export interface TileFonts {
  heading?: string;
  body?: string;
}

// Layout-effect on the client (resolve fonts before paint, no flash), plain effect
// on the server (avoids the SSR warning) — mirrors color-swatch's canvas probe.
const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/** Resolve the tenant's heading + body font stacks by probing the live `.bx-canvas`
 *  (the same place the colour swatches read the palette). Returns {} when no canvas
 *  is mounted — the family tiles then fall back to the inspector's own font. Only
 *  probes when `enabled` (the Font-family tiles are the sole caller that needs it). */
export function useCanvasFonts(enabled = true): TileFonts {
  const [fonts, setFonts] = React.useState<TileFonts>({});
  useIsoLayoutEffect(() => {
    if (!enabled) return;
    const canvas = document.querySelector('.bx-canvas');
    if (!canvas) return;
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
    canvas.appendChild(probe);
    const read = (v: string): string | undefined => {
      probe.style.fontFamily = `var(${v})`;
      return getComputedStyle(probe).fontFamily || undefined;
    };
    const out: TileFonts = { heading: read('--font-heading'), body: read('--font-body') };
    probe.remove();
    setFonts(out);
  }, [enabled]);
  return fonts;
}

/** A column-count preview — `n` vertical bars (or the wrap glyph for 'fluid'). */
export function columnsDemo(value: string): React.ReactNode {
  if (value === 'fluid') return <span className="bx-ptile__cols" data-fluid="true" />;
  const n = Math.min(6, Math.max(1, Number(value) || 1));
  return (
    <span className="bx-ptile__cols">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

/** Tailwind `ring` is an OFFSET outline (a gap, then the ring) — a double box-shadow
 *  (surface-coloured gap + the ring) reads distinctly from a plain border. */
function ringShadow(px: number): string {
  if (!px) return 'none';
  return `0 0 0 1.5px var(--color-bg-subtle), 0 0 0 ${1.5 + px}px var(--tile-ink)`;
}

/** The inner demo node for every non-radius kind (radius rounds the chip itself). */
function tileInner(kind: TileKind, value: string, fonts: TileFonts): React.ReactNode {
  switch (kind) {
    case 'aspect':
      return (
        <span className="bx-ptile__demo" style={{ aspectRatio: ASPECT_DEMO[value] ?? '1 / 1' }} />
      );
    case 'weight':
      return (
        <span className="bx-ptile__aa" style={{ fontWeight: WEIGHT_DEMO[value] ?? 400 }}>
          Aa
        </span>
      );
    case 'columns':
      return columnsDemo(value);
    case 'size':
      return (
        <span className="bx-ptile__aa" style={{ fontSize: SIZE_DEMO[value] ?? 13 }}>
          A
        </span>
      );
    case 'family':
      return (
        <span
          className="bx-ptile__aa"
          style={{
            fontFamily: value === 'heading' ? fonts.heading : fonts.body,
            fontWeight: value === 'heading' ? 600 : 400,
            fontSize: 16,
          }}
        >
          Ag
        </span>
      );
    case 'shadow':
      return <span className="bx-ptile__box" style={{ boxShadow: SHADOW_DEMO[value] ?? 'none' }} />;
    case 'border':
      return <span className="bx-ptile__box" style={{ borderWidth: BORDER_W_DEMO[value] ?? 0 }} />;
    case 'borderStyle':
      return <span className="bx-ptile__box" style={{ borderStyle: value, borderWidth: 2 }} />;
    case 'ring':
      return (
        <span className="bx-ptile__box" style={{ boxShadow: ringShadow(RING_DEMO[value] ?? 0) }} />
      );
    case 'tracking':
      return (
        <span className="bx-ptile__aa" style={{ letterSpacing: TRACK_DEMO[value] ?? '0' }}>
          Aa
        </span>
      );
    case 'leading':
      return (
        <span className="bx-ptile__lines" style={{ lineHeight: LEAD_DEMO[value] ?? 1.3 }}>
          {'Ag\nAg'}
        </span>
      );
    case 'blur':
      return (
        <span className="bx-ptile__aa" style={{ filter: BLUR_DEMO[value] ?? 'none' }}>
          Ag
        </span>
      );
    default:
      return null;
  }
}

/** Resolve a kind + value to the chip's inner demo and any style applied to the chip
 *  itself. Only corners round the chip (it reads as a real button at that radius);
 *  every other kind fills a centred inner demo and leaves the chip frame alone. */
export function renderTileDemo(
  kind: TileKind,
  value: string,
  fonts: TileFonts
): { inner: React.ReactNode; chipStyle: React.CSSProperties } {
  if (kind === 'radius') {
    return { inner: null, chipStyle: { borderRadius: RADIUS_DEMO[value] ?? '4px' } };
  }
  return { inner: tileInner(kind, value, fonts), chipStyle: {} };
}
