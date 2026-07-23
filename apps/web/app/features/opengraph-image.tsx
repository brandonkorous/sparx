import { ImageResponse } from 'next/og';
import { BRAND } from '@sparx/brand';
import { capabilityCounts } from '@/lib/capabilities';
import { ModuleStrip } from '@/components/marketing/module-strip';
import { PAID_MODULES } from '@/components/marketing/modules-catalog';
import { OgWordmark } from '@/lib/og-wordmark';

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
        backgroundColor: BRAND.ink,
        padding: '72px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Top: wordmark + count badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgWordmark height={40} />
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
            style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: BRAND.primary }}
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
                backgroundColor: BRAND.primary,
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
          borderTop: '1px solid rgba(255, 255, 255, 0.09)',
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
            {PAID_MODULES.length} modules
          </span>
          <ModuleStrip size={30} gap={10} wrap={false} modules={PAID_MODULES} />
        </div>
        <span style={{ fontSize: 18, color: '#52525B' }}>sparx.works/features</span>
      </div>
    </div>,
    { ...size }
  );
}
