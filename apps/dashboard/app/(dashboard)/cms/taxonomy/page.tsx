// Taxonomies index — a standard Collection/List surface (docs/34 §7): a
// surface-aware "New" affordance in the header (drawer/modal/page/new-tab per
// preference), then a ListToolbar with a Table/Cards toggle honoring the user's
// defaultListView over the existing taxonomies. The card view is preserved as the
// `card` slot; the table mirrors its key fields.

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { Plus, Tag } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { TaxonomiesList, type TaxonomyListItem } from './_components/taxonomies-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TaxonomyIndexPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, { data: taxonomies, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<TaxonomyListItem[]>(
      `/v1/taxonomies?${new URLSearchParams({ take: String(take), skip: String(skip) }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? taxonomies.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<Tag className="h-5 w-5" />}
          title="Taxonomies"
          badge={
            <Badge color="neutral" variant="soft" size="sm">
              {total}
            </Badge>
          }
          description="Tenant-defined vocabularies. Mark hierarchical to allow parent/child term nesting (good for categories); leave flat for tag-style lists."
        />
      }
      toolbar={
        <ListToolbar
          searchable={false}
          enableViewToggle
          primaryAction={
            <EntityCreateButton
              entityType="taxonomy"
              newHref="/cms/taxonomy/new"
              color="module"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />
      }
      pager={<ListPager total={total} />}
    >
      {taxonomies.length === 0 ? (
        <Card className="bg-module bg-soft">
          <EmptyState
            icon={<Tag className="h-5 w-5" />}
            title="No taxonomies yet"
            description="Add your first taxonomy with the New button. Tags and categories group entries on storefront index pages and feeds."
            actions={
              <EntityCreateButton
                entityType="taxonomy"
                newHref="/cms/taxonomy/new"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            }
          />
        </Card>
      ) : (
        <TaxonomiesList rows={taxonomies} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
