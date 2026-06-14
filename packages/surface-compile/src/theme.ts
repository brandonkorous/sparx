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
}

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-up { from { opacity: 0; transform: translateY(1rem); } to { opacity: 1; transform: translateY(0); } }
@keyframes fade-down { from { opacity: 0; transform: translateY(-1rem); } to { opacity: 1; transform: translateY(0); } }
@keyframes scale-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes slide-in-left { from { opacity: 0; transform: translateX(-1.5rem); } to { opacity: 1; transform: translateX(0); } }
@keyframes slide-in-right { from { opacity: 0; transform: translateX(1.5rem); } to { opacity: 1; transform: translateX(0); } }
`;
