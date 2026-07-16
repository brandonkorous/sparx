// Authors index — a standard Collection/List surface (docs/34 §7): a header
// "New" affordance (surface-aware EntityCreateButton → drawer/modal/page), then
// a ListToolbar with a Table/Cards toggle honoring the user's defaultListView
// over the existing authors. The card view is preserved as the `card` slot; the
// table mirrors its key fields.

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
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
  const q = stringParam(params.q);

  const [prefs, { data: authors, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<AuthorListItem[]>(
      `/v1/authors?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? authors.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          title="Authors"
          badge={
            <Badge color="neutral" variant="soft" size="sm">
              {total}
            </Badge>
          }
          description="Bylines for blog posts and editorial entries. An author is independent from a staff user — a user can write under multiple pen names, an author can outlive a user row."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search name, slug, or bio…"
          enableViewToggle
          primaryAction={
            <EntityCreateButton
              entityType="author"
              newHref="/cms/authors/new"
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
      {authors.length === 0 ? (
        <Card className="bg-module bg-soft">
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={total === 0 ? 'No authors yet' : 'No authors match this search'}
            description={
              total === 0
                ? 'Add your first author to start attributing blog posts and editorial entries.'
                : 'Try a different name, slug, or bio keyword.'
            }
            actions={
              total === 0 ? (
                <EntityCreateButton
                  entityType="author"
                  newHref="/cms/authors/new"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <p className="text-base-content mb-6 text-sm">
            Click an author to edit name, slug, and bio.
          </p>
          <AuthorsList rows={authors} view={view} />
        </>
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
