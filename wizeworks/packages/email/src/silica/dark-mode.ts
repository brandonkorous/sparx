// Dark-mode CSS for a silica email (docs/impl transactional-email §10).
//
// silica projects an email as bulletproof tables with INLINE styles + `bgcolor`
// attributes, and declares `color-scheme: light dark` in the head. Its own docs
// delegate the dark DESIGN to the host: "Apple Mail / Outlook for Mac will honor your
// own `@media (prefers-color-scheme: dark)` rules (supplied via the projector's
// head.css hook)". This builds exactly that block.
//
// There are no class hooks in the projected HTML (only `.sui-col`), so the block can't
// target elements by role directly. Instead it remaps by VALUE: for each neutral the
// LIGHT render used, a rule keyed to that exact hex (as a `bgcolor="…"` attribute or a
// `color: …` inline-style substring) overrides it to the brand's DARK-theme counterpart.
// Because the light hexes come from the SAME role map the projector paints with, the
// selectors match by construction. Brand hues that don't shift between modes, and the
// fixed semantic colors, produce no rule and are left as-is — so the ember button and
// the green "Confirmed" cue survive; only surfaces, body text, and borders flip.
//
// This aligns the email's dark mode to the tenant's SITE dark theme (the dark map is
// resolved from the same `@wizeworks/site-themes` tokens the storefront uses). Gmail and
// Outlook.com ignore `color-scheme` and force-invert regardless — treat this as
// progressive enhancement for the clients that honour it, never a guaranteed design.

import type { EmailColorDefaults } from '@wizeworks/silicaui-builder/email';

/** Where a role's color shows up in the projected HTML — a surface (`bgcolor`
 *  attribute), text/link (`color:` inline style), or a border (`border-…-color:`). */
type RenderContext = 'bg' | 'text' | 'border';

/** The roles worth remapping, and the context(s) each appears in. `primary` is both a
 *  surface (button + brand bar `bgcolor`) and a link color (footer links). Semantic
 *  roles + `primaryContent` (white button text) are intentionally absent — they must
 *  survive dark mode unchanged. */
const REMAP: { role: keyof EmailColorDefaults; contexts: RenderContext[] }[] = [
  { role: 'base100', contexts: ['bg'] },
  { role: 'base200', contexts: ['bg'] },
  { role: 'primary', contexts: ['bg', 'text'] },
  { role: 'baseContent', contexts: ['text'] },
  { role: 'accent', contexts: ['text'] },
  { role: 'base300', contexts: ['border'] },
];

/**
 * The dark remap as bare CSS rules (no `@media` wrapper), or `''` when nothing differs.
 * The send wraps these in `@media (prefers-color-scheme: dark)` (`buildDarkModeCss`); the
 * studio's dark PREVIEW applies them unconditionally, since an iframe can't be forced to
 * report a dark OS preference — so a Light/Dark toggle needs the rules ungated.
 */
export function darkModeRules(light: EmailColorDefaults, dark: EmailColorDefaults): string {
  const rules: string[] = [];
  // De-dup by (context, lightHex): two roles can share a light hex (e.g. a brand whose
  // accent === primary), and the same selector must resolve to ONE value — first wins,
  // and REMAP is ordered so the more specific role (primary before accent) does.
  const seen = new Set<string>();
  const add = (ctx: RenderContext, lightHex: string, darkHex: string) => {
    const key = `${ctx}:${lightHex}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (ctx === 'bg') {
      rules.push(`[bgcolor="${lightHex}"]{background-color:${darkHex}!important}`);
    } else if (ctx === 'text') {
      // The projector emits `color: #hex` (space); the frame's raw-HTML footer emits
      // `color:#hex` (no space). Cover both spellings.
      rules.push(`[style*="color: ${lightHex}"]{color:${darkHex}!important}`);
      rules.push(`[style*="color:${lightHex}"]{color:${darkHex}!important}`);
    } else {
      // Borders live in inline `border-…-color`; match the hex anywhere in the style.
      rules.push(`[style*="${lightHex}"]{border-color:${darkHex}!important}`);
    }
  };

  for (const { role, contexts } of REMAP) {
    const l = light[role];
    const d = dark[role];
    if (!l || !d || l === d) continue;
    for (const ctx of contexts) add(ctx, l, d);
  }

  return rules.join('');
}

/**
 * Build the `@media (prefers-color-scheme: dark)` block that turns the LIGHT-rendered
 * email into its brand DARK theme, or `''` when nothing differs (no dark palette, or a
 * dark map identical to light). Fed to the projector via `EmailHeadExtras.css`.
 */
export function buildDarkModeCss(light: EmailColorDefaults, dark: EmailColorDefaults): string {
  const rules = darkModeRules(light, dark);
  return rules ? `@media (prefers-color-scheme:dark){${rules}}` : '';
}
