import { Briefcase, Plus } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { DealsList, type DealRow } from './_components/deals-list';

// Deals index — the flat, cross-pipeline list landing for the "Deals" nav item
// (the per-pipeline Kanban / list / forecast live under /crm/pipelines/[id]).
// A standard docs/34 List surface: ListToolbar (state + pipeline filters,
// Table/Cards toggle) over the shared SelectionList. The deals endpoint has no
// text search, so the search box is suppressed.
//
// The endpoint returns raw `pipelineId` / `stageId`; the human names + stage
// color live on the pipelines, so we fetch those once and fold the resolved
// `pipelineName` / `stage` onto each row before handing them to DealsList.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Raw shape returned by GET /v1/crm/deals (a subset of the Deal record).
interface DealApiRow {
  id: string;
  title: string;
  pipelineId: string;
  stageId: string;
  value: string | number;
  currency: string;
  probability: string | number;
  expectedCloseDate: string | null;
  closedAt: string | null;
  updatedAt: string;
}

interface PipelineStageLite {
  id: string;
  name: string;
  stageType: 'open' | 'won' | 'lost';
  color: string | null;
}

interface PipelineLite {
  id: string;
  name: string;
  stages: PipelineStageLite[];
}

const STATE_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export default async function DealsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const state = stringParam(params.state);
  const pipeline = stringParam(params.pipeline);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (state === 'open' || state === 'closed') query.set('state', state);
  if (pipeline) query.set('pipeline_id', pipeline);

  // `include_archived` so deals on an archived pipeline still resolve a name +
  // stage rather than falling back to a dash.
  const [prefs, { data: deals, meta }, { data: pipelines }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<DealApiRow[]>(`/v1/crm/deals?${query.toString()}`),
    api.getPaged<PipelineLite[]>('/v1/crm/pipelines?take=250&include_archived=true'),
  ]);
  const total = (meta?.total as number | undefined) ?? deals.length;

  const pipelineNames = new Map(pipelines.map((p) => [p.id, p.name]));
  const stageMeta = new Map(
    pipelines.flatMap((p) =>
      p.stages.map((s) => [s.id, { name: s.name, color: s.color, stageType: s.stageType }] as const)
    )
  );
  const rows: DealRow[] = deals.map((d) => ({
    ...d,
    pipelineName: pipelineNames.get(d.pipelineId) ?? '—',
    stage: stageMeta.get(d.stageId) ?? null,
  }));

  // `?view=` overrides; absent → the user's saved default (§7.2).
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';
  const pipelineOptions = pipelines.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Briefcase className="h-5 w-5" />}
          title="Deals"
          badge={
            <Badge color="module">
              {total} deal{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Every sales opportunity across all pipelines. Open a deal to attach orders and quotes; move it between stages on its pipeline's Kanban board, where stage probability feeds the forecast."
          actions={
            <EntityCreateButton
              entityType="deal"
              newHref="/crm/deals/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar
          searchable={false}
          filters={[
            { key: 'state', label: 'States', options: STATE_OPTIONS },
            { key: 'pipeline', label: 'Pipelines', options: pipelineOptions },
          ]}
          enableViewToggle
        />

        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Briefcase className="h-5 w-5" />}
              title="No deals match"
              description="Deals appear here as opportunities are created. Start one with New, or from a pipeline's Kanban board."
            />
          </Card>
        ) : (
          <DealsList deals={rows} view={view} />
        )}

        <ListPager total={total} />
      </div>
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
