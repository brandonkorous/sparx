import { FolderTree, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { CategoriesTable, type CategoryNode } from './_components/categories-table';

// Categories — the organizational taxonomy ("Auto Parts > Engine > Fuel
// Injection"); the merchandising surface (Featured, New for Spring, etc.) lives
// in /commerce/collections. A product can sit in many categories but exactly one
// is canonical.
//
// Collection/List archetype (docs/34 §7), adapted for a tree: the standard
// SelectionList table/card chrome with hierarchy shown as indented, expandable
// rows. Each row links into the category's detail view (drawer / modal / full
// page per the user's preference), where rename / reslug / reparent / reorder /
// delete live — uniform with every other entity. The server enforces handle
// uniqueness, cycle prevention, and the remove-descendants-before-parent rule.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const FEATURED_OPTIONS = [
  { value: 'yes', label: 'Featured' },
  { value: 'no', label: 'Not featured' },
];

export default async function CategoriesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // The page owns the `q` fetch (docs/34 §7.1): search + the featured filter go
  // to the endpoint, which returns the full tree when neither is set and flat
  // matches when either is. Only this query swaps when search moves to Typesense.
  const q = stringParam(params.q);
  const featured = stringParam(params.featured);
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (featured) query.set('featured', featured);
  const qs = query.toString();

  const [tree, prefs] = await Promise.all([
    api.get<CategoryNode[]>(`/v1/commerce/categories${qs ? `?${qs}` : ''}`),
    getUserPreferences(),
  ]);
  const total = countTree(tree);
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<FolderTree className="h-5 w-5" />}
          title="Categories"
          badge={
            <Badge color="module">
              {total} categor{total === 1 ? 'y' : 'ies'}
            </Badge>
          }
          description="The organizational tree your shoppers browse. Nesting shows as indented rows you can expand or collapse; open a category to rename, reslug, reparent, reorder, or delete."
          actions={
            <EntityCreateButton
              entityType="category"
              newHref="/commerce/categories/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar
          searchPlaceholder="Search categories…"
          filters={[{ key: 'featured', label: 'Featured', options: FEATURED_OPTIONS }]}
          enableViewToggle
        />

        {tree.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FolderTree className="h-5 w-5" />}
              title="No categories yet"
              description="Start with a few top-level categories that match how shoppers browse your site."
              actions={
                <EntityCreateButton
                  entityType="category"
                  newHref="/commerce/categories/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <CategoriesTable tree={tree} view={view} q={q} featured={featured} />
        )}
      </div>
    </div>
  );
}

function countTree(nodes: CategoryNode[]): number {
  let total = 0;
  (function walk(list: CategoryNode[]) {
    for (const node of list) {
      total++;
      walk(node.children);
    }
  })(nodes);
  return total;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
