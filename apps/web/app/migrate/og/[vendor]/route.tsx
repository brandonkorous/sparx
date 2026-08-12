import { ImageResponse } from 'next/og';
import { BRAND } from '@sparx/brand';
import { ENTITY_LABEL, vendorCapability } from '@sparx/migration';
import { MIGRATE_STORIES, getStory } from '@/components/marketing/migrate/stories';
import { OgWordmark } from '@/lib/og-wordmark';

/**
 * Per-platform Open Graph card (1200×630).
 *
 * These pages set their own `openGraph` block, so without this route a shared link
 * previews with no image. They matter more than most: a `/migrate/shopify` link gets
 * pasted into the exact forum thread where somebody is asking whether leaving is
 * worth it, and the card is the whole of the argument most people will read.
 *
 * So the card carries the two facts that decide it — the promise, and the specific
 * things that actually come across. The entity list is read from the adapter registry
 * rather than written here, which means a share card cannot claim something the
 * importer does not do, any more than the page can.
 *
 * Literal hex is used because Satori cannot resolve CSS custom properties; `BRAND` in
 * `@sparx/brand` is the sanctioned TypeScript copy of the palette for exactly this
 * case (CLAUDE.md, RULE #1). Do not copy these values anywhere a stylesheet reaches.
 */
export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };
const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Statically generate all twenty at build — a fixed, known set. */
export function generateStaticParams(): { vendor: string }[] {
  return MIGRATE_STORIES.map((story) => ({ vendor: story.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ vendor: string }> }) {
  const { vendor } = await params;
  const story = getStory(vendor);
  if (story === undefined) return new Response('Not found', { status: 404 });

  const capability = vendorCapability(story.slug);
  // Six is what fits on one line at this size without the row wrapping into the
  // headline. The page itself shows all of them.
  const entities = (capability?.entities ?? []).slice(0, 6);

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
        borderTop: `14px solid ${BRAND.primary}`,
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
            color: '#ffffff',
            backgroundColor: BRAND.primary,
            padding: '10px 20px',
            borderRadius: 9999,
          }}
        >
          {`Leaving ${story.name}`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          {story.headline}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {entities.map((entity) => (
            <div
              key={entity}
              style={{
                display: 'flex',
                fontSize: 22,
                color: '#d4d4d8',
                border: '1px solid #3f3f46',
                padding: '8px 16px',
                borderRadius: 9999,
              }}
            >
              {ENTITY_LABEL[entity].many}
            </div>
          ))}
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
        <div style={{ display: 'flex', fontSize: 26, color: '#a1a1aa', maxWidth: 780 }}>
          Nothing is saved until you have seen exactly what would happen.
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: '#a1a1aa' }}>
          {`sparx.works/migrate/${story.slug}`}
        </div>
      </div>
    </div>,
    SIZE
  );
}
