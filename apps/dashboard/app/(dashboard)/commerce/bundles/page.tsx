import { Package2, Plus } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

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

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BundlesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, { data: bundles, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<BundleRow[]>(
      `/v1/commerce/bundles?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? bundles.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Package2 className="h-5 w-5" />}
          title="Bundles"
          badge={<Badge color="module">{total}</Badge>}
          description="A bundle is a wrapper product that resolves to a fixed set of component variants. Use the Configurator instead when components are user-selectable."
          actions={
            <EntityCreateButton
              entityType="bundle"
              newHref="/commerce/bundles/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New bundle
            </EntityCreateButton>
          }
        />

        <ListToolbar enableViewToggle searchable={false} />

        {bundles.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Package2 className="h-5 w-5" />}
              title="No bundles yet"
              description="Create a wrapper product first (e.g. ‘Starter Beauty Kit’), then bundle its components here."
              action={
                <EntityCreateButton
                  entityType="bundle"
                  newHref="/commerce/bundles/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New bundle
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <BundlesList bundles={bundles} view={view} />
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
