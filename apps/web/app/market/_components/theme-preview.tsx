// Live marketplace THEME preview (docs/118). Instead of a baked screenshot, a theme
// listing renders a real sample layout IN-BROWSER with the theme's silica tokens
// applied — always truthful, never stale, and (for the future third-party marketplace)
// no server-side render step in the upload pipeline: an uploaded theme just renders itself.
//
// HOW IT'S SCOPED. The theme's token bag is projected to a stylesheet scoped to THIS
// preview's `.tp-<slug>` class (via @sparx/site-themes' `buildSilicaThemeCssFromTheme`,
// the same projection the storefront uses), so many differently-themed previews sit on
// one page with no `:root` collision. Emitted as a `<style>` block, never an inline
// `style` prop (subtree theming via a stylesheet is the sanctioned pattern).
//
// FONTS. A theme states Google font families; the preview loads them so its type is real.

import { buildSilicaThemeCssFromTheme } from '@sparx/site-themes';
import type { ThemeFacets } from '@/lib/marketplace';
import { ThemePreviewToggle } from './theme-preview-toggle';

export interface ThemePreviewProps {
  slug: string;
  name: string;
  theme: ThemeFacets;
  /** 'card' = compact vignette for the browse grid (forced light for a consistent
   *  grid); 'detail' = full sample that follows the viewer's light/dark. */
  variant: 'card' | 'detail';
}

/** The scoped stylesheet for a preview: the theme's tokens projected onto `.tp-<slug>`
 *  (light + the dark `[data-theme="dark"]` delta, both always present so a toggle only
 *  flips the attribute) plus the two font rules. Shared by the static + toggle previews. */
export function themePreviewCss(
  scope: string,
  tokens: Record<string, string>,
  dark: Record<string, string> | null | undefined
): string {
  return (
    buildSilicaThemeCssFromTheme(
      { name: scope, mode: 'light', tokens, dark: dark ?? undefined },
      { rootSelector: `.${scope}` }
    ) +
    `.${scope}{font-family:var(--font-sans,system-ui,sans-serif)}` +
    `.${scope} .tp-head{font-family:var(--font-head,var(--font-sans,system-ui))}`
  );
}

