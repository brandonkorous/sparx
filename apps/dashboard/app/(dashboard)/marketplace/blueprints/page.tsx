// /marketplace/blueprints — the Blueprints category browse (docs/60 §5). Reads
// filter/sort/search from the URL, fetches page 1 server-side against the faceted
// contract, and hands it to the client browse component. The `key` (the query
// string) remounts that component when filters change, so its accumulated
// "Load more" list resets to the new page.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireSession } from '@sparx/auth';
import { Button, Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { getCategory } from '../_registry';
import type { BrowseResponse } from '../_types';
import { BlueprintsBrowse } from './_components/blueprints-browse';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function BlueprintsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const category = getCategory('blueprints');
  if (!category) notFound();

  const session = await requireSession();
  const canInstall = session.user.role === 'owner' || session.user.role === 'admin';

  const query = new URLSearchParams();
  for (const key of ['q', 'vertical', 'modules', 'status', 'sort']) {
    const v = sp[key];
    if (typeof v === 'string' && v) query.set(key, v);
  }
  query.set('limit', '24');
  const qs = query.toString();
  const data = await api.get<BrowseResponse>(`/v1/marketplace/blueprints?${qs}`);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2">
            <Link href="/marketplace">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Marketplace
            </Link>
          </Button>
          <PageHeader title="Blueprints" description={category.tagline} />
        </div>

        <BlueprintsBrowse
          key={qs}
          singular={category.singular}
          sorts={category.sorts}
          initialItems={data.items}
          facets={data.facets}
          total={data.total}
          initialCursor={data.next_cursor}
          canInstall={canInstall}
        />
      </Stack>
    </Container>
  );
}
