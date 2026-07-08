import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KanbanSquare, List, BarChart3, Plus } from 'lucide-react';

import { Badge, Button, Tabs, TabsList, TabsTab } from 'silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { PipelineKanban } from './_components/pipeline-kanban';
import { PipelineList } from './_components/pipeline-list';
import { PipelineForecast } from './_components/pipeline-forecast';

interface PipelineStage {
  id: string;
  name: string;
  color: string | null;
  stageType: 'open' | 'won' | 'lost';
  probability: string | number;
}

interface Pipeline {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  stages: PipelineStage[];
}

interface PipelineDeal {
  id: string;
  title: string;
  stageId: string;
  value: string | number;
  currency: string;
  probability: string | number;
  assignedRepId: string | null;
  expectedCloseDate: string | null;
  tags: string[];
}

// Pipeline detail — Kanban (default), list, or forecast. The view switch
// lives in the URL (?view=) so back-button + bookmarks behave.

export const dynamic = 'force-dynamic';

type View = 'kanban' | 'list' | 'forecast';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PipelineDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const view: View = sp.view === 'list' ? 'list' : sp.view === 'forecast' ? 'forecast' : 'kanban';

  let pipeline: Pipeline;
  try {
    pipeline = await api.get<Pipeline>(`/v1/crm/pipelines/${id}`);
  } catch (err) {
    const apiError = err as ApiRestError;
    if (apiError.code === 'NOT_FOUND') notFound();
    if (apiError.code === 'UPSTREAM_FETCH_FAILED') {
      console.error('CRM pipeline fetch failed', {
        pipelineId: id,
        details: apiError.details,
        requestId: apiError.requestId,
      });
      return (
        <div className="mx-auto w-full max-w-none px-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 py-8">
            <PageHeader
              title="Pipeline temporarily unavailable"
              description="We couldn't load this pipeline right now. Please refresh or try again in a moment."
              actions={
                <Button render={<Link href="/crm/pipelines" />} variant="outline">
                  Back to pipelines
                </Button>
              }
            />
          </div>
        </div>
      );
    }
    throw err;
  }

  const { data: deals } = await api
    .getPaged<PipelineDeal[]>(`/v1/crm/deals?pipeline_id=${pipeline.id}&take=250`)
    .catch(() => ({ data: [] as PipelineDeal[], meta: {}, etag: null }));
  const dealCounts = pipeline.stages.map((stage) => ({
    stageId: stage.id,
    count: deals.filter((d) => d.stageId === stage.id).length,
  }));

  return (
    <div className="mx-auto w-full max-w-none px-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          title={pipeline.name}
          badge={
            <>
              {pipeline.isDefault && (
                <Badge color="neutral" variant="soft" size="sm">
                  Default
                </Badge>
              )}
              <Badge color="module">
                {deals.length} open deal{deals.length === 1 ? '' : 's'}
              </Badge>
            </>
          }
          description={
            <>
              {pipeline.stages.length} stage{pipeline.stages.length === 1 ? '' : 's'} ·{' '}
              <code>{pipeline.slug}</code>
            </>
          }
          actions={
            <>
              <Tabs value={view}>
                <TabsList>
                  <TabsTab value="kanban" render={<Link href={`/crm/pipelines/${pipeline.id}`} />}>
                    <KanbanSquare className="h-3.5 w-3.5" /> Kanban
                  </TabsTab>
                  <TabsTab
                    value="list"
                    render={<Link href={`/crm/pipelines/${pipeline.id}?view=list`} />}
                  >
                    <List className="h-3.5 w-3.5" /> List
                  </TabsTab>
                  <TabsTab
                    value="forecast"
                    render={<Link href={`/crm/pipelines/${pipeline.id}?view=forecast`} />}
                  >
                    <BarChart3 className="h-3.5 w-3.5" /> Forecast
                  </TabsTab>
                </TabsList>
              </Tabs>
              <Button
                render={<Link href={`/crm/deals/new?pipelineId=${pipeline.id}`} />}
                color="module"
                iconStart={<Plus className="h-4 w-4" />}
              >
                New deal
              </Button>
            </>
          }
        />

        {view === 'kanban' && (
          <PipelineKanban
            pipelineId={pipeline.id}
            stages={pipeline.stages.map((s) => ({
              id: s.id,
              name: s.name,
              color: s.color,
              stageType: s.stageType,
              probability: Number(s.probability),
              count: dealCounts.find((c) => c.stageId === s.id)?.count ?? 0,
            }))}
            deals={deals.map((d) => ({
              id: d.id,
              title: d.title,
              stageId: d.stageId,
              value: Number(d.value),
              currency: d.currency,
              probability: Number(d.probability),
              assignedRepId: d.assignedRepId,
              expectedCloseDate: d.expectedCloseDate,
              tags: d.tags,
            }))}
          />
        )}
        {view === 'list' && <PipelineList pipelineId={pipeline.id} />}
        {view === 'forecast' && <PipelineForecast pipelineId={pipeline.id} />}
      </div>
    </div>
  );
}