/** The Google-Fonts href for the theme's stated faces, or null for system/none. */
export function fontsHref(fonts: ThemeFacets['fonts']): string | null {
  const faces = [fonts?.head, fonts?.sans].filter(
    (f): f is NonNullable<typeof f> => !!f && f.source === 'google'
  );
  if (faces.length === 0) return null;
  const seen = new Set<string>();
  const params = faces
    .filter((f) => !seen.has(f.family) && seen.add(f.family))
    .map(
      (f) =>
        `family=${f.family.replace(/ /g, '+')}:wght@${(f.weights ?? [400, 600, 700]).join(';')}`
    )
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/** The sample surface, in silica utility classes that read the scoped `--color-*`
 *  tokens. Headings carry `tp-head` so the scoped stylesheet gives them the theme's
 *  heading face; body text inherits `--font-sans`. */
export function DetailSample({ name }: { name: string }) {
  return (
    <div className="flex flex-col">
      <div className="border-base-300 flex items-center justify-between border-b px-8 py-5">
        <span className="tp-head text-xl font-bold tracking-tight">{name}</span>
        <div className="flex items-center gap-6 text-sm">
          <span>Shop</span>
          <span>Journal</span>
          <span>About</span>
          <span className="bg-primary text-primary-content rounded-field px-4 py-2 font-semibold">
            Get started
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-5 px-8 pt-12 pb-8">
        <h3 className="tp-head max-w-[18ch] text-5xl leading-[1.05] font-bold tracking-tight">
          Design that feels like {name}.
        </h3>
        <p className="max-w-[46ch] text-lg leading-relaxed">
          A complete, considered look — color, type, spacing, and shape — ready to apply to your
          whole site in one click.
        </p>
        <div className="flex gap-3 pt-1">
          <span className="bg-primary text-primary-content rounded-field px-6 py-3 font-semibold">
            Primary action
          </span>
          <span className="border-base-300 rounded-field border px-6 py-3 font-semibold">
            Secondary
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 px-8 pb-8">
        {[
          ['Type', 'Considered type', 'A heading and body pairing that carries the voice.'],
          ['Color', 'Cohesive color', 'One accent, balanced neutrals, surfaces that hold.'],
          ['Shape', 'Consistent shape', 'Radius, border, and spacing tuned to one feel.'],
        ].map(([chip, title, body]) => (
          <div key={chip} className="bg-base-200 border-base-300 rounded-box border p-5">
            <span className="bg-accent text-accent-content mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold">
              {chip}
            </span>
            <h4 className="tp-head mb-1.5 text-lg font-semibold">{title}</h4>
            <p className="text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3 px-8 pb-8">
        {[
          ['bg-primary', 'text-primary-content', 'Primary'],
          ['bg-secondary', 'text-secondary-content', 'Secondary'],
          ['bg-accent', 'text-accent-content', 'Accent'],
          ['bg-neutral', 'text-neutral-content', 'Neutral'],
        ].map(([bg, ink, label]) => (
          <div
            key={label}
            className={`${bg} ${ink} border-base-300 rounded-field flex h-14 flex-1 items-center justify-center border text-sm font-medium`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The compact browse-card vignette: brand, a headline, a primary control, swatches. */
function CardSample({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="tp-head text-md font-bold tracking-tight">{name}</span>
        <span className="bg-primary text-primary-content rounded-field px-2.5 py-1 text-xs font-semibold">
          Shop
        </span>
      </div>
      <h4 className="tp-head text-2xl leading-tight font-bold tracking-tight">
        Feels like {name}.
      </h4>
      <p className="text-sm leading-snug">A complete look — color, type, and shape.</p>
      <div className="mt-1 flex gap-2">
        {[
          ['bg-primary', 'text-primary-content', 'Primary'],
          ['bg-secondary', 'text-secondary-content', 'Secondary'],
          ['bg-accent', 'text-accent-content', 'Accent'],
        ].map(([bg, ink, label]) => (
          <span
            key={label}
            className={`${bg} ${ink} flex h-8 flex-1 items-center justify-center rounded-full text-[11px] font-medium`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ThemePreview({ slug, name, theme, variant }: ThemePreviewProps) {
  const tokens = theme.tokens ?? null;
  if (!tokens) {
    // Legacy row with no stored bag — show a neutral placeholder rather than crash.
    return <div className="bg-base-200 border-base-300 aspect-[16/10] w-full rounded-xl border" />;
  }
  const scope = `tp-${slug}`;
  const css = themePreviewCss(scope, tokens, theme.dark);
  const href = fontsHref(theme.fonts);
  // Card grid stays light for a consistent comparison; detail follows the viewer.
  const forceLight = variant === 'card';

  return (
    <>
      {href ? <link rel="stylesheet" href={href} /> : null}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div
        className={`${scope} bg-base-100 w-full overflow-hidden`}
        {...(forceLight ? { 'data-theme': 'light' } : {})}
      >
        {variant === 'detail' ? <DetailSample name={name} /> : <CardSample name={name} />}
      </div>
    </>
  );
}

/** The detail-page preview: the full sample plus a light/dark toggle. Builds the
 *  scoped stylesheet on the SERVER and hands it — with the server-rendered sample as
 *  children — to the client toggle island, which only owns the mode state. */
export function ThemePreviewDetail({ slug, name, theme }: Omit<ThemePreviewProps, 'variant'>) {
  const tokens = theme.tokens ?? null;
  if (!tokens) {
    return <div className="bg-base-200 border-base-300 aspect-[16/10] w-full rounded-xl border" />;
  }
  const scope = `tp-${slug}`;
  return (
    <ThemePreviewToggle
      scope={scope}
      css={themePreviewCss(scope, tokens, theme.dark)}
      fontsHref={fontsHref(theme.fonts)}
      hasDark={!!theme.dark && Object.keys(theme.dark).length > 0}
    >
      <DetailSample name={name} />
    </ThemePreviewToggle>
  );
}
