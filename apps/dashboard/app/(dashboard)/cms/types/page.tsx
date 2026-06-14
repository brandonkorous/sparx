// Content type browser — the schemas/models, not the items.
//
// Lists every content type the tenant can author (built-ins + any custom
// tenant-defined types), with a per-type entry count. The type name and count
// link to that type's items on the unified content list (/cms/content?type=...);
// the "Schema" action opens the type's identity + schema editor (custom) /
// read-only schema (built-in) in the user's preferred detail surface. A standard
// Collection/List surface (docs/34 §7): ListToolbar with a Table/Cards toggle
// honoring the user's defaultListView.

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';
import { Database, Plus } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
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

export default async function ContentTypesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [prefs, types, entries] = await Promise.all([
    getUserPreferences(),
    api.get<ApiContentType[]>('/v1/content/types'),
    api.get<ApiEntry[]>('/v1/content/entries?limit=250'),
  ]);

  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.type_key] = (counts[e.type_key] ?? 0) + 1;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Database className="h-5 w-5" />}
          title="Content types"
          badge={<Badge variant="outline">{types.length}</Badge>}
          description="The authoring shapes behind your content — pages, posts, FAQs, and any custom type. Click a type to see its items, or open its schema to edit the fields."
          actions={
            <EntityCreateButton
              entityType="content-type"
              newHref="/cms/types/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar enableViewToggle searchable={false} />

        {types.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<Database className="h-5 w-5" />}
              title="No content types yet"
              description="Define a custom authoring shape — testimonials, case studies, events — with its own field schema."
              action={
                <EntityCreateButton
                  entityType="content-type"
                  newHref="/cms/types/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <ContentTypesList types={types} counts={counts} view={view} />
        )}
      </Stack>
    </Container>
  );
}
