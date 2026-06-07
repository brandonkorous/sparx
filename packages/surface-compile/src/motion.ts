// Reduced-motion is the DEFAULT posture (docs/61 §9).
//
// This baseline neutralizes animation + transition under the OS "reduce motion"
// setting so motion is accessible by default; an author opts a specific element
// back IN with Tailwind's `motion-safe:` variant, never the other way around.
// The render layer (live site + editor canvas) includes this once, alongside the
// compiled tenant stylesheet — it is render-surface CSS, not per-tenant compiled.

export const REDUCED_MOTION_CSS =
  '@media (prefers-reduced-motion: reduce){*,::before,::after{' +
  'animation-duration:.001ms !important;animation-iteration-count:1 !important;' +
  'transition-duration:.001ms !important;scroll-behavior:auto !important}}';
