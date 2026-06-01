// Small helpers shared across Site Builder section components.

import Link from 'next/link';

import type { Cta } from '@sparx/sitebuilder-schemas';

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

// A CTA's style maps to a storefront button variant — never a hand-built button
// (brand rule). Unknown/missing style falls back to the primary solid button.
const CTA_CLASS: Record<string, string> = {
  solid: 'sf-btn sf-btn--primary',
  light: 'sf-btn sf-btn--light',
  dark: 'sf-btn sf-btn--dark',
  ghost: 'sf-btn sf-btn--ghost',
  link: 'sf-btn sf-btn--link',
};

/** A row of up to two CTA buttons. Empty/invalid CTAs are dropped; renders
 *  nothing when none remain. `size="lg"` enlarges them (hero); `layout="stacked"`
 *  stacks them vertically (the full-bleed "two stacked pills" look). */
export function SbCtaRow({
  ctas,
  size,
  layout,
}: {
  ctas?: Cta[] | null;
  size?: 'lg';
  layout?: 'row' | 'stacked';
}) {
  const items = (ctas ?? []).filter((c) => c?.label && c?.url);
  if (items.length === 0) return null;
  const rowCls = ['sf-cta-row', layout === 'stacked' ? 'sf-cta-row--stacked' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={rowCls}>
      {items.map((c, i) => {
        const cls = [CTA_CLASS[c.style] ?? CTA_CLASS.solid, size === 'lg' ? 'sf-btn--lg' : '']
          .filter(Boolean)
          .join(' ');
        return <SbLink key={i} url={c.url} label={c.label} className={cls} />;
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
