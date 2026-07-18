import { ImageResponse } from 'next/og';
import { BRAND } from '@sparx/brand';
import { ModuleStrip } from '@/components/marketing/module-strip';
import { OgWordmark } from '@/lib/og-wordmark';

// `nodejs`, not `edge` — this card is prerendered to a static .body file at build
// time, which is what makes the response a buffered file with a real
// Content-Length. On `edge` it was compiled per request (satori + the yoga/resvg
// wasm), measured at ~2.4s vs ~0.24s static, and streamed back chunked with NO
// Content-Length. LinkedIn's image fetcher validates size against Content-Length
// before downloading, so a chunked OG response is rejected — which is why the
// cards worked everywhere except LinkedIn. Nothing here needs the edge runtime
// (system fonts, inline SVG, no network), so this matches the other module cards.
export const runtime = 'nodejs';
export const alt = 'sparx — Everything, ignited.';
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
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
            Content & Commerce OS
          </span>
        </div>
      </div>

      {/* Middle: big headline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontWeight: 500,
            fontSize: 160,
            letterSpacing: '-0.035em',
            lineHeight: 1,
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex' }}>Everything,</div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span>ignited</span>
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
        <span
          style={{
            fontSize: 28,
            lineHeight: 1.4,
            color: '#A1A1AA',
            maxWidth: 920,
          }}
        >
          Builder, CRM, CMS, email, B2B, and AI — one platform, one bill, one data layer. Live in
          five minutes.
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
        <span style={{ fontSize: 18, color: '#52525B' }}>sparx.works</span>
      </div>
    </div>,
    { ...size }
  );
}
