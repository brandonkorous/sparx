import { Layers, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { RecomputeButton } from './_components/recompute-button';
import { SegmentsList, type SegmentListRow } from './_components/segments-list';

// Segments index — a standard docs/34 List surface: a ListToolbar with an
// archived filter + Table/Cards toggle on top of the shared SelectionList. The
// create form, recompute button, and rule-builder live on their own surfaces.
//
// The archived filter maps to the API's only facet (`include_archived`):
// `active` (default) fetches non-archived; `all` includes archived; `archived`
// fetches all then narrows to archived rows server-side here.

export const dynamic = 'force-dynamic';

const ARCHIVED_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

interface SegmentRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isBuiltIn: boolean;
  archivedAt: string | null;
}

interface MemberCountResponse {
  total: number;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SegmentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const archived = parseArchived(stringParam(params.archived));
  const q = stringParam(params.q);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (archived !== 'active') query.set('include_archived', 'true');
  if (q) query.set('q', q);
  const [prefs, { data: fetched, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<SegmentRow[]>(`/v1/crm/segments?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? fetched.length;

  // `archived` narrows the all-inclusive fetch to just archived rows.
  const visible = archived === 'archived' ? fetched.filter((s) => s.archivedAt) : fetched;

  const counts = await Promise.all(
    visible.map((s) =>
      api
        .get<MemberCountResponse>(`/v1/crm/segments/${s.id}/member-count`)
        .then((r) => ({ id: s.id, count: r.total }))
    )
  );
  const countById = new Map(counts.map((c) => [c.id, c.count]));

  const segments: SegmentListRow[] = visible.map((s) => ({
    ...s,
    memberCount: countById.get(s.id) ?? 0,
  }));
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<Layers className="h-5 w-5" />}
          title="Segments"
          badge={
            <Badge color="module">
              {segments.length} segment{segments.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Live customer audiences updated incrementally as events flow. Email broadcasts and automations target segments by name; membership joins are O(1)."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search name or description…"
          filters={[
            { key: 'archived', label: 'Status', options: ARCHIVED_OPTIONS, defaultValue: 'active' },
          ]}
          enableViewToggle
          actions={<RecomputeButton />}
          primaryAction={
            <EntityCreateButton
              entityType="segment"
              newHref="/crm/segments/new"
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
      {segments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title={
              q
                ? 'No segments match this search'
                : archived === 'archived'
                  ? 'No archived segments'
                  : 'No segments yet'
            }
            description={
              q
                ? 'Try a different name or description keyword.'
                : archived === 'archived'
                  ? 'Archived segments stay out of the active list. Switch the filter to Active or All to see the rest.'
                  : "Built-in segments like High Value and At Risk are seeded automatically — if you see this, the seed didn't run. Create one to get started."
            }
            actions={
              archived === 'archived' || q ? undefined : (
                <EntityCreateButton
                  entityType="segment"
                  newHref="/crm/segments/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              )
            }
          />
        </Card>
      ) : (
        <SegmentsList segments={segments} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function parseArchived(v: string | undefined): 'active' | 'archived' | 'all' {
  return v === 'archived' || v === 'all' ? v : 'active';
}
