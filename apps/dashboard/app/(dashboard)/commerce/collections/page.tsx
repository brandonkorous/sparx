import { Layers, Plus } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { CollectionsSelectionTable } from './_components/collections-selection-table';
import type { CollectionSummary } from './_components/collections-selection-table';

interface CollectionListResponse {
  items: CollectionSummary[];
  total: number;
}

// Collections — the merchandising surface ("Featured", "New for Spring",
// "Diesel Service Specials"). Two flavors: manual (hand-curated product
// list) and rules-driven (predicate evaluated by the commerce-indexer
// worker on a debounce).

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'rules', label: 'Rules-driven' },
];

export default async function CollectionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const typeFilter = stringParam(params.type);
  const q = stringParam(params.q);

  const query = new URLSearchParams({ take: '100' });
  if (typeFilter === 'manual' || typeFilter === 'rules') query.set('type', typeFilter);
  if (q) query.set('q', q);

  const [{ items, total }, prefs] = await Promise.all([
    api.get<CollectionListResponse>(`/v1/commerce/collections?${query.toString()}`),
    getUserPreferences(),
  ]);
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Layers className="h-5 w-5" />}
          title="Collections"
          badge={
            <Badge color="module">
              {total} collection{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Manual lists and rules-driven smart collections. Manual stays the same until you edit it; rules re-project on the next index flush (Phase 1.5 wires the indexer)."
          actions={
            <EntityCreateButton
              entityType="collection"
              newHref="/commerce/collections/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar
          searchPlaceholder="Search collections…"
          filters={[{ key: 'type', label: 'Types', options: TYPE_OPTIONS }]}
          enableViewToggle
        />

        {items.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title={total === 0 ? 'No collections yet' : 'No collections match these filters'}
              description={
                total === 0
                  ? 'Start with a hand-picked "Featured" list, then add rules-driven collections (best sellers, on sale, by tag) once you have a few products.'
                  : 'Adjust filters to broaden the results.'
              }
              action={
                total === 0 ? (
                  <EntityCreateButton
                    entityType="collection"
                    newHref="/commerce/collections/new"
                    color="module"
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    New
                  </EntityCreateButton>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <CollectionsSelectionTable collections={items} view={view} />
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
