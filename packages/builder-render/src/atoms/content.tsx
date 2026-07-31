// FAQ / FeatureGrid / EditorialSection — the page-content composites.
//
// These are compositions, not new controls: each assembles silica pieces (`h2`,
// `h3`, the type scale, `card`/`card-body`/`card-title`, `btn`) into the shape a
// single builder node renders. They live here because a builder LEAF has to map a
// flat prop bag onto that shape, which is a sparx concern rather than a design-
// system one (root CLAUDE.md RULE #1).
//
// Each takes RESOLVED items: the live site and the editor canvas each work out
// bound-vs-authored themselves, then hand the result here, so the two surfaces
// cannot drift. All render nothing when they have nothing to show.
//
// SERVER components.

import * as React from 'react';
import { buttonClasses, cx } from '@wizeworks/silicaui-react/server';

// ── FAQ ──────────────────────────────────────────────────────────────────────

export interface FaqEntry {
  question: string;
  answer?: string;
}

export interface FaqProps {
  items: FaqEntry[];
  className?: string;
}

export function FAQ({ items, className }: FaqProps): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div className={cx('flex flex-col gap-6', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-2">
          <h3 className="h3">{it.question}</h3>
          {it.answer ? <p className="leading-relaxed">{it.answer}</p> : null}
        </div>
      ))}
    </div>
  );
}
FAQ.displayName = 'FAQ';

// ── FeatureGrid ──────────────────────────────────────────────────────────────

export interface FeatureItem {
  number?: string;
  title: string;
  body?: string;
}

export interface FeatureGridProps {
  cols?: 2 | 3 | 4;
  items: FeatureItem[];
  className?: string;
}

// Column counts collapse to one on a narrow FRAME, so the canvas preview reflows
// at the simulated device width like the rest of the builder chrome.
const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: '@xl/bx-frame:grid-cols-2',
  3: '@xl/bx-frame:grid-cols-2 @4xl/bx-frame:grid-cols-3',
  4: '@xl/bx-frame:grid-cols-2 @4xl/bx-frame:grid-cols-4',
};

export function FeatureGrid({
  cols = 3,
  items,
  className,
}: FeatureGridProps): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div className={cx('grid grid-cols-1 gap-6', GRID_COLS[cols], className)}>
      {items.map((f, i) => (
        <div key={i} className="card">
          <div className="card-body">
            {f.number ? <p className="text-sm font-medium">{f.number}</p> : null}
            <h3 className="card-title">{f.title}</h3>
            {f.body ? <p className="leading-relaxed">{f.body}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
FeatureGrid.displayName = 'FeatureGrid';

// ── EditorialSection ─────────────────────────────────────────────────────────

export interface EditorialSectionProps {
  eyebrow?: string;
  headline?: string;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  className?: string;
}

export function EditorialSection({
  eyebrow,
  headline,
  body,
  ctaLabel,
  ctaUrl,
  className,
}: EditorialSectionProps): React.ReactElement {
  // An empty URL means no href, so the CTA renders a <button> rather than an
  // anchor pointing at nothing. Written as a length check, not `ctaUrl ||
  // undefined`, so it isn't rewritten to `??` (which would let '' through).
  const href = ctaUrl && ctaUrl.length > 0 ? ctaUrl : undefined;
  const ctaClass = buttonClasses({ color: 'primary' });
  // Children stretch full-width so the surrounding box's text-align governs
  // horizontal alignment; the CTA sits in a block so that alignment reaches it.
  return (
    <div className={cx('flex flex-col items-stretch gap-4', className)}>
      {eyebrow ? <p className="text-sm font-medium tracking-wide uppercase">{eyebrow}</p> : null}
      {headline ? <h2 className="h2">{headline}</h2> : null}
      {body ? <p className="leading-relaxed">{body}</p> : null}
      {ctaLabel ? (
        <div>
          {href ? (
            <a href={href} className={ctaClass}>
              {ctaLabel}
            </a>
          ) : (
            <button type="button" className={ctaClass}>
              {ctaLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
EditorialSection.displayName = 'EditorialSection';
