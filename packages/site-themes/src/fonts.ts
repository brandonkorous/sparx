// Brand web-font loading — the single source of truth for turning a tenant's
// chosen font families into a Google Fonts stylesheet URL.
//
// The compiled theme NAMES the tenant's families (`--font-heading` / `--font-sans`
// via `compiledToSilicaTheme`), but a browser only RENDERS them once the family is
// actually loaded. Both the live storefront (the SSR `<link>` in apps/site) and the
// Builder canvas (a client `<link>` in the workbench editor) build that URL from
// here, so the editor previews the EXACT faces the published site serves rather
// than a silent Geist fallback that makes the canvas lie about the type. Keeping
// the URL builder in one place is what prevents the two from drifting.

/** Families bundled with the apps (loaded by `next/font` or the platform shell) or
 *  that are plain CSS keywords — they need no Google Fonts network load, and aren't
 *  Google families anyway, so they're excluded from the request.
 *
 *  NOT Inter: the storefront bundles GEIST, not Inter, so a tenant who picks Inter
 *  as a brand/heading face needs it FETCHED like any other Google family — skipping
 *  it left an Inter heading riding the system fallback (renders only where the OS
 *  happens to have Inter). Only genuinely-bundled families + CSS generics belong here. */
export const BUNDLED_FONTS = new Set([
  'Geist',
  'Geist Mono',
  'system-ui',
  'ui-sans-serif',
  'sans-serif',
  '-apple-system',
]);

/** A Google Fonts stylesheet URL for whatever brand families actually need
 *  loading, or `null` when every family is bundled/empty (nothing to fetch). Input
 *  is the raw family names (e.g. `'Oswald'`), de-duped; each requests the 400–800
 *  weight ramp brand type uses. Pass the compiled `shared.fontHeading/fontBody`
 *  first with the raw theme columns as a backstop — de-duping collapses overlap. */
export function brandFontHref(families: (string | null | undefined)[]): string | null {
  const uniq = Array.from(
    new Set(families.map((f) => (f ?? '').trim()).filter((f) => f && !BUNDLED_FONTS.has(f)))
  );
  if (uniq.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${uniq
    .map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700;800`)
    .join('&')}&display=swap`;
}

/** The minimal silica-`Theme` shape `themeFontFamilies` reads. Typed structurally
 *  (not imported from silicaui-html) so this package stays dependency-free, matching
 *  the `SilicaTheme` reproduction in `v2/silica-css.ts`. */
export interface ThemeFontSource {
  /** `--color-*` / `--font-*` / … token map — the CSS that actually renders. */
  tokens?: Record<string, string>;
  /** silica's provenance: which Google family each font token was picked from. */
  fonts?: {
    sans?: { family: string; source: string };
    head?: { family: string; source: string };
  };
}

/** The first family in a CSS font stack (`"'Oswald', ui-sans-serif, …"` → `Oswald`),
 *  unquoted — the name a Google Fonts request needs. Null for an empty stack, or when
 *  the value isn't a loadable family name: a `var(--font-sans)` reference (a token
 *  that aliases another — e.g. `--font-head: var(--font-sans)` for "headings inherit
 *  the body face") or any other `fn(...)` value. Passing one of those to Google Fonts
 *  as `family=var(--font-sans)` is rejected and can 400 the WHOLE stylesheet, dropping
 *  every real font with it — so they must never reach `brandFontHref`. */
function firstStackFamily(stack: string | undefined): string | null {
  const first = (stack ?? '')
    .split(',')[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, '');
  if (!first || first.includes('(') || first.includes(')')) return null;
  return first;
}

/** The webfont families a silica theme NAMES — the authoritative source for what to
 *  load, since it reflects a SAVED theme and live Design-inspector edits (the
 *  typeface + headings-font controls), which a brand-column snapshot never sees.
 *
 *  Drawn from silica's own `fonts` provenance (google picks) AND the rendered font
 *  tokens (`--font-head` / `--font-heading` / `--font-sans` — the first covers an
 *  inspector-set theme, the middle a sparx-compiled brand theme, the last body
 *  copy). Feed the result to `brandFontHref`, which de-dupes + drops bundled/system.
 *  Both the storefront (apps/site) and the Builder canvas (workbench) read from here
 *  so the two can't disagree on which faces a theme needs. */
export function themeFontFamilies(theme: ThemeFontSource): (string | null)[] {
  const fonts = theme.fonts;
  const tokens = theme.tokens ?? {};
  return [
    fonts?.head?.source === 'google' ? fonts.head.family : null,
    fonts?.sans?.source === 'google' ? fonts.sans.family : null,
    firstStackFamily(tokens['--font-head']),
    firstStackFamily(tokens['--font-heading']),
    firstStackFamily(tokens['--font-sans']),
  ];
}
