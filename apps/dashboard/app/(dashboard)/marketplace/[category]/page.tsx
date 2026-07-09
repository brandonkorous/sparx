// /marketplace/[category] — the generic category browse (docs/60 §5). Resolves
// the category from the registry, reads filter/sort/search from the URL, fetches
// page 1 server-side against the faceted contract, and hands it to the client
// browse component. The `key` (the query string) remounts that component when
// filters change, so its accumulated "Load more" list resets to the new page.
//
// Coming-soon categories render a graceful placeholder rather than fetching an
// empty catalog. (The `installs/[id]` route is statically segmented, so it never
// collides with this dynamic `[category]`.)

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Badge, Button, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';
import type { MarketplaceListResponse } from '../_types';

import { api } from '@/lib/api-rest-client';
import { getCategory } from '../_registry';
import { CategoryBrowse } from './_components/category-browse';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' && v ? v : undefined;
}

export default async function CategoryBrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { category: categoryId } = await params;
  const sp = await searchParams;
  const category = getCategory(categoryId);
  if (!category) notFound();

  const Icon = category.icon;
  const back = (
    <Button variant="ghost" size="sm" className="mb-1 -ml-2" render={<Link href="/marketplace" />}>
      <ArrowLeft className="mr-1 h-4 w-4" />
      Marketplace
    </Button>
  );

  if (category.status !== 'live') {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <div>
            {back}
            <PageHeader
              title={category.label}
              description={category.tagline}
              badge={
                <Badge color="info" variant="soft">
                  Coming soon
                </Badge>
              }
            />
          </div>
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<Icon className="h-5 w-5" />}
                title={`${category.label} are coming soon`}
                description={`The ${category.singular} catalog isn't open yet. Check back shortly — your tenant will be able to browse and add ${category.singular}s here.`}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  const session = await requireSession();
  const canInstall = session.user.role === 'owner' || session.user.role === 'admin';

  const query = new URLSearchParams();
  for (const f of category.facets) {
    const v = str(sp[f.key]);
    if (v) query.set(f.key, v);
  }
  const q = str(sp.q);
  if (q) query.set('q', q);
  const sort = str(sp.sort);
  if (sort) query.set('sort', sort);
  query.set('limit', '24');
  const qs = query.toString();

  const data = await api.get<MarketplaceListResponse>(`/v1/marketplace/${category.id}?${qs}`);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <div>
          {back}
          <PageHeader title={category.label} description={category.tagline} />
        </div>

        <CategoryBrowse
          key={qs}
          categoryId={category.id}
          singular={category.singular}
          sorts={category.sorts}
          facetSpecs={category.facets}
          initialItems={data.items}
          facets={data.facets}
          total={data.total}
          initialCursor={data.next_cursor}
          canInstall={canInstall}
        />
      </div>
    </div>
  );
}
