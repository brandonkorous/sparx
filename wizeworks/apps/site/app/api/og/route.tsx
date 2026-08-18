// Tenant-branded OG card generator (docs/50 §5). A pure renderer: it takes the
// card's text + accent as query params (built by `lib/og.ts → ogImageUrl`) and
// returns a 1200×630 PNG via Satori. It performs NO tenant lookup or data fetch,
// so it stays fast and cacheable, and it can only render text the caller already
// chose — it never reaches tenant data. Used as the social-image FALLBACK for
// storefront entities that have no real image of their own.

import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const SIZE = { width: 1200, height: 630 };
const DEFAULT_ACCENT = '#e04631'; // sparx Ember, when the tenant set no brand color
const HEX = /^[0-9a-fA-F]{6}$/;

// Title type scales down as it gets longer so it always fits the card.
function titleSize(len: number): number {
  if (len > 90) return 54;
  if (len > 60) return 66;
  if (len > 32) return 82;
  return 96;
}

export function GET(req: Request): ImageResponse {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') ?? '').slice(0, 120).trim() || 'Untitled';
  const eyebrow = (searchParams.get('eyebrow') ?? '').slice(0, 40).trim();
  const brand = (searchParams.get('brand') ?? '').slice(0, 60).trim();
  const rawAccent = searchParams.get('accent') ?? '';
  const accent = HEX.test(rawAccent) ? `#${rawAccent}` : DEFAULT_ACCENT;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#0B0B12',
        padding: '72px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* Accent rule pinned to the very top edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 10,
          backgroundColor: accent,
        }}
      />

      {/* Eyebrow */}
      <div style={{ display: 'flex' }}>
        {eyebrow ? (
          <span
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            {eyebrow}
          </span>
        ) : (
          <span style={{ display: 'flex' }} />
        )}
      </div>

      {/* Title */}
      <div
        style={{
          display: 'flex',
          fontSize: titleSize(title.length),
          fontWeight: 600,
          lineHeight: 1.05,
          letterSpacing: '-0.025em',
          color: '#FFFFFF',
        }}
      >
        {title}
      </div>

      {/* Footer: brand signature with an accent dot */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingTop: 28,
          borderTop: '1px solid #23232E',
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 9999, backgroundColor: accent }} />
        <span style={{ fontSize: 26, fontWeight: 500, color: '#E5E5EC' }}>
          {brand || 'Online store'}
        </span>
      </div>
    </div>,
    { ...SIZE }
  );
}
