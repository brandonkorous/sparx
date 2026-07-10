import { DollarSign } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { TierCreateButton } from './_components/tier-create-button';
import { PricingTiersList, type PricingTierRow } from './_components/pricing-tiers-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PricingTiersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);

  const [prefs, paged] = await Promise.all([
    getUserPreferences(),
    api.getPaged<PricingTierRow[]>(
      `/v1/b2b/pricing-tiers?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
      }).toString()}`
    ),
  ]);
  const tiers = paged.data;
  const total = (paged.meta?.total as number | undefined) ?? tiers.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<DollarSign className="h-5 w-5" />}
          title="Pricing tiers"
          badge={
            <Badge color="module">
              {total} tier{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Named discount structures applied to B2B accounts. Product-level overrides take precedence over tier discounts."
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search tier name…"
          enableViewToggle
          primaryAction={<TierCreateButton />}
        />
      }
      pager={<ListPager total={total} />}
    >
      {tiers.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              icon={<DollarSign className="h-5 w-5" />}
              title={q ? 'No pricing tiers match this search' : 'No pricing tiers yet'}
              description={
                q
                  ? 'Clear the search to see every pricing tier.'
                  : 'Create a pricing tier to apply automatic discounts to wholesale or fleet accounts.'
              }
              actions={q ? undefined : <TierCreateButton />}
            />
          </CardBody>
        </Card>
      ) : (
        <PricingTiersList rows={tiers} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
