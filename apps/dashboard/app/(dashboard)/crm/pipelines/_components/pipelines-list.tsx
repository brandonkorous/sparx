'use client';

// Pipelines index list — rendered through the shared `SelectionList` dual-view
// substrate (docs/34 §7) so it gains the Table↔Cards toggle and honors the
// user's `defaultListView`. SelectionList takes render functions, which can't
// cross the server→client boundary, so the server page hands serializable rows
// + `view` here. Read-only selection (`selectable=false`): pipelines have no
// bulk actions; each row links through to its Kanban / list / forecast views.
//
// The card view preserves the inline horizontal stage mini-funnel (so the list
// communicates each pipeline's shape without a click-through); the table view
// mirrors the same columns with the funnel as its own cell.

import Link from 'next/link';
import { ArrowRight, Archive, Settings } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

export interface PipelineStageRow {
  id: string;
  name: string;
  stageType: 'open' | 'won' | 'lost';
  probability: string | number;
  color: string | null;
}

export interface PipelineRow {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  archivedAt: string | null;
  stages: PipelineStageRow[];
}

interface PipelinesListProps {
  pipelines: PipelineRow[];
  view: 'table' | 'card';
}

function StageFunnel({ stages }: { stages: PipelineStageRow[] }) {
  return (
    <div className="flex flex-row flex-wrap gap-2">
      {stages.map((stage) => (
        <div
          key={stage.id}
          className="border-base-300 flex flex-row items-center gap-1 rounded-md border px-2 py-1"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor:
                stage.color ??
                (stage.stageType === 'won'
                  ? 'var(--color-success)'
                  : stage.stageType === 'lost'
                    ? 'var(--color-danger)'
                    : 'var(--color-module)'),
            }}
          />
          <p className="text-sm">{stage.name}</p>
          <p className="text-base-content text-xs">{Number(stage.probability)}%</p>
        </div>
      ))}
    </div>
  );
}

export function PipelinesList({ pipelines, view }: PipelinesListProps) {
  const nameCell = (p: PipelineRow, className: string) => (
    <div className="flex flex-row flex-wrap items-center gap-2">
      <Link href={`/crm/pipelines/${p.id}`} className={className}>
        {p.name}
      </Link>
      {p.isDefault && (
        <Badge color="neutral" variant="soft" size="sm">
          Default
        </Badge>
      )}
      {p.archivedAt && (
        <Badge color="warning" className="text-xs">
          <Archive className="h-3 w-3" /> Archived
        </Badge>
      )}
    </div>
  );

  const rowActions = (p: PipelineRow) => (
    <div className="flex flex-row flex-wrap gap-2">
      <Button
        render={<Link href={`/crm/pipelines/${p.id}/edit`} />}
        variant="ghost"
        shape="square"
        size="sm"
        aria-label="Edit pipeline"
      >
        <Settings className="h-4 w-4" />
      </Button>
      <Button render={<Link href={`/crm/pipelines/${p.id}?view=list`} />} variant="ghost" size="sm">
        List
      </Button>
      <Button
        render={<Link href={`/crm/pipelines/${p.id}?view=forecast`} />}
        variant="ghost"
        size="sm"
      >
        Forecast
      </Button>
      <Button
        render={<Link href={`/crm/pipelines/${p.id}`} />}
        color="module"
        size="sm"
        iconEnd={<ArrowRight className="h-4 w-4" />}
      >
        Open Kanban
      </Button>
    </div>
  );

  const columns: SelectionColumn<PipelineRow>[] = [
    {
      header: 'Name',
      cell: (p) => (
        <div className="flex min-w-0 flex-col gap-1">
          {nameCell(p, 'text-sm font-medium hover:text-module hover:underline')}
          <p className="text-base-content text-xs">
            slug <code>{p.slug}</code>
          </p>
        </div>
      ),
    },
    {
      header: 'Stages',
      align: 'right',
      cell: (p) => (
        <p className="text-sm">
          {p.stages.length} stage{p.stages.length === 1 ? '' : 's'}
        </p>
      ),
    },
    { header: 'Funnel', cell: (p) => <StageFunnel stages={p.stages} /> },
    { header: 'Actions', align: 'right', cell: rowActions },
  ];

  const card: SelectionCard<PipelineRow> = {
    title: (p) => nameCell(p, 'hover:text-module hover:underline'),
    render: (p) => (
      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap items-center justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle>{nameCell(p, 'hover:text-module hover:underline')}</CardTitle>
              <p className="text-base-content text-sm">
                {p.stages.length} stage{p.stages.length === 1 ? '' : 's'} — slug{' '}
                <code>{p.slug}</code>
              </p>
            </div>
            {rowActions(p)}
          </div>
          <StageFunnel stages={p.stages} />
        </CardBody>
      </Card>
    ),
  };

  return (
    <SelectionList
      items={pipelines}
      view={view}
      getId={(p) => p.id}
      getRowLabel={(p) => p.name}
      entityLabelPlural="pipelines"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
