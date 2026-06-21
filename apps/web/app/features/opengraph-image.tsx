import { ImageResponse } from 'next/og';
import { CAPABILITY_AREAS, capabilityCounts } from '@/lib/capabilities';

// Per-route OG image. Without this file the /features page emits no og:image —
// a page-level `openGraph` block in page.tsx stops Next from inheriting the root
// opengraph-image.tsx. Mirrors the proven structure of app/opengraph-image.tsx
// (dark canvas, wordmark, big headline, module dots) but leads with the breadth
// number, which is the whole point of this page. Numbers come from the catalog
// so the card can never overstate the live count.

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Everything inside sparx — over 300 capabilities, one platform.';

const MODULE_DOTS = CAPABILITY_AREAS.filter((a) => a.module).map((a) => a.accent);

export default function Image() {
  const counts = capabilityCounts();
  const liveFloor = Math.floor(counts.live / 10) * 10; // 250
  const totalFloor = Math.floor(counts.total / 10) * 10; // 310

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
      {/* Top: wordmark + count badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          <span>spar</span>
          <span style={{ color: '#6366F1' }}>x</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 18px',
            border: '1px solid #1E1B4B',
            borderRadius: 9999,
            backgroundColor: '#0F0B2E',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: '#818CF8' }} />
          <span
            style={{
              fontWeight: 500,
              fontSize: 16,
              letterSpacing: '0.08em',
              color: '#818CF8',
              textTransform: 'uppercase',
            }}
          >
            {counts.live} live today
          </span>
        </div>
      </div>

      {/* Middle: the number, big */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontWeight: 500,
            fontSize: 150,
            letterSpacing: '-0.035em',
            lineHeight: 1,
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex' }}>Over {totalFloor}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span>capabilities</span>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 9999,
                backgroundColor: '#6366F1',
                marginLeft: 4,
                marginBottom: 14,
              }}
            />
          </div>
        </div>
        <span style={{ fontSize: 28, lineHeight: 1.4, color: '#A1A1AA', maxWidth: 980 }}>
          {liveFloor}+ live today across {counts.modules} modules — one platform, one data layer,
          one bill. The whole thing, in one place.
        </span>
      </div>

      {/* Bottom: module dots + footer */}
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
            {counts.modules} modules
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {MODULE_DOTS.map((color) => (
              <div
                key={color}
                style={{ width: 14, height: 14, borderRadius: 9999, backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <span style={{ fontSize: 18, color: '#52525B' }}>sparx.works/features</span>
      </div>
    </div>,
    { ...size }
  );
}
