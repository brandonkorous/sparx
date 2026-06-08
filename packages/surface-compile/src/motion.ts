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

// Scroll-reveal entrance motion (docs/61 §9).
//
// The render layer ships this ONCE (live site + editor canvas), alongside the
// per-tenant compiled stylesheet. The author classes it powers — `sf-reveal`,
// `sf-reveal--<token>`, `sf-reveal-stagger` (+ `--bold`) — are NOT Tailwind
// utilities, so the per-tenant compile emits nothing for them; their CSS lives
// here and matches the classes the renderer applies verbatim to the one styled
// element per node. Self-contained @keyframes so it never depends on the compile
// emitting the `--animate-*` theme vars (which tree-shake on use).
//
// The hidden initial state is gated on `html.sf-anim-ready`, set before paint
// ONLY when motion is allowed (a tiny script in the render layer) — so with JS
// off, or under prefers-reduced-motion, nothing is ever hidden (no FOUC, no CLS).
// The MotionController island flips `.sf-in` as each element scrolls into view.

/** Entrance token (matches the inspector + the compile-theme `--animate-*` set)
 *  → the `animation` shorthand it plays once in view. */
const REVEAL_TOKENS: Record<string, string> = {
  'fade-in': 'sf-fade-in 0.5s ease-out both',
  'fade-up': 'sf-fade-up 0.6s ease-out both',
  'fade-down': 'sf-fade-down 0.6s ease-out both',
  'scale-in': 'sf-scale-in 0.4s ease-out both',
  'slide-in-left': 'sf-slide-in-left 0.5s ease-out both',
  'slide-in-right': 'sf-slide-in-right 0.5s ease-out both',
};

/** Direct children that get a sequenced delay; beyond this they share the last step. */
const STAGGER_MAX = 12;

function staggerRules(modifier: string, step: number): string {
  const sel = `html.sf-anim-ready .sf-reveal-stagger${modifier}.sf-in > *`;
  let css = `${sel}{animation:sf-fade-up 0.6s ease-out both}`;
  for (let i = 1; i <= STAGGER_MAX; i++) {
    css += `${sel}:nth-child(${i}){animation-delay:${(i - 1) * step}ms}`;
  }
  return css;
}

const REVEAL_KEYFRAMES =
  '@keyframes sf-fade-in{from{opacity:0}to{opacity:1}}' +
  '@keyframes sf-fade-up{from{opacity:0;transform:translateY(1rem)}to{opacity:1;transform:none}}' +
  '@keyframes sf-fade-down{from{opacity:0;transform:translateY(-1rem)}to{opacity:1;transform:none}}' +
  '@keyframes sf-scale-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}' +
  '@keyframes sf-slide-in-left{from{opacity:0;transform:translateX(-1.5rem)}to{opacity:1;transform:none}}' +
  '@keyframes sf-slide-in-right{from{opacity:0;transform:translateX(1.5rem)}to{opacity:1;transform:none}}';

export const SCROLL_MOTION_CSS =
  REVEAL_KEYFRAMES +
  // Resting (hidden) state for any single reveal element, gated on readiness.
  'html.sf-anim-ready .sf-reveal:not(.sf-in){opacity:0}' +
  // Default entrance when no token modifier is present.
  'html.sf-anim-ready .sf-reveal.sf-in{animation:sf-fade-in 0.5s ease-out both}' +
  // Per-token entrances (later in source order than the default → they win at equal specificity).
  Object.entries(REVEAL_TOKENS)
    .map(([token, anim]) => `html.sf-anim-ready .sf-reveal--${token}.sf-in{animation:${anim}}`)
    .join('') +
  // Container stagger: direct children start hidden, then fade-up in sequence on `.sf-in`.
  'html.sf-anim-ready .sf-reveal-stagger > *,html.sf-anim-ready .sf-reveal-stagger--bold > *{opacity:0}' +
  staggerRules('', 80) +
  staggerRules('--bold', 140);
