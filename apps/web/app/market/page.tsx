// The public marketplace home (docs/60 §4 Home tier, Phase 5). Curated entry:
// hero, the category grid (live + coming-soon), and a featured strip of the most
// popular blueprints. Served at /market so the sparx.market vanity domain (Caddy
// 301 → sparx.works/market) lands directly here. Indexed — this is the top of the
// acquisition funnel.

import type { Metadata } from 'next';
import { Button } from '@sparx/ui';
import { Nav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { Section, SectionHeader, Display, Spark } from '@/components/marketing/primitives';
import { fetchCategory, signUpHref } from '@/lib/marketplace';
import { ListingCard } from './_components/listing-card';
import { CategoryTiles } from './_components/category-tiles';

export const metadata: Metadata = {
  title: 'Marketplace — Sparx',
  description:
    'Blueprints, themes, components, and integrations for Sparx. Start from a whole themed site — pages, products, content, and emails — and go live in minutes.',
  alternates: { canonical: '/market' },
};

// The catalog is fetched at request time but cached (revalidate) by the data
// layer; keep the page itself dynamic so a fresh seed shows up promptly.
export const revalidate = 300;

export default async function MarketplaceHomePage() {
  const featured = await fetchCategory('blueprints', { sort: 'popular', limit: '6' });
  const counts: Record<string, number> = { blueprints: featured.total };

  return (
    <>
      <Nav />

      <Section surface="page" padding="xl">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            alignItems: 'flex-start',
          }}
        >
          <SectionHeader
            accent="var(--sparx-primary)"
            headlineSize={88}
            headline={
              <>
                Everything to launch{' '}
                <span style={{ color: 'var(--color-text-tertiary)' }}>in one place</span>
              </>
            }
            lede={
              <>
                Blueprints, themes, components, and integrations — curated for Sparx. Start from a
                whole themed site and customize from there. AI builds it, Sparx keeps it.
              </>
            }
          />
          <div className="mkt-cluster" style={{ gap: '12px' }}>
            <a href={signUpHref()}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Start free
              </Button>
            </a>
            <a href="#categories">
              <Button size="lg" variant="outline">
                Browse the catalog
              </Button>
            </a>
          </div>
        </div>
      </Section>

      <Section id="categories" surface="surface" padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <SectionHeader
            accent="var(--sparx-primary)"
            headlineSize={48}
            headline="Browse by category"
            lede="Each category grows on its own — install a blueprint today; themes, components, and integrations are landing next."
          />
          <CategoryTiles counts={counts} />
        </div>
      </Section>

      {featured.items.length > 0 ? (
        <Section surface="page" padding="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              <Display as="h2" size={40}>
                Featured blueprints
                <Spark />
              </Display>
              <a
                href="/market/blueprints"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: 'var(--sparx-primary)',
                  textDecoration: 'none',
                }}
              >
                See all {featured.total} →
              </a>
            </div>
            <div className="mkt-grid-3-2-1">
              {featured.items.map((item) => (
                <ListingCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      <Section surface="dark" padding="lg">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '24px',
          }}
        >
          <SectionHeader
            invert
            accent="var(--sparx-primary)"
            headlineSize={56}
            headline={
              <>
                Pick a blueprint. Go live in minutes
                <Spark />
              </>
            }
            lede="Sign up, install, and your themed site, products, content, and emails are waiting as drafts. Review, customize, publish."
          />
          <a href={signUpHref()}>
            <Button size="lg" style={{ backgroundColor: '#FFFFFF', color: '#0A0A0A' }}>
              Start free
            </Button>
          </a>
        </div>
      </Section>

      <Footer />
    </>
  );
}
