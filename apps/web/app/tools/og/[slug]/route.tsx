import { ImageResponse } from 'next/og';
import { getTool } from '@/components/marketing/tools/registry';

/**
 * Per-tool Open Graph card (1200×630). Tool pages set their own openGraph block,
 * which stops them inheriting the root card — so without this they'd share no
 * image at all. One dynamic route renders a branded, module-colored card for any
 * tool, referenced from toolMetadata's openGraph/twitter images.
 */
export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };

const ACCENT: Record<string, string> = {
  builder: '#6366F1',
  commerce: '#F97316',
  cms: '#14B8A6',
  crm: '#06B6D4',
  email: '#0EA5E9',
  b2b: '#64748B',
  ai: '#EC4899',
  dropship: '#10B981',
};

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return new Response('Not found', { status: 404 });

  const accent = ACCENT[tool.module] ?? '#6366F1';
  const tagline = tool.tagline.length > 132 ? `${tool.tagline.slice(0, 131)}…` : tool.tagline;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0A0A0A',
          padding: '72px',
          borderTop: `14px solid ${accent}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.03em' }}>
            spar<span style={{ color: '#6366F1' }}>x</span>
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: '#0A0A0A',
              backgroundColor: accent,
              padding: '10px 18px',
              borderRadius: 9999,
            }}
          >
            FREE TOOL
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 66,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              maxWidth: 980,
            }}
          >
            {tool.name}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#A1A1AA',
              lineHeight: 1.4,
              maxWidth: 960,
              marginTop: 24,
            }}
          >
            {tagline}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 9999, backgroundColor: accent }} />
          <div style={{ display: 'flex', fontSize: 22, color: '#71717A' }}>sparx.works/tools</div>
        </div>
      </div>
    ),
    SIZE
  );
}
