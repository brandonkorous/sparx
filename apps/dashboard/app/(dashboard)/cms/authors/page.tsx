// Authors index — a standard Collection/List surface (docs/34 §7): a header
// "New" affordance (surface-aware EntityCreateButton → drawer/modal/page), then
// a ListToolbar with a Table/Cards toggle honoring the user's defaultListView
// over the existing authors. The card view is preserved as the `card` slot; the
// table mirrors its key fields.

import { Badge, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';
import { Plus, Users } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { AuthorsList, type AuthorListItem } from './_components/authors-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuthorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, { data: authors, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<AuthorListItem[]>(
      `/v1/authors?${new URLSearchParams({ take: String(take), skip: String(skip) }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? authors.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Authors"
          badge={<Badge variant="outline">{total}</Badge>}
          description="Bylines for blog posts and editorial entries. An author is independent from a staff user — a user can write under multiple pen names, an author can outlive a user row."
          actions={
            <EntityCreateButton
              entityType="author"
              newHref="/cms/authors/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar searchable={false} enableViewToggle />

        {authors.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No authors yet"
              description="Add your first author to start attributing blog posts and editorial entries."
              action={
                <EntityCreateButton
                  entityType="author"
                  newHref="/cms/authors/new"
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
          <>
            <Text size="sm" variant="muted">
              Click an author to edit name, slug, and bio.
            </Text>
            <AuthorsList rows={authors} view={view} />
          </>
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
