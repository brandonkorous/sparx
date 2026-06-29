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
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
} from '@sparx/ui';

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
    <Stack direction="row" gap={2} wrap>
      {stages.map((stage) => (
        <Stack
          key={stage.id}
          direction="row"
          align="center"
          gap={1}
          className="rounded-md border border-[var(--color-border-default)] px-2 py-1"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor:
                stage.color ??
                (stage.stageType === 'won'
                  ? 'var(--color-success-500)'
                  : stage.stageType === 'lost'
                    ? 'var(--color-danger-500)'
                    : 'var(--module-active)'),
            }}
          />
          <Text size="sm">{stage.name}</Text>
          <Text size="xs" variant="muted">
            {Number(stage.probability)}%
          </Text>
        </Stack>
      ))}
    </Stack>
  );
}

export function PipelinesList({ pipelines, view }: PipelinesListProps) {
  const nameCell = (p: PipelineRow, className: string) => (
    <Stack direction="row" align="center" gap={2} wrap>
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
    </Stack>
  );

  const rowActions = (p: PipelineRow) => (
    <Stack direction="row" gap={2} wrap>
      <Button asChild variant="ghost" shape="square" size="sm" aria-label="Edit pipeline">
        <Link href={`/crm/pipelines/${p.id}/edit`}>
          <Settings className="h-4 w-4" />
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/crm/pipelines/${p.id}?view=list`}>List</Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/crm/pipelines/${p.id}?view=forecast`}>Forecast</Link>
      </Button>
      <Button asChild color="module" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>
        <Link href={`/crm/pipelines/${p.id}`}>Open Kanban</Link>
      </Button>
    </Stack>
  );

  const columns: SelectionColumn<PipelineRow>[] = [
    {
      header: 'Name',
      cell: (p) => (
        <Stack gap={1} className="min-w-0">
          {nameCell(p, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline')}
          <Text size="xs" variant="muted">
            slug <code>{p.slug}</code>
          </Text>
        </Stack>
      ),
    },
    {
      header: 'Stages',
      align: 'right',
      cell: (p) => (
        <Text size="sm">
          {p.stages.length} stage{p.stages.length === 1 ? '' : 's'}
        </Text>
      ),
    },
    { header: 'Funnel', cell: (p) => <StageFunnel stages={p.stages} /> },
    { header: 'Actions', align: 'right', cell: rowActions },
  ];

  const card: SelectionCard<PipelineRow> = {
    title: (p) => nameCell(p, 'hover:text-[var(--module-active)] hover:underline'),
    render: (p) => (
      <Card variant="default">
        <CardHeader>
          <Stack direction="row" align="center" justify="between" wrap>
            <Stack gap={1}>
              <CardTitle>
                {nameCell(p, 'hover:text-[var(--module-active)] hover:underline')}
              </CardTitle>
              <Text size="sm" variant="muted">
                {p.stages.length} stage{p.stages.length === 1 ? '' : 's'} — slug{' '}
                <code>{p.slug}</code>
              </Text>
            </Stack>
            {rowActions(p)}
          </Stack>
        </CardHeader>
        <CardContent>
          <StageFunnel stages={p.stages} />
        </CardContent>
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
