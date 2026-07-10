import { KanbanSquare, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { PipelinesList, type PipelineRow } from './_components/pipelines-list';

// Pipelines index — a standard docs/34 List surface: a ListToolbar with an
// archived filter + Table/Cards toggle on top of the shared SelectionList. The
// stage funnel is preserved inline (in both views) so the list communicates the
// shape of each pipeline without forcing a click into the detail page.
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

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PipelinesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const archived = parseArchived(stringParam(params.archived));

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (archived !== 'active') query.set('include_archived', 'true');
  const [prefs, { data: fetched, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<PipelineRow[]>(`/v1/crm/pipelines?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? fetched.length;

  // `archived` narrows the all-inclusive fetch to just archived rows.
  const pipelines = archived === 'archived' ? fetched.filter((p) => p.archivedAt) : fetched;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<KanbanSquare className="h-5 w-5" />}
          title="Pipelines"
          badge={
            <Badge color="module">
              {pipelines.length} pipeline{pipelines.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Each pipeline has its own ordered stage list. Deals move between stages on the Kanban board; stage probability feeds the forecast."
        />
      }
      toolbar={
        <ListToolbar
          searchable={false}
          filters={[
            { key: 'archived', label: 'Status', options: ARCHIVED_OPTIONS, defaultValue: 'active' },
          ]}
          enableViewToggle
          primaryAction={
            <EntityCreateButton
              entityType="pipeline"
              newHref="/crm/pipelines/new"
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
      {pipelines.length === 0 ? (
        <Card>
          <EmptyState
            icon={<KanbanSquare className="h-5 w-5" />}
            title={archived === 'archived' ? 'No archived pipelines' : 'No pipelines yet'}
            description={
              archived === 'archived'
                ? 'Archived pipelines stay out of the active list. Switch the filter to Active or All to see the rest.'
                : 'A default pipeline is created when CRM is activated. If you cleared it, your tenant has no pipelines configured.'
            }
          />
        </Card>
      ) : (
        <PipelinesList pipelines={pipelines} view={view} />
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
