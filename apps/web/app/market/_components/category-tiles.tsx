// The marketplace home's category grid (docs/60 §4, Home tier). One tile per
// registry category: live categories link to their browse page and show a count;
// coming-soon categories render as muted teasers (M7 — first-class registry
// entries shown before their data lands). The icon + accent are the category's
// identity, applied as inline style (catalog data, not a control re-skin).

import type { CSSProperties } from 'react';

import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace-registry';

export function CategoryTiles({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="mkt-grid-4-2-1">
      {MARKETPLACE_CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const live = cat.status === 'live';
        const count = counts[cat.id] ?? 0;

        const inner = (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: `color-mix(in srgb, ${cat.accent} 12%, transparent)`,
                  color: cat.accent,
                }}
              >
                <Icon size={20} strokeWidth={2} />
              </span>
              {live ? (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {count} {count === 1 ? cat.singular : cat.label.toLowerCase()}
                </span>
              ) : (
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '11px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  Coming soon
                </span>
              )}
            </div>

            <h3
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: '20px',
                letterSpacing: '-0.015em',
                color: 'var(--color-text-primary)',
                paddingTop: '28px',
                margin: 0,
              }}
            >
              {cat.label}
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                lineHeight: '21px',
                color: 'var(--color-text-secondary)',
                paddingTop: '8px',
                margin: 0,
              }}
            >
              {cat.tagline}
            </p>

            {live ? (
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '13px',
                  color: cat.accent,
                  marginTop: 'auto',
                  paddingTop: '24px',
                }}
              >
                Browse {cat.label.toLowerCase()} →
              </span>
            ) : null}
          </>
        );

        const cardStyle: CSSProperties = {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          minHeight: '200px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderTop: `3px solid ${cat.accent}`,
          borderRadius: '8px',
          padding: '24px',
          opacity: live ? 1 : 0.72,
        };

        return live ? (
          <a
            key={cat.id}
            href={`/market/${cat.id}`}
            style={{ ...cardStyle, textDecoration: 'none', color: 'inherit' }}
          >
            {inner}
          </a>
        ) : (
          <div key={cat.id} style={cardStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
