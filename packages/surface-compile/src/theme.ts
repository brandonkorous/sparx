// The Surface tenant-flavored Tailwind theme entrypoint (docs/47 §5.2).
//
// This is the CSS the per-tenant compile runs against. It pulls in Tailwind's
// default theme + the full utility set, then REMAPS the color / type / shape /
// effect / rhythm theme tokens onto the tenant `--st-*` vars. So a utility a
// power user authored — `bg-base-100`, `text-primary-content`, `rounded-box`,
// `gap-6`, `shadow-md` — compiles to a rule that references `--st-*`, and the
// generated tenant.css themes off exactly the tokens the storefront sets at
// `:root` (via @sparx/site-themes). No baked color ever reaches the output.
//
// Isolation (docs/47 §5.2): because this @theme lives in THIS package's compile
// — never in the dashboard's Tailwind content — the same utility names that map
// to the admin `--color-*` palette in the dashboard map to `--st-*` here, with
// no chance of cross-contamination.
//
// Preflight is intentionally NOT imported: the tenant stylesheet is a delta
// layered over the storefront's own reset, exactly like @sparx/site-ui's build.

export const SURFACE_THEME_CSS = `
@layer theme, base, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);

@theme {
  /* ── Color — every bg-/text-/border- utility resolves to a tenant --st-* var ── */
  --color-base-100: var(--st-base-100);
  --color-base-200: var(--st-base-200);
  --color-base-300: var(--st-base-300);
  --color-base-content: var(--st-base-content);
  --color-primary: var(--st-primary);
  --color-primary-content: var(--st-primary-content);
  --color-secondary: var(--st-secondary);
  --color-secondary-content: var(--st-secondary-content);
  --color-accent: var(--st-accent);
  --color-accent-content: var(--st-accent-content);
  --color-neutral: var(--st-neutral);
  --color-neutral-content: var(--st-neutral-content);
  --color-info: var(--st-info);
  --color-info-content: var(--st-info-content);
  --color-success: var(--st-success);
  --color-success-content: var(--st-success-content);
  --color-warning: var(--st-warning);
  --color-warning-content: var(--st-warning-content);
  --color-danger: var(--st-danger);
  --color-danger-content: var(--st-danger-content);
  --color-highlight: var(--st-highlight);
  --color-highlight-content: var(--st-highlight-content);
  --color-border: var(--st-border);

  /* ── Type — font-heading / font-body ── */
  --font-heading: var(--st-font-heading);
  --font-body: var(--st-font-body);

  /* ── Shape — rounded-box / rounded-field / rounded-selector ── */
  --radius-box: var(--st-radius-box);
  --radius-field: var(--st-radius-field);
  --radius-selector: var(--st-radius-selector);

  /* ── Effect — shadow-sm / shadow-md / shadow-lg ── */
  --shadow-sm: var(--st-shadow-sm);
  --shadow-md: var(--st-shadow-md);
  --shadow-lg: var(--st-shadow-lg);

  /* ── Rhythm — the whole numeric spacing scale (p-*, gap-*, m-*, w-*, h-*)
        tracks the tenant base unit, so it reflows with --st-space-base. ── */
  --spacing: var(--st-space-base, 0.25rem);

  /* ── Layout — max-w-site off the tenant container width. The container-query
        breakpoint scale (@sm … @7xl) ships from the default theme; container
        queries key off the node's OWN width, not the viewport (docs/61 §7). ── */
  --container-site: var(--st-container);

  /* ── Motion — animate-spin/ping/pulse/bounce ship from the default theme;
        these are Surface's custom entrance animations (docs/61 §9): animate-fade-in,
        animate-fade-up, animate-scale-in, … . The reduced-motion baseline
        (REDUCED_MOTION_CSS, motion.ts) neutralizes them under the OS "reduce
        motion" setting, so motion is accessible by default. ── */
  --animate-fade-in: fade-in 0.5s ease-out both;
  --animate-fade-up: fade-up 0.6s ease-out both;
  --animate-fade-down: fade-down 0.6s ease-out both;
  --animate-scale-in: scale-in 0.4s ease-out both;
  --animate-slide-in-left: slide-in-left 0.5s ease-out both;
  --animate-slide-in-right: slide-in-right 0.5s ease-out both;

  /* ── Motion library (docs/98 Pillar 4) — the platform-owned CONTINUOUS
        animations a tenant reaches from the Motion card, instead of authoring raw
        \`@keyframes\` (denied). Each bakes a sensible default tempo; the Motion card
        can retune duration via the allowlisted \`[animation-duration:_s]\` utility.
        All loop \`infinite\` and self-return (0%→50%→100%) so they cycle smoothly,
        and the reduced-motion baseline (motion.ts) neutralizes them by default. ── */
  --animate-marquee: marquee 22s linear infinite;
  --animate-marquee-reverse: marquee-reverse 22s linear infinite;
  --animate-marquee-vertical: marquee-vertical 22s linear infinite;
  --animate-float: float 4s ease-in-out infinite;
  --animate-bob: bob 2.4s ease-in-out infinite;
  --animate-ken-burns: ken-burns 18s ease-in-out infinite;
  --animate-spin-slow: spin-slow 9s linear infinite;
  --animate-pulse-soft: pulse-soft 3s ease-in-out infinite;
  --animate-wiggle: wiggle 1.6s ease-in-out infinite;
  --animate-shimmer: shimmer 2.2s linear infinite;
}

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-up { from { opacity: 0; transform: translateY(1rem); } to { opacity: 1; transform: translateY(0); } }
@keyframes fade-down { from { opacity: 0; transform: translateY(-1rem); } to { opacity: 1; transform: translateY(0); } }
@keyframes scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes slide-in-left { from { opacity: 0; transform: translateX(-1.5rem); } to { opacity: 1; transform: translateX(0); } }
@keyframes slide-in-right { from { opacity: 0; transform: translateX(1.5rem); } to { opacity: 1; transform: translateX(0); } }

/* ── Motion-library keyframes (docs/98 Pillar 4). The marquee pair translate by
      -50%/+50%, which is exactly right for a track that DUPLICATES its content
      (the carousel/marquee behavior + the comprehensive composites render two
      copies), so the loop is seamless. The rest self-return so \`infinite\` cycles
      with no jump. ── */
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes marquee-reverse { from { transform: translateX(-50%); } to { transform: translateX(0); } }
@keyframes marquee-vertical { from { transform: translateY(0); } to { transform: translateY(-50%); } }
@keyframes float { 0% { transform: translateY(0); } 50% { transform: translateY(-0.5rem); } 100% { transform: translateY(0); } }
@keyframes bob { 0% { transform: translateY(0); } 50% { transform: translateY(-0.25rem); } 100% { transform: translateY(0); } }
@keyframes ken-burns { 0% { transform: scale(1) translate(0, 0); } 50% { transform: scale(1.08) translate(-1%, -1%); } 100% { transform: scale(1) translate(0, 0); } }
@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse-soft { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
@keyframes wiggle { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes shimmer { from { background-position: -150% 0; } to { background-position: 250% 0; } }

/* ── Navbar — a real component: a div with the \`navbar\` class that HAS three
      zones, navbar-start / navbar-center / navbar-end (docs/98 §5). Verbatim
      from daisyUI's navbar.css (our breadth reference): the two SIDE zones are
      \`width: 50%\` — start justifies its content to the left, end to the right —
      and the center is \`flex-shrink: 0\` BETWEEN them, so center content lands
      dead-center regardless of how much sits on either side. There is no
      "centered brand" variant: centering the wordmark is just putting it in
      \`.navbar-center\`.

      Authored in the \`components\` layer (declared before \`utilities\`), so author
      utilities always win — \`bg-base-100\`/\`border-b\` skin it, \`hidden @3xl:flex\`
      collapses a zone responsively, \`px-*\`/\`gap-*\` retune spacing. Content
      spacing (gap) lives on the composed tree, not here, exactly like daisyUI. ── */
@layer components {
  .navbar {
    position: relative;
    display: flex;
    width: 100%;
    align-items: center;
    min-height: 4rem;
    padding: 0.5rem;
  }
  .navbar-start {
    display: inline-flex;
    align-items: center;
    width: 50%;
    justify-content: flex-start;
  }
  .navbar-center {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }
  .navbar-end {
    display: inline-flex;
    align-items: center;
    width: 50%;
    justify-content: flex-end;
  }
}

/* ── Extended bounded z-scale (docs/98 Pillar 4d). Tailwind ships z-0…z-50;
      these add a few higher NAMED rungs for sanctioned stacking (a sticky nav over
      content, a guarded-fixed bar over that). Arbitrary \`z-[9999]\` stays denied by
      the allowlist — the scale is bounded on purpose. \`@utility\` so they tree-shake
      on use. ── */
@utility z-60 { z-index: 60; }
@utility z-70 { z-index: 70; }
@utility z-80 { z-index: 80; }

/* ── Guarded fixed positioning (docs/98 Pillar 4c). Raw \`fixed\` is denied by the
      allowlist (clickjacking); these platform classes are the ONLY sanctioned
      \`position: fixed\` emitter, chosen by the Position control. Each pins to ONE
      edge or corner with a capped cross-axis, so NONE can become a full-viewport
      \`inset: 0\` overlay over the app/site chrome — the anti-clickjacking invariant
      (docs/98 §3.1). Edge bars span their axis but are height/width-capped;
      corners are anchored + size-capped (FAB / cookie card / toast). ── */
@layer components {
  .st-fixed-top { position: fixed; top: 0; inset-inline: 0; max-height: 50vh; }
  .st-fixed-bottom { position: fixed; bottom: 0; inset-inline: 0; max-height: 50vh; }
  .st-fixed-left { position: fixed; left: 0; inset-block: 0; max-width: 33vw; }
  .st-fixed-right { position: fixed; right: 0; inset-block: 0; max-width: 33vw; }
  .st-fixed-tl { position: fixed; top: 0; left: 0; max-width: 90vw; max-height: 90vh; }
  .st-fixed-tr { position: fixed; top: 0; right: 0; max-width: 90vw; max-height: 90vh; }
  .st-fixed-bl { position: fixed; bottom: 0; left: 0; max-width: 90vw; max-height: 90vh; }
  .st-fixed-br { position: fixed; bottom: 0; right: 0; max-width: 90vw; max-height: 90vh; }
}
`;
