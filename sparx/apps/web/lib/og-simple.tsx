import { ImageResponse } from 'next/og';
import { BRAND } from '@sparx/brand';
import { OgWordmark } from './og-wordmark';

// Shared OG/Twitter card renderer for the bespoke non-module marketing pages
// (Partner Program, Bootcamp directory, and per-bootcamp detail). Mirrors the
// module OG (lib/og-module.tsx) — near-black canvas, the sparx wordmark (the real
// vector lockup via <OgWordmark>), a colored tag pill, a big headline, and a
// footer rule — but takes
// plain strings so a dynamic page (a bootcamp title + host + date) can render one
// per slug. Edge-safe: no marketing-component imports (they pull React DOM).

export const OG_SIZE = { width: 1200, height: 630 } as const;

const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function renderSimpleOg(opts: {
  /** Uppercase tag inside the accent pill (e.g. "PARTNER PROGRAM"). */
  tag: string;
  /** Accent hex — the pill + the headline spark. */
  accent: string;
  /** Big headline. Long strings wrap; keep under ~60 chars for two lines. */
  title: string;
  /** Optional supporting line under the headline. */
  subtitle?: string;
  /** Bottom-left meta label (e.g. "Hosted by Northlight Studio"). */
  footerLeft?: string;
  /** Bottom-right, usually the canonical URL. */
  footerRight?: string;
}): ImageResponse {
  const { tag, accent, title, subtitle, footerLeft, footerRight } = opts;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: BRAND.ink,
        padding: '72px',
        fontFamily: SYSTEM_FONT,
      }}
    >
      {/* Top: wordmark + tag pill */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgWordmark height={40} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 18px',
            border: `1px solid ${accent}`,
            borderRadius: 9999,
            backgroundColor: `${accent}1A`,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: accent }} />
          <span
            style={{
              fontWeight: 500,
              fontSize: 16,
              color: accent,
            }}
          >
            {tag}
          </span>
        </div>
      </div>

      {/* Middle: headline + subtitle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            fontWeight: 500,
            fontSize: title.length > 40 ? 76 : 96,
            letterSpacing: '-0.035em',
            lineHeight: 1.02,
            color: '#FFFFFF',
            maxWidth: 1000,
          }}
        >
          <span>{title}</span>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 9999,
              backgroundColor: accent,
              marginLeft: 6,
              marginBottom: 12,
            }}
          />
        </div>
        {subtitle ? (
          <span style={{ fontSize: 26, lineHeight: 1.4, color: '#A1A1AA', maxWidth: 940 }}>
            {subtitle}
          </span>
        ) : null}
      </div>

      {/* Bottom rule */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 28,
          borderTop: '1px solid rgba(255, 255, 255, 0.09)',
        }}
      >
        <span style={{ fontSize: 18, color: '#A1A1AA' }}>{footerLeft ?? ''}</span>
        <span style={{ fontSize: 18, color: '#52525B' }}>{footerRight ?? 'sparx.works'}</span>
      </div>
    </div>,
    { ...OG_SIZE }
  );
}
