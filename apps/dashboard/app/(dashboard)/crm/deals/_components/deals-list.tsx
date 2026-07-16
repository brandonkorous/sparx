'use client';

import { Badge } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionColumn, type SelectionCard } from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';
import { stageColor } from '../../pipelines/[id]/_components/kanban-types';

// Client wrapper for the cross-pipeline deals list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands serializable rows + view here and this builds the
// views. Read-only — `selectable={false}` (no checkboxes / bulk bar); rows open
// the deal detail in the user's detail-view surface (drawer/modal/page).
//
// The deals endpoint returns raw `pipelineId` / `stageId`; the page resolves
// the human names + stage color against the pipelines and folds them onto each
// row as `pipelineName` / `stage` so this component stays a pure renderer.

export interface DealStageMeta {
  name: string;
  color: string | null;
  stageType: 'open' | 'won' | 'lost';
}

export interface DealRow {
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
  pipelineName: string;
  stage: DealStageMeta | null;
}

interface DealsListProps {
  deals: DealRow[];
  view: 'table' | 'card';
}

export function DealsList({ deals, view }: DealsListProps) {
  const dealLink = (d: DealRow, className: string) => (
    <EntityRowLink
      href={`/crm/deals/${d.id}`}
      entityType="deal"
      entityId={d.id}
      className={className}
    >
      {d.title}
    </EntityRowLink>
  );

  const stageBadge = (d: DealRow) =>
    d.stage ? (
      <Badge
        variant="outline"
        className="text-xs"
        style={{ borderColor: stageColor(d.stage), color: stageColor(d.stage) }}
      >
        {d.stage.name}
      </Badge>
    ) : (
      <p className="text-base-content text-sm">—</p>
    );

  const valueText = (d: DealRow) => `${d.currency} ${Number(d.value).toLocaleString()}`;
  const closeText = (d: DealRow) =>
    d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString() : '—';

  const columns: SelectionColumn<DealRow>[] = [
    {
      header: 'Deal',
      cell: (d) => dealLink(d, 'text-sm font-medium hover:text-module hover:underline'),
    },
    {
      header: 'Pipeline',
      cell: (d) => <p className="text-base-content text-sm">{d.pipelineName}</p>,
    },
    { header: 'Stage', cell: stageBadge },
    { header: 'Value', align: 'right', cell: valueText },
    { header: 'Probability', align: 'right', cell: (d) => `${Number(d.probability)}%` },
    {
      header: 'Expected close',
      cell: (d) => <p className="text-base-content text-sm">{closeText(d)}</p>,
    },
    {
      header: 'Updated',
      cell: (d) => (
        <p className="text-base-content text-sm">{new Date(d.updatedAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<DealRow> = {
    title: (d) => dealLink(d, 'truncate text-sm font-medium hover:text-module hover:underline'),
    subtitle: (d) => <p className="text-base-content text-xs">{d.pipelineName}</p>,
    badge: stageBadge,
    body: (d) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-sm">
            {Number(d.probability)}% · close {closeText(d)}
          </p>
          <p className="text-sm tabular-nums">{valueText(d)}</p>
        </div>
      </div>
    ),
  };

  return (
    <SelectionList
      items={deals}
      view={view}
      getId={(d) => d.id}
      getRowLabel={(d) => d.title}
      entityLabelPlural="deals"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
