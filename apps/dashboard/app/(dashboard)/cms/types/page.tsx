// Content type browser — the schemas/models, not the items.
//
// Lists every content type the tenant can author (built-ins + any custom
// tenant-defined types), with a per-type entry count. The type name and count
// link to that type's items on the unified content list (/cms/content?type=...);
// the "Schema" action opens the type's identity + schema editor (custom) /
// read-only schema (built-in) in the user's preferred detail surface. A standard
// Collection/List surface (docs/34 §7): ListToolbar with a Table/Cards toggle
// honoring the user's defaultListView.

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { Database, Plus } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { ContentTypesList } from './_components/content-types-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ApiContentType {
  key: string;
  name: string;
  plural_name: string;
  url_pattern: string | null;
  is_built_in: boolean;
  is_singleton: boolean;
  description: string | null;
}

interface ApiEntry {
  id: string;
  type_key: string;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

const KIND_OPTIONS = [
  { value: 'built_in', label: 'Built-in' },
  { value: 'custom', label: 'Custom' },
];

export default async function ContentTypesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const kind = stringParam(params.kind);

  const [prefs, { data: types, meta }, entries] = await Promise.all([
    getUserPreferences(),
    api.getPaged<ApiContentType[]>(
      `/v1/content/types?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
        ...(kind ? { kind } : {}),
      }).toString()}`
    ),
    // Per-type entry counts: a bounded sample of recent entries (the column is an
    // at-a-glance count, not an exact total). Switched from the retired `limit`
    // param to `take` when entries moved to offset pagination.
    api.get<ApiEntry[]>('/v1/content/entries?take=250'),
  ]);
  const total = (meta?.total as number | undefined) ?? types.length;

  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.type_key] = (counts[e.type_key] ?? 0) + 1;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<Database className="h-5 w-5" />}
          title="Content types"
          badge={
            <Badge color="neutral" variant="soft" size="sm">
              {total}
            </Badge>
          }
          description="The authoring shapes behind your content — pages, posts, FAQs, and any custom type. Click a type to see its items, or open its schema to edit the fields."
        />
      }
      toolbar={
        <ListToolbar
          enableViewToggle
          searchPlaceholder="Search name or description…"
          filters={[{ key: 'kind', label: 'Kinds', options: KIND_OPTIONS }]}
          primaryAction={
            <EntityCreateButton
              entityType="content-type"
              newHref="/cms/types/new"
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
      {types.length === 0 ? (
        <Card className="bg-module bg-soft">
          <EmptyState
            icon={<Database className="h-5 w-5" />}
            title={total === 0 ? 'No content types yet' : 'No content types match these filters'}
            description={
              total === 0
                ? 'Define a custom authoring shape — testimonials, case studies, events — with its own field schema.'
                : 'Adjust filters or clear the search to broaden the results.'
            }
            actions={
              total === 0 ? (
                <EntityCreateButton
                  entityType="content-type"
                  newHref="/cms/types/new"
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
        <ContentTypesList types={types} counts={counts} view={view} />
      )}
    </ListPageShell>
  );
}
