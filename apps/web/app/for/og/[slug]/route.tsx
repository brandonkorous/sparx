import { ImageResponse } from 'next/og';
import { BRAND, MODULE_HEX } from '@sparx/brand';
import { getVertical, VERTICALS } from '@/components/marketing/verticals/registry';
import { verticalStack } from '@/components/marketing/verticals/stack';
import { OgWordmark } from '@/lib/og-wordmark';

/**
 * Per-industry Open Graph card (1200×630).
 *
 * These pages set their own `openGraph` block, which stops them inheriting the
 * root card — so without this route a shared link would preview with no image
 * at all. Since every share of one of these is a paid or social click, the card
 * carries the two facts that decide whether it converts: WHO it is for, and the
 * monthly price for that industry's stack.
 *
 * The price is computed from the same source as the page's table, so a share
 * card can never quote a figure the landing page contradicts.
 *
 * ## Why literal hex here and nowhere else
 *
 * Satori cannot resolve CSS custom properties, so `var(--color-module-crm)`
 * renders as nothing. `MODULE_HEX` in `@sparx/brand` is the one sanctioned
 * TypeScript copy of the palette for exactly this case (CLAUDE.md, RULE #1).
 * Do not copy these values anywhere a stylesheet could have reached.
 */
export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };
const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

/**
 * The ink that goes ON a module hue, derived rather than assumed.
 *
 * In the browser this pairing is a token (`--color-module-x-content`) and never
 * a decision a call site makes. Satori cannot read tokens, so the card has to
 * resolve it — and the previous approach, hard-coding near-black the way the
 * tools card does, is wrong for the darker half of the palette: measured on
 * Invoicing's olive (`#4d7c0f`) it lands at 3.78:1, under the bar for a 20px
 * label. Relative luminance decides it correctly for all fifteen hues, and
 * keeps deciding correctly if one of them is re-pointed.
 */
function inkOn(hex: string): string {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return luminance > 0.35 ? BRAND.ink : '#ffffff';
}

/** Statically generate all six at build — they are a fixed, known set. */
export function generateStaticParams(): { slug: string }[] {
  return VERTICALS.map((v) => ({ slug: v.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vertical = getVertical(slug);
  if (!vertical) return new Response('Not found', { status: 404 });

  const accent = MODULE_HEX[vertical.lead as keyof typeof MODULE_HEX] ?? BRAND.primary;
  const stack = verticalStack(vertical);

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
        borderTop: `14px solid ${accent}`,
        fontFamily: SYSTEM_FONT,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgWordmark height={34} />
        <div
          style={{
            display: 'flex',
            fontSize: 20,
            fontWeight: 600,
            color: inkOn(accent),
            backgroundColor: accent,
            padding: '10px 20px',
            borderRadius: 9999,
          }}
        >
          {vertical.label}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          {vertical.headline}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#d4d4d8', lineHeight: 1.35 }}>
          {vertical.alsoCalled.slice(0, 4).join(' · ')}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderTop: '1px solid #3f3f46',
          paddingTop: 28,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: BRAND.primary }}>
            {`$${stack.monthly}/mo`}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#a1a1aa' }}>
            {`The usual stack for ${vertical.plural}`}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: '#a1a1aa' }}>
          {`sparx.works/for/${vertical.slug}`}
        </div>
      </div>
    </div>,
    SIZE
  );
}
