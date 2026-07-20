import { ImageResponse } from 'next/og';
import { MODULE_HEX } from '@sparx/brand';
import { type ModuleMeta } from './modules';
import { OgWordmark } from './og-wordmark';

// Satori cannot resolve CSS custom properties, so this is one of the few places
// that legitimately needs a literal hue rather than `bg-module-*`. It reads the
// single TS source in @sparx/brand (pure data, zero deps — safe on the edge
// runtime) instead of keeping yet another hand-mirrored copy.

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Exactly the fields this card draws — deliberately narrower than ModuleMeta.
 *  A full ModuleMeta satisfies it structurally (so every module route is
 *  unchanged), while a page that ISN'T a module — /agentic, the second document
 *  for the `ai` module — can supply a real literal instead of inventing dead
 *  `features` / `lede` data just to satisfy the type. */
export type ModuleOgMeta = Pick<
  ModuleMeta,
  'slug' | 'module' | 'label' | 'headlinePrimary' | 'headlineSecondary' | 'description'
> & {
  // Narrower than ModulePricing: the card draws only these three. A full
  // ModulePricing (which also carries `bundleNote`) still satisfies it.
  pricing: { price: string; period: string; modifier?: '+' | '' };
};

export function renderModuleOgImage(meta: ModuleOgMeta) {
  // No cast needed: MarketingModule now covers the same 14 keys as MODULE_HEX
  // (SEO + Automations were added to the union alongside the twelve paid ones).
  const color = { color: MODULE_HEX[meta.module] ?? MODULE_HEX.builder };
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
      {/* Top: wordmark + module badge */}
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
            border: `1px solid ${color.color}`,
            borderRadius: 9999,
            backgroundColor: `${color.color}1A`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              backgroundColor: color.color,
            }}
          />
          <span
            style={{
              fontWeight: 500,
              fontSize: 16,
              letterSpacing: '0.08em',
              color: color.color,
              textTransform: 'uppercase',
            }}
          >
            {meta.label}
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
            fontSize: 140,
            letterSpacing: '-0.035em',
            lineHeight: 1,
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex' }}>{meta.headlinePrimary}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span>{meta.headlineSecondary}</span>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 9999,
                backgroundColor: color.color,
                marginLeft: 4,
                marginBottom: 12,
              }}
            />
          </div>
        </div>
        <span
          style={{
            fontSize: 26,
            lineHeight: 1.4,
            color: '#A1A1AA',
            maxWidth: 920,
          }}
        >
          {meta.description}
        </span>
      </div>

      {/* Bottom: pricing + url */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 28,
          borderTop: '1px solid #1A1A1A',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontWeight: 500,
              fontSize: 14,
              letterSpacing: '0.08em',
              color: '#52525B',
              textTransform: 'uppercase',
            }}
          >
            From
          </span>
          <span
            style={{
              display: 'flex',
              alignItems: 'baseline',
              fontWeight: 500,
              fontSize: 22,
              color: '#FFFFFF',
            }}
          >
            {meta.pricing.modifier ?? ''}
            {meta.pricing.price}
            <span style={{ color: '#52525B', fontSize: 16, marginLeft: 4 }}>
              {meta.pricing.period}
            </span>
          </span>
        </div>
        <span style={{ fontSize: 18, color: '#52525B' }}>sparx.works/{meta.slug}</span>
      </div>
    </div>,
    { ...OG_SIZE }
  );
}
