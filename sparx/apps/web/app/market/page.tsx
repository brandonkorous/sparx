// The public extension-catalog home (docs/60 §4 Home tier, Phase 5). Curated
// entry: hero, the category grid (live + coming-soon), and a featured strip of
// the most popular blueprints. Indexed — this is the top of the acquisition
// funnel.
//
// NOT the same product as sparx.market. This catalog sells blueprints, themes,
// integrations, and components TO businesses building a site; sparx.market is a
// separate deployed app (sparx/apps/market) where shoppers buy products FROM those
// businesses, reverse-proxied on its own domain by Caddy. An earlier plan had
// sparx.market 301 into this path — that was abandoned when the marketplace
// became its own app, so do not reintroduce a redirect between the two.

import type { Metadata } from 'next';
import { Button } from '@wizeworks/silicaui-react';
import { Section, SectionHeader, Display, Spark } from '@/components/marketing/primitives';
import { fetchCategory, signUpHref } from '@/lib/marketplace';
import { ListingCard } from './_components/listing-card';
import { CategoryTiles } from './_components/category-tiles';

export const metadata: Metadata = {
  title: 'Marketplace — sparx',
  description:
    'Blueprints, themes, components, and integrations for sparx. Start from a whole themed site — pages, products, content, and emails — and go live in minutes.',
  alternates: { canonical: '/market' },
};

// The catalog is fetched at request time but cached (revalidate) by the data
// layer; keep the page itself dynamic so a fresh seed shows up promptly.
export const revalidate = 300;

export default async function MarketplaceHomePage() {
  // One request per category (all cached by the data layer) so every tile shows a
  // real count — themes + components are live shelves now, not "coming soon" teasers.
  const [featured, themes, components, integrations] = await Promise.all([
    fetchCategory('blueprints', { sort: 'popular', limit: '6' }),
    fetchCategory('themes', { limit: '1' }),
    fetchCategory('components', { limit: '1' }),
    fetchCategory('integrations', { limit: '1' }),
  ]);
  const counts: Record<string, number> = {
    blueprints: featured.total,
    themes: themes.total,
    components: components.total,
    integrations: integrations.total,
  };

  return (
    <>
      <Section surface="page" padding="xl">
        <div className="flex flex-col items-start gap-8">
          <SectionHeader
            accent="var(--color-primary)"
            headlineSize={88}
            headline={
              <>
                Everything to launch <span>in one place</span>
              </>
            }
            lede={
              <>
                Blueprints, themes, components, and integrations — curated for sparx. Start from a
                whole themed site and customize from there. AI builds it, sparx keeps it.
              </>
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <a href={signUpHref()}>
              <Button color="primary" size="lg">
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
        <div className="flex flex-col gap-10">
          <SectionHeader
            accent="var(--color-primary)"
            headlineSize={48}
            headline="Browse by category"
            lede="Start from a whole themed site, restyle it with a theme, or drop in a ready-made section — every listing previews live, right here in your browser."
          />
          <CategoryTiles counts={counts} />
        </div>
      </Section>

      {featured.items.length > 0 ? (
        <Section surface="page" padding="lg">
          <div className="flex flex-col gap-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <Display as="h2" size={40}>
                Featured blueprints
                <Spark />
              </Display>
              <a
                href="/market/blueprints"
                className="text-primary text-sm font-medium no-underline"
              >
                See all {featured.total} →
              </a>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.items.map((item) => (
                <ListingCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      <Section surface="dark" padding="lg">
        <div className="flex flex-col items-start gap-6">
          <SectionHeader
            invert
            accent="var(--color-primary)"
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
            <Button color="primary" size="lg">
              Start free
            </Button>
          </a>
        </div>
      </Section>
    </>
  );
}
