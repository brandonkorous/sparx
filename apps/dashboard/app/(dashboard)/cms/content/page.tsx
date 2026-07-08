// Unified content list — every content-type ENTRY in one place (docs/51:
// content items are entries of a content type; the schemas/models live at
// /cms/types). Standard list surface (docs/34 §7): URL-driven search + Type
// and Status facets + Table/Cards toggle + offset pagination (ListPager). Rows open in the
// user's preferred detail surface via EntityRowLink — `page` entries keep their
// bespoke editor (/cms/[id]); every other type opens the generic content-entry
// editor. The CMS module gate runs in layout.tsx.
//
// Replaces the old /cms/pages list, which was this exact surface hardcoded to a
// single type. A content type links to its items as /cms/content?type=<key>.

import Link from 'next/link';
import { PageHeader } from '@sparx/ui';
import { Badge, Button, Card, EmptyState } from 'silicaui-react';
import { FileText } from 'lucide-react';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { resolveSiteScope, resolvePropertyFilter } from '@/lib/sites';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { ContentNewButton } from './content-new-button';
import { ContentSelectionTable } from './_components/content-selection-table';

export const dynamic = 'force-dynamic';

interface ApiContentType {
  key: string;
  name: string;
  plural_name: string;
  is_built_in: boolean;
}

interface ApiEntry {
  id: string;
  type_key: string;
  slug: string | null;
  status: string;
  body: { title?: string; name?: string } & Record<string, unknown>;
  updated_at: string;
  published_at: string | null;
}

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' },
];

function asString(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) usp.set(k, v);
  }
  return usp.toString();
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContentListPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { skip, take } = parsePageParams(sp, PAGE_SIZE);
  const type = asString(sp.type);
  const status = asString(sp.status);
  const q = asString(sp.q);
  const viewParam = asString(sp.view);
  // Model B (docs/49 §3): which site's content to show. Like the catalog, the
  // list follows the global site switcher — absent `?site=` → the ACTIVE site;
  // `?site=all` → every site; a specific id → that site.
  const siteParam = asString(sp.site);

  // Resolve the active site BEFORE the entries fetch so the list defaults to it.
  const [prefs, types, scope] = await Promise.all([
    getUserPreferences(),
    api.get<ApiContentType[]>('/v1/content/types?take=250'),
    resolveSiteScope(),
  ]);
  const { sites, multiSite, activePropertyId } = scope;
  const propertyFilter = resolvePropertyFilter(scope, siteParam);

  const paged = await api.getPaged<ApiEntry[]>(
    `/v1/content/entries?${buildQuery({
      take: String(take),
      skip: String(skip),
      ...(type && type !== 'all' ? { type } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      ...(q ? { q } : {}),
      ...(propertyFilter ? { property: propertyFilter } : {}),
    })}`
  );
  const entries = paged.data;
  const total = (paged.meta?.total as number | undefined) ?? entries.length;
  // `?view=` overrides; absent → the user's saved default (docs/34 §7.2).
  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const typeName = new Map(types.map((t) => [t.key, t.name]));
  const TYPE_OPTIONS = types.map((t) => ({ value: t.key, label: t.plural_name }));
  const NEW_TYPES = types.map((t) => ({ key: t.key, name: t.name }));
  // The Site filter only appears for multi-site tenants; it defaults to the
  // active site (mirroring the global switcher) with an "All sites" escape.
  const siteFilter = multiSite
    ? [
        {
          key: 'site',
          label: 'Site',
          defaultValue: activePropertyId,
          options: [
            { value: 'all', label: 'All sites' },
            ...sites.map((s) => ({ value: s.id, label: s.name })),
          ],
        },
      ]
    : [];
  // When a single type is selected every row shares it, so the Type column is
  // redundant noise — hide it.
  const showType = !(type && type !== 'all');

  const isFiltered =
    Boolean(type && type !== 'all') || Boolean(status && status !== 'all') || Boolean(q);

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          className="mb-0"
          icon={<FileText className="h-5 w-5" />}
          title="Content"
          badge={
            <Badge color="neutral" variant="soft" size="sm">
              {total}
            </Badge>
          }
          description="Every page, post, and entry across your content types."
          actions={
            <ContentNewButton
              types={NEW_TYPES}
              activeType={type && type !== 'all' ? type : undefined}
            />
          }
        />

        <ListToolbar
          searchPlaceholder="Search by title or slug…"
          filters={[
            { key: 'type', label: 'Types', options: TYPE_OPTIONS },
            { key: 'status', label: 'Statuses', options: STATUS_OPTIONS },
            ...siteFilter,
          ]}
          enableViewToggle
        />

        {entries.length === 0 ? (
          <Card className="bg-module bg-soft">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title={isFiltered ? 'No content matches your filter' : 'No content yet'}
              description={
                isFiltered
                  ? 'Try clearing the filter or searching for a different term.'
                  : 'Create your first page or post to get started.'
              }
              actions={
                isFiltered ? (
                  <Button variant="ghost" render={<Link href="/cms/content" />}>
                    Clear filters
                  </Button>
                ) : (
                  <ContentNewButton
                    types={NEW_TYPES}
                    activeType={type && type !== 'all' ? type : undefined}
                  />
                )
              }
            />
          </Card>
        ) : (
          <ContentSelectionTable
            entries={entries}
            view={view}
            showType={showType}
            typeName={Object.fromEntries(typeName)}
          />
        )}

        <ListPager total={total} />
      </div>
    </div>
  );
}
