import type { CSSProperties } from 'react';

// Shared section-heading scale for the v2 story landing. silicaui's own
// `.display` class tops out at a fixed 3rem (48px) — right for app UI, too
// small to read as a hero-adjacent story beat — so every section heading here
// overrides `fontSize` on top of the real `<Heading size="display">`
// component (which still supplies the font family, weight, tracking and
// balance). Capped a notch below the hero's clamp(56px, 11vw, 132px) so the
// scale reads as one family without competing with the hero.
export const SECTION_DISPLAY_STYLE: CSSProperties = {
  fontSize: 'clamp(40px, 6vw, 88px)',
  lineHeight: 0.98,
  margin: 0,
};
