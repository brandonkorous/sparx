// The marketplace home's category grid (docs/60 §4, Home tier). One tile per
// registry category: live categories link to their browse page and show a count;
// coming-soon categories render as muted teasers (M7 — first-class registry
// entries shown before their data lands). The icon + accent are the category's
// identity, applied as inline style (catalog data, not a control re-skin).

import type { CSSProperties } from 'react';

import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace-registry';

export function CategoryTiles({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {MARKETPLACE_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const live = cat.status === 'live';
        const count = counts[cat.id] ?? 0;

        const inner = (
          <>
            <div className="flex items-center justify-between">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px]"
                // The category hue is registry data (a JS value), not a token —
                // the icon chip's tint + ink stay inline.
                style={{
                  backgroundColor: `color-mix(in srgb, ${cat.accent} 12%, transparent)`,
                  color: cat.accent,
                }}
              >
                <Icon size={20} strokeWidth={2} />
              </span>
              {live ? (
                <span className="text-ink-subtle text-mini font-mono">
                  {count} {count === 1 ? cat.singular : cat.label.toLowerCase()}
                </span>
              ) : (
                <span className="text-ink-subtle text-mini font-medium">Coming soon</span>
              )}
            </div>

            <h3 className="text-h4 m-0 pt-7 font-medium tracking-[-0.015em]">{cat.label}</h3>
            <p className="text-ink-muted text-small m-0 pt-2">{cat.tagline}</p>

            {live ? (
              <span className="text-caption mt-auto pt-6 font-medium" style={{ color: cat.accent }}>
                Browse {cat.label.toLowerCase()} →
              </span>
            ) : null}
          </>
        );

        const cardClass = [
          'border-base-300 flex min-h-[200px] w-full flex-col rounded-lg border p-6',
          live ? '' : 'opacity-[0.72]',
        ]
          .filter(Boolean)
          .join(' ');
        // Category menu: each tile wears a soft 8% wash of its category hue (a
        // color legend). The hue is registry data, so the wash stays inline.
        const cardStyle: CSSProperties = {
          backgroundColor: `color-mix(in oklab, ${cat.accent} 8%, var(--color-base-100))`,
        };

        return live ? (
          <a
            key={cat.id}
            href={`/market/${cat.id}`}
            className={`${cardClass} text-inherit no-underline`}
            style={cardStyle}
          >
            {inner}
          </a>
        ) : (
          <div key={cat.id} className={cardClass} style={cardStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
