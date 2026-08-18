// Branded default OG card for sparx.market (auto-discovered by Next as the
// site-wide social image). A pure renderer — no data fetch — so it stays fast
// and cacheable. Pages with a real image of their own (a product photo, a
// merchant banner) override this with their own opengraph-image later.

import { ImageResponse } from 'next/og';
import {
  BRAND,
  WORDMARK_ASPECT,
  WORDMARK_BODY_PATHS,
  WORDMARK_VIEWBOX,
  WORDMARK_X_PATH,
} from '@sparx/brand';

export const runtime = 'edge';
export const alt = 'sparx.market — Shop independent sellers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// One dot per market category, in the taxonomy's nav order. Hard-coded here (not
// imported from @wizeworks/commerce-schemas) so the edge bundle stays tiny and the
// card never pulls a zod dependency into the OG runtime.
const CATEGORY_DOTS = [
  BRAND.primary, // auto — sparx spark
  '#EC4899', // beauty
  '#14B8A6', // home
  '#F97316', // fashion
  '#10B981', // food
  '#06B6D4', // tech
  '#A1A1AA', // general
] as const;

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#0A0A0A',
        padding: '72px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Top: wordmark + tag */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            fontWeight: 500,
            fontSize: 40,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
          }}
        >
          <div style={{ display: 'flex' }}>
            <svg
              width={Math.round(40 * WORDMARK_ASPECT)}
              height={40}
              viewBox={WORDMARK_VIEWBOX}
              xmlns="http://www.w3.org/2000/svg"
            >
              {WORDMARK_BODY_PATHS.map((d) => (
                <path key={d} d={d} fill="#ffffff" />
              ))}
              <path d={WORDMARK_X_PATH} fill={BRAND.primary} />
            </svg>
          </div>
          <span style={{ color: '#A1A1AA' }}>.market</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 18px',
            border: `1px solid ${BRAND.primary}33`,
            borderRadius: 9999,
            backgroundColor: `${BRAND.primary}1A`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              backgroundColor: BRAND.primary,
            }}
          />
          <span
            style={{
              fontWeight: 500,
              fontSize: 16,
              letterSpacing: '0.08em',
              color: BRAND.primary,
              textTransform: 'uppercase',
            }}
          >
            Independent marketplace
          </span>
        </div>
      </div>

      {/* Middle: big headline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontWeight: 500,
            fontSize: 132,
            letterSpacing: '-0.035em',
            lineHeight: 1,
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex' }}>Shop independent</div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span>sellers</span>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 9999,
                backgroundColor: BRAND.primary,
                marginLeft: 4,
                marginBottom: 14,
              }}
            />
          </div>
        </div>
        <span style={{ fontSize: 28, lineHeight: 1.4, color: '#A1A1AA', maxWidth: 920 }}>
          One destination for thousands of independent shops and makers — real products, shipped
          direct, you won’t find on the big marketplaces.
        </span>
      </div>

      {/* Bottom: category dots + footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 28,
          borderTop: '1px solid #1A1A1A',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span
            style={{
              fontWeight: 500,
              fontSize: 14,
              letterSpacing: '0.08em',
              color: '#52525B',
              textTransform: 'uppercase',
            }}
          >
            7 categories
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {CATEGORY_DOTS.map((color) => (
              <div
                key={color}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 9999,
                  backgroundColor: color,
                }}
              />
            ))}
          </div>
        </div>
        <span style={{ fontSize: 18, color: '#52525B' }}>sparx.market</span>
      </div>
    </div>,
    { ...size }
  );
}
