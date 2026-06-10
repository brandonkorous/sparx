// /marketplace — the unified Marketplace home (docs/60 §3). A curated entry, not
// a full listing: global search, a registry-driven grid of category tiles
// (Blueprints live; Themes/Integrations/Components coming-soon), and a featured
// strip per live category. Browsing the full catalog happens on the category
// route (/marketplace/blueprints). Platform-level (no ModuleGate) — rail-pinned
// beside SEO/Settings; installing a blueprint enables the Builder.

import Link from 'next/link';
import { ArrowRight, Store } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Button, Container, Grid, Heading, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { MARKETPLACE_CATEGORIES } from './_registry';
import type { MarketplaceListResponse } from './_types';
import { CategoryTile } from './_components/category-tile';
import { ListingCard } from './_components/listing-card';
import { MarketplaceSearch } from './_components/marketplace-search';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  const session = await requireSession();
  const canInstall = session.user.role === 'owner' || session.user.role === 'admin';

  const featured = await api
    .get<MarketplaceListResponse>('/v1/marketplace/blueprints?limit=6&sort=popular')
    .catch(() => null);
  const blueprintCount = featured?.total ?? 0;

  return (
    <Container size="xl">
      <Stack gap={8} className="py-10">
        <Stack gap={4}>
          <PageHeader
            icon={<Store className="h-5 w-5" />}
            title="Marketplace"
            description="Add ready-made building blocks to your tenant — blueprints, themes, integrations, and more."
          />
          <MarketplaceSearch />
        </Stack>

        <Grid minItemWidth="15rem" gap={4}>
          {MARKETPLACE_CATEGORIES.map((c) => (
            <CategoryTile
              key={c.id}
              category={c}
              count={c.id === 'blueprints' ? blueprintCount : undefined}
            />
          ))}
        </Grid>

        {featured && featured.items.length > 0 ? (
          <Stack gap={4}>
            <div className="flex items-baseline justify-between">
              <Heading level={2}>Featured blueprints</Heading>
              <Button variant="link" size="sm" asChild>
                <Link href="/marketplace/blueprints">
                  See all {blueprintCount.toLocaleString()}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <Grid minItemWidth="16rem" gap={4}>
              {featured.items.map((item) => (
                <ListingCard key={item.slug} item={item} canInstall={canInstall} />
              ))}
            </Grid>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
