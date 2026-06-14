// Taxonomies index — a standard Collection/List surface (docs/34 §7): the create
// form on top, then a ListToolbar with a Table/Cards toggle honoring the user's
// defaultListView over the existing taxonomies. The card view is preserved as the
// `card` slot; the table mirrors its key fields.

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';
import { Tag } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { TaxonomyCreateForm } from './taxonomy-create-form';
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
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Tag className="h-5 w-5" />}
          title="Taxonomies"
          badge={<Badge variant="outline">{total}</Badge>}
          description="Tenant-defined vocabularies. Mark hierarchical to allow parent/child term nesting (good for categories); leave flat for tag-style lists."
        />

        <TaxonomyCreateForm />

        <ListToolbar searchable={false} enableViewToggle />

        {taxonomies.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<Tag className="h-5 w-5" />}
              title="No taxonomies yet"
              description="Add your first taxonomy above. Tags and categories group entries on storefront index pages and feeds."
            />
          </Card>
        ) : (
          <TaxonomiesList rows={taxonomies} view={view} />
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
