import { Package2, Plus } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { BundlesList, type BundleRow } from './_components/bundles-list';

// Bundles — kit / pack / gift-set wrappers around N component variants.
// One wrapper product = one bundle, set via `bundleProductId`. The
// configurator + cart pipelines decrement inventory per inventoryMode.

export const dynamic = 'force-dynamic';

const PRICING_MODE_OPTIONS = [
  { value: 'sum_of_components', label: 'Sum of components' },
  { value: 'fixed', label: 'Fixed price' },
  { value: 'percent_off_sum', label: 'Percent off sum' },
];

const INVENTORY_MODE_OPTIONS = [
  { value: 'decrement_components', label: 'Decrement components' },
  { value: 'decrement_bundle_sku', label: 'Decrement bundle SKU' },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BundlesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const pricingMode = stringParam(params.pricing_mode);
  const inventoryMode = stringParam(params.inventory_mode);

  const [prefs, { data: bundles, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<BundleRow[]>(
      `/v1/commerce/bundles?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
        ...(pricingMode ? { pricing_mode: pricingMode } : {}),
        ...(inventoryMode ? { inventory_mode: inventoryMode } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? bundles.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<Package2 className="h-5 w-5" />}
          title="Bundles"
          badge={<Badge color="module">{total}</Badge>}
          description="A bundle is a wrapper product that resolves to a fixed set of component variants. Use the Configurator instead when components are user-selectable."
        />
      }
      toolbar={
        <ListToolbar
          enableViewToggle
          searchPlaceholder="Search bundles by wrapper product…"
          filters={[
            { key: 'pricing_mode', label: 'Pricing modes', options: PRICING_MODE_OPTIONS },
            { key: 'inventory_mode', label: 'Inventory modes', options: INVENTORY_MODE_OPTIONS },
          ]}
          primaryAction={
            <EntityCreateButton
              entityType="bundle"
              newHref="/commerce/bundles/new"
              color="module"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New bundle
            </EntityCreateButton>
          }
        />
      }
      pager={<ListPager total={total} />}
    >
      {bundles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package2 className="h-5 w-5" />}
            title={total === 0 ? 'No bundles yet' : 'No bundles match these filters'}
            description={
              total === 0
                ? 'Create a wrapper product first (e.g. ‘Starter Beauty Kit’), then bundle its components here.'
                : 'Adjust filters or clear the search to broaden the results.'
            }
            actions={
              total === 0 ? (
                <EntityCreateButton
                  entityType="bundle"
                  newHref="/commerce/bundles/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New bundle
                </EntityCreateButton>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <BundlesList bundles={bundles} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
