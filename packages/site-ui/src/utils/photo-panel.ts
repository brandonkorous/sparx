// PhotoPanel — a STYLE HELPER, not a component (docs/46 §5.2, confirmed by
// team-lead). The Builder's box→CSS engine owns structure (it already emits the
// outer/inner elements with box styles); this returns the {background, color}
// the engine composes onto the box for a photo panel: a full-bleed image with a
// legibility scrim and an independent text tone. Mirrors the site
// renderer's `bgProps` + `SCRIM` + `TONE` exactly, so the migration is a
// like-for-like swap (parity baseline).
//
// The scrim/tone values are documented legibility constants (veils over an
// ARBITRARY photo, not tenant-brand colors) — the same exception class as the
// --sf-overlay-* button scrims (docs/46 §4.1). The box-background scrim adopts
// theme tokens in a later pass; for now these match the renderer verbatim.

import type * as React from 'react';

/** Scrim laid over a photo panel for text legibility (a veil over an ARBITRARY
 *  photo, not a tenant-brand color). Owned by the Surface library — independent of
 *  the Builder's authoring vocabulary. */
export type Overlay = 'none' | 'dark' | 'light' | 'gradient';
/** Text color over a photo panel, independent of the surface tokens. */
export type TextTone = 'default' | 'light' | 'dark';

const SCRIM: Record<Overlay, string | null> = {
  none: null,
  dark: 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))',
  light: 'linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55))',
  gradient:
    'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.04) 28%, rgba(0,0,0,0.04) 62%, rgba(0,0,0,0.6))',
};

const TONE: Record<TextTone, string | undefined> = {
  default: undefined,
  light: '#ffffff',
  dark: '#0b0b0c',
};

export interface PhotoPanelInput {
  /** Full-bleed background image URL. Absent → the surface color is used. */
  image?: string;
  /** Scrim laid over the image for text legibility. Defaults to `none`. */
  overlay?: Overlay;
  /** Text color over the panel, independent of surface. Defaults to `default`
   *  (inherit the surface foreground). */
  tone?: TextTone;
  /** Color used when there's no image (the box's resolved `surface` color). */
  surfaceBg?: string;
}

/** The CSS the box element should carry: the photo (scrim layered above) or the
 *  surface color, plus the tone text color when set. */
export function photoPanelStyle({
  image,
  overlay = 'none',
  tone = 'default',
  surfaceBg,
}: PhotoPanelInput): React.CSSProperties {
  const color = TONE[tone];
  if (!image) {
    return { background: surfaceBg ?? 'transparent', ...(color ? { color } : {}) };
  }
  const url = `url("${image.replace(/["\\]/g, '')}")`;
  const scrim = SCRIM[overlay];
  return {
    backgroundImage: scrim ? `${scrim}, ${url}` : url,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    ...(color ? { color } : {}),
  };
}
