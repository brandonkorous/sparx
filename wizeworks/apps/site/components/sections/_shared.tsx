// Small helpers shared across Site Builder section components.

import Link from 'next/link';

import { buttonClasses } from '@wizeworks/silicaui-react/server';
import type { Cta } from '@wizeworks/sitebuilder-schemas';

/** True for an absolute external URL; internal links start with "/". */
function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** A CTA/link that uses next/link for internal paths and a plain anchor (with
 *  safe rel) for external URLs. Renders nothing when label or url is empty. */
export function SbLink({
  url,
  label,
  className,
}: {
  url: string;
  label: string;
  className?: string;
}) {
  if (!url || !label) return null;
  if (isExternal(url)) {
    return (
      <a href={url} className={className} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }
  return (
    <Link href={url} className={className}>
      {label}
    </Link>
  );
}

// A CTA's style maps to a silica button — never a hand-built one (RULE #1). The
// "scrim" styles (light/dark/ghost) add silica's universal `glass` treatment so a
// CTA stays legible over arbitrary section media. `solid` is silica's default
// variant and emits no class, so the plain rows carry only a color. An
// unknown/missing style falls back to the primary button.
const CTA_RECIPE: Record<string, Parameters<typeof buttonClasses>[0]> = {
  solid: { color: 'primary' },
  light: { className: 'glass' },
  dark: { color: 'neutral', className: 'glass' },
  ghost: { className: 'glass' },
  link: { color: 'primary', variant: 'link' },
};

/** A row of up to two CTA buttons. Empty/invalid CTAs are dropped; renders
 *  nothing when none remain. `size="lg"` enlarges them (hero); `layout="stacked"`
 *  stacks them vertically (the full-bleed "two stacked pills" look). The button
 *  recipe rides on the routing-aware `SbLink` via `asChild`. `className` lets a
 *  media section inject the over-photo pill treatment (rounded-full + min-width)
 *  onto the direct-child buttons. */
export function SbCtaRow({
  ctas,
  size,
  layout,
  className,
}: {
  ctas?: Cta[] | null;
  size?: 'lg';
  layout?: 'row' | 'stacked';
  className?: string;
}) {
  const items = (ctas ?? []).filter((c) => c?.label && c?.url);
  if (items.length === 0) return null;
  // Base row layout. Stacked = a vertical column of full-width pills that keep a
  // comfortable min-width until the smallest screens (targets the direct-child
  // buttons the recipe renders).
  const rowCls = [
    'flex items-center gap-3',
    layout === 'stacked'
      ? 'flex-col flex-nowrap [&>*]:w-full [&>*]:min-w-[260px] max-[480px]:[&>*]:min-w-0'
      : 'flex-wrap',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={rowCls}>
      {items.map((c, i) => {
        const recipe = CTA_RECIPE[c.style] ?? CTA_RECIPE.solid;
        // `buttonClasses` rather than <Button render={…}>: these sections are
        // Server Components, and silicaui-react's `render` composition only works
        // inside a client module (the element would cross the boundary and lose
        // its href). Styling the link directly is the documented server path.
        return (
          <SbLink
            key={i}
            url={c.url}
            label={c.label}
            className={buttonClasses({ ...recipe, size: size === 'lg' ? 'lg' : 'md' })}
          />
        );
      })}
    </div>
  );
}

// Back-compat: prefer the `ctas[]` array; fall back to a section's legacy single
// `ctaLabel`/`ctaUrl` (older published snapshots predate multi-CTA).
export function resolveCtas(config: { ctas?: Cta[]; ctaLabel?: string; ctaUrl?: string }): Cta[] {
  if (config.ctas && config.ctas.length > 0) return config.ctas;
  if (config.ctaLabel) {
    return [{ label: config.ctaLabel, url: config.ctaUrl ?? '', style: 'solid' }];
  }
  return [];
}
