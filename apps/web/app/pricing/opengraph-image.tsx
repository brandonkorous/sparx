import { ImageResponse } from 'next/og';
import { BRAND } from '@sparx/brand';
import { ModuleStrip } from '@/components/marketing/module-strip';
import { OgWordmark } from '@/lib/og-wordmark';

// The /pricing OG card. Hand-built (not the per-module renderer) — mirrors the
// /platform card's structure (wordmark + tag, big headline, module-dot footer)
// with pricing copy. system-ui fonts so no remote font fetch is needed.
// nodejs so this card prerenders to a static .body with a real Content-Length —
// LinkedIn rejects the chunked, no-Content-Length response an edge OG route
// streams. See app/opengraph-image.tsx for the full reasoning.
export const runtime = 'nodejs';
export const alt = 'sparx — Switch on what you use. Per-module pricing from $10/mo.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
            Pricing
          </span>
        </div>
      </div>

      {/* Middle: headline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontWeight: 500,
            fontSize: 116,
            letterSpacing: '-0.035em',
            lineHeight: 1.02,
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex' }}>Switch on</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', color: '#A1A1AA' }}>
            <span>what you use</span>
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
        <span style={{ fontSize: 28, lineHeight: 1.4, color: '#A1A1AA', maxWidth: 980 }}>
          Per-module pricing from $10/mo. One platform, one invoice, a 14-day free trial — no card
          to start.
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
            12 modules
          </span>
          <ModuleStrip size={30} gap={10} wrap={false} />
        </div>
        <span style={{ fontSize: 18, color: '#52525B' }}>sparx.works/pricing</span>
      </div>
    </div>,
    { ...size }
  );
}
