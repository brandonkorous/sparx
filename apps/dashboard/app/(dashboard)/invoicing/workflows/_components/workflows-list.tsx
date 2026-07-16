'use client';

// Workflows index list — rendered through the shared `SelectionList` dual-view
// substrate (docs/34 §7), mirroring `crm/pipelines/_components/pipelines-list.tsx`
// (a document workflow is the invoicing analogue of a sales pipeline: a name +
// an ordered stage list). Read-only selection: workflows have no bulk actions,
// each row links through to its edit page. The card view preserves the inline
// stage-chip funnel so the list communicates each workflow's shape without a
// click-through; the table view mirrors it as its own column.

import Link from 'next/link';
import { Archive } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardTitle } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

export interface WorkflowStageRow {
  id: string;
  customerLabel: string;
  stageType: string;
  sortOrder: number;
}

export interface WorkflowRow {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  archivedAt: string | null;
  stages: WorkflowStageRow[];
}

interface WorkflowsListProps {
  workflows: WorkflowRow[];
  view: 'table' | 'card';
}

function StageFunnel({ stages }: { stages: WorkflowStageRow[] }) {
  if (stages.length === 0) return <p className="text-base-content text-xs">No stages yet</p>;
  return (
    <div className="flex flex-row flex-wrap items-center gap-2">
      {stages
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s, i, arr) => (
          <div key={s.id} className="flex flex-row items-center gap-2">
            <Badge color="neutral" variant="soft" size="sm">
              {s.customerLabel}
            </Badge>
            {i < arr.length - 1 && <span className="text-base-content">→</span>}
          </div>
        ))}
    </div>
  );
}

export function WorkflowsList({ workflows, view }: WorkflowsListProps) {
  const nameCell = (w: WorkflowRow, className: string) => (
    <div className="flex flex-row flex-wrap items-center gap-2">
      <Link href={`/invoicing/workflows/${w.id}/edit`} className={className}>
        {w.name}
      </Link>
      {w.isDefault && (
        <Badge color="neutral" variant="soft" size="sm">
          Default
        </Badge>
      )}
      {w.archivedAt && (
        <Badge color="warning" className="text-xs">
          <Archive className="h-3 w-3" /> Archived
        </Badge>
      )}
    </div>
  );

  const editButton = (w: WorkflowRow) => (
    <Button
      render={<Link href={`/invoicing/workflows/${w.id}/edit`} />}
      variant="outline"
      size="sm"
      color="module"
    >
      Edit
    </Button>
  );

  const columns: SelectionColumn<WorkflowRow>[] = [
    {
      header: 'Name',
      cell: (w) => (
        <div className="flex min-w-0 flex-col gap-1">
          {nameCell(w, 'text-sm font-medium hover:text-module hover:underline')}
          <p className="text-base-content text-xs">
            slug <code>{w.slug}</code>
          </p>
        </div>
      ),
    },
    { header: 'Stages', cell: (w) => <StageFunnel stages={w.stages} /> },
    { header: '', align: 'right', cell: editButton },
  ];

  const card: SelectionCard<WorkflowRow> = {
    title: (w) => nameCell(w, 'hover:text-module hover:underline'),
    render: (w) => (
      <Card key={w.id}>
        <CardBody>
          <div className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{nameCell(w, 'hover:text-module hover:underline')}</CardTitle>
              <p className="text-base-content text-xs">
                slug <code>{w.slug}</code>
              </p>
            </div>
            {editButton(w)}
          </div>
          <StageFunnel stages={w.stages} />
        </CardBody>
      </Card>
    ),
  };

  return (
    <SelectionList
      items={workflows}
      view={view}
      getId={(w) => w.id}
      getRowLabel={(w) => w.name}
      entityLabelPlural="workflows"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
