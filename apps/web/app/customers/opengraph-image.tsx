import { ImageResponse } from 'next/og';

// The /customers OG card. Mirrors the /platform and /pricing cards (wordmark +
// tag, big headline, module-dot footer) with customers copy. system-ui fonts so
// no remote font fetch is needed.
export const runtime = 'edge';
export const alt = 'Sparx — Who builds on Sparx. Every kind of operator, one platform.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const MODULE_DOTS = [
  '#6366F1', // builder
  '#F97316', // commerce
  '#14B8A6', // cms
  '#06B6D4', // crm
  '#0EA5E9', // email
  '#475569', // b2b
  '#EC4899', // ai
  '#10B981', // dropship
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
          <span>Spar</span>
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
            Customers
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
          <div style={{ display: 'flex' }}>Who builds</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', color: '#A1A1AA' }}>
            <span>on Sparx</span>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 9999,
                backgroundColor: '#6366F1',
                marginLeft: 4,
                marginBottom: 14,
              }}
            />
          </div>
        </div>
        <span style={{ fontSize: 28, lineHeight: 1.4, color: '#A1A1AA', maxWidth: 980 }}>
          Publishers, retailers, wholesale distributors, agencies — each turns on the modules they
          need, on one platform.
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
            8 modules
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
        <span style={{ fontSize: 18, color: '#52525B' }}>sparx.works/customers</span>
      </div>
    </div>,
    { ...size }
  );
}
