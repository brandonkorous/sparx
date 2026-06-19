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
// per-tenant compiled stylesheet. The author classes it powers — `st-reveal`,
// `st-reveal--<token>`, `st-reveal-stagger` (+ `--bold`) — are NOT Tailwind
// utilities, so the per-tenant compile emits nothing for them; their CSS lives
// here and matches the classes the renderer applies verbatim to the one styled
// element per node. Self-contained @keyframes so it never depends on the compile
// emitting the `--animate-*` theme vars (which tree-shake on use).
//
// The hidden initial state is gated on `html.st-anim-ready`, set before paint
// ONLY when motion is allowed (a tiny script in the render layer) — so with JS
// off, or under prefers-reduced-motion, nothing is ever hidden (no FOUC, no CLS).
// The MotionController island flips `.st-in` as each element scrolls into view.

/** Entrance token (matches the inspector + the compile-theme `--animate-*` set)
 *  → the `animation` shorthand it plays once in view. */
const REVEAL_TOKENS: Record<string, string> = {
  'fade-in': 'st-fade-in 0.5s ease-out both',
  'fade-up': 'st-fade-up 0.6s ease-out both',
  'fade-down': 'st-fade-down 0.6s ease-out both',
  'scale-in': 'st-scale-in 0.4s ease-out both',
  'slide-in-left': 'st-slide-in-left 0.5s ease-out both',
  'slide-in-right': 'st-slide-in-right 0.5s ease-out both',
};

/** Direct children that get a sequenced delay; beyond this they share the last step. */
const STAGGER_MAX = 12;

function staggerRules(modifier: string, step: number): string {
  const sel = `html.st-anim-ready .st-reveal-stagger${modifier}.st-in > *`;
  let css = `${sel}{animation:st-fade-up 0.6s ease-out both}`;
  for (let i = 1; i <= STAGGER_MAX; i++) {
    css += `${sel}:nth-child(${i}){animation-delay:${(i - 1) * step}ms}`;
  }
  return css;
}

const REVEAL_KEYFRAMES =
  '@keyframes st-fade-in{from{opacity:0}to{opacity:1}}' +
  '@keyframes st-fade-up{from{opacity:0;transform:translateY(1rem)}to{opacity:1;transform:none}}' +
  '@keyframes st-fade-down{from{opacity:0;transform:translateY(-1rem)}to{opacity:1;transform:none}}' +
  '@keyframes st-scale-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}' +
  '@keyframes st-slide-in-left{from{opacity:0;transform:translateX(-1.5rem)}to{opacity:1;transform:none}}' +
  '@keyframes st-slide-in-right{from{opacity:0;transform:translateX(1.5rem)}to{opacity:1;transform:none}}';

export const SCROLL_MOTION_CSS =
  REVEAL_KEYFRAMES +
  // Resting (hidden) state for any single reveal element, gated on readiness.
  'html.st-anim-ready .st-reveal:not(.st-in){opacity:0}' +
  // Default entrance when no token modifier is present.
  'html.st-anim-ready .st-reveal.st-in{animation:st-fade-in 0.5s ease-out both}' +
  // Per-token entrances (later in source order than the default → they win at equal specificity).
  Object.entries(REVEAL_TOKENS)
    .map(([token, anim]) => `html.st-anim-ready .st-reveal--${token}.st-in{animation:${anim}}`)
    .join('') +
  // Container stagger: direct children start hidden, then fade-up in sequence on `.st-in`.
  'html.st-anim-ready .st-reveal-stagger > *,html.st-anim-ready .st-reveal-stagger--bold > *{opacity:0}' +
  staggerRules('', 80) +
  staggerRules('--bold', 140);

// Hover-interaction effects (docs/61 §9 — the hover counterpart to scroll entrances).
//
// A named, one-click hover EFFECT library: the `st-hover--<token>` class a node wears
// to animate a PERSISTENT :hover state (lift, grow, glow, …). This is distinct from the
// entrance system's `hover:animate-<token>`, which fires a ONE-SHOT keyframe on
// hover-IN; an effect is a state the element HOLDS while hovered and eases back on
// hover-out — the card-lift idiom every mature page builder ships. Like the reveal
// tokens these are NOT Tailwind utilities (the per-tenant compile emits nothing for
// them), so their CSS ships ONCE in the render layer beside SCROLL_MOTION_CSS and
// matches the class names verbatim — on the live site, the draft preview, AND the
// editor canvas (all three pull the one RENDER_LAYER_CSS in surface-css-service).
//
// Reduced motion: a hover MOVEMENT (translate / scale / tilt) is gated on
// `prefers-reduced-motion: no-preference`, so a reduced-motion visitor gets none of it;
// a non-motion cue (shadow / brightness) stays, so hover still gives feedback. The
// shared REDUCED_MOTION_CSS additionally flattens the transition, so that cue is
// instant rather than animated. Brand-aware: the shadow tints off the tenant
// `--st-neutral` / `--st-primary` root vars, so each tenant's hover reads on-brand.

/** Hover-effect token → its human label. The single source of truth shared by the
 *  render CSS below, the inspector's Hover-effect picker, and the Builder MCP
 *  vocabulary, so all three name the SAME set. */
export const HOVER_EFFECTS: { value: string; label: string }[] = [
  { value: 'lift', label: 'Lift' },
  { value: 'grow', label: 'Grow' },
  { value: 'sink', label: 'Press' },
  { value: 'glow', label: 'Glow' },
  { value: 'brighten', label: 'Brighten' },
  { value: 'tilt', label: 'Tilt' },
];

const HOVER_SELECTOR_ALL = HOVER_EFFECTS.map((e) => `.st-hover--${e.value}`).join(',');

export const HOVER_MOTION_CSS =
  // One shared transition for every effect element (transform + shadow + filter).
  `${HOVER_SELECTOR_ALL}{transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}` +
  // Non-motion :hover cues (shadow / brightness) — safe under reduced motion.
  '.st-hover--lift:hover{box-shadow:0 24px 48px -20px color-mix(in oklab,var(--st-neutral,#1f2937) 32%,transparent)}' +
  '.st-hover--sink:hover{box-shadow:0 6px 16px -10px color-mix(in oklab,var(--st-neutral,#1f2937) 36%,transparent)}' +
  '.st-hover--glow:hover{box-shadow:0 0 0 1px color-mix(in oklab,var(--st-primary) 35%,transparent),0 18px 44px -16px color-mix(in oklab,var(--st-primary) 50%,transparent)}' +
  '.st-hover--brighten:hover{filter:brightness(1.06)}' +
  // Movement :hover cues (translate / scale / tilt) — only when motion is allowed.
  '@media (prefers-reduced-motion:no-preference){' +
  '.st-hover--lift:hover{transform:translateY(-4px)}' +
  '.st-hover--grow:hover{transform:scale(1.03)}' +
  '.st-hover--sink:hover{transform:translateY(2px) scale(.985)}' +
  '.st-hover--tilt:hover{transform:perspective(900px) rotateX(2.5deg) rotateY(-2.5deg)}' +
  '}';
