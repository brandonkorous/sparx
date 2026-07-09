'use client';

// Segments index list — rendered through the shared `SelectionList` dual-view
// substrate (docs/34 §7) so it gains the Table↔Cards toggle and honors the
// user's `defaultListView`. SelectionList takes render functions, which can't
// cross the server→client boundary, so the server page hands serializable rows
// (with their resolved member count merged in) + `view` here. Read-only
// selection (`selectable=false`): segments have no bulk actions; each row links
// through to its detail page via `EntityRowLink` (which honors the user's
// detail-view preference). The create form, recompute button, and rule-builder
// live on their own surfaces and are untouched.

import Link from 'next/link';
import { Star, Archive } from 'lucide-react';
import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

export interface SegmentListRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isBuiltIn: boolean;
  archivedAt: string | null;
  memberCount: number;
}

interface SegmentsListProps {
  segments: SegmentListRow[];
  view: 'table' | 'card';
}

export function SegmentsList({ segments, view }: SegmentsListProps) {
  const nameLink = (s: SegmentListRow, className: string) => (
    <EntityRowLink
      href={`/crm/segments/${s.id}`}
      entityType="segment"
      entityId={s.id}
      className={className}
    >
      {s.name}
    </EntityRowLink>
  );

  const badges = (s: SegmentListRow) => (
    <>
      {s.isBuiltIn && (
        <Badge color="neutral" variant="soft" size="sm">
          <Star className="h-3 w-3" /> Built-in
        </Badge>
      )}
      {s.archivedAt && (
        <Badge color="warning" className="text-xs">
          <Archive className="h-3 w-3" /> Archived
        </Badge>
      )}
    </>
  );

  const columns: SelectionColumn<SegmentListRow>[] = [
    {
      header: 'Name',
      cell: (s) => (
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-2">
            {nameLink(s, 'text-sm font-medium hover:text-module hover:underline')}
            {badges(s)}
          </div>
          <p className="text-base-content/70 text-xs">
            slug <code>{s.slug}</code>
          </p>
        </div>
      ),
    },
    {
      header: 'Description',
      cell: (s) =>
        s.description ? (
          <p className="text-base-content/70 line-clamp-2 text-sm">{s.description}</p>
        ) : (
          <p className="text-base-content/70 text-sm">—</p>
        ),
    },
    {
      header: 'Members',
      align: 'right',
      cell: (s) => <p className="text-sm">{s.memberCount.toLocaleString()}</p>,
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (s) => (
        <Button render={<Link href={`/crm/segments/${s.id}`} />} variant="ghost" size="sm">
          Open
        </Button>
      ),
    },
  ];

  const card: SelectionCard<SegmentListRow> = {
    title: (s) => nameLink(s, 'text-base font-medium hover:text-module hover:underline'),
    render: (s) => (
      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-row flex-wrap items-center gap-2">
                {nameLink(s, 'text-base font-medium hover:text-module hover:underline')}
                {badges(s)}
              </div>
              {s.description && (
                <p className="text-base-content/70 truncate text-sm">{s.description}</p>
              )}
              <p className="text-base-content/70 text-xs">
                slug <code>{s.slug}</code>
              </p>
            </div>
            <div className="flex flex-row items-center gap-3">
              <div className="flex flex-col gap-0">
                <p className="text-base-content/70 text-xs">Members</p>
                <p className="text-lg font-medium tabular-nums">{s.memberCount.toLocaleString()}</p>
              </div>
              <Button render={<Link href={`/crm/segments/${s.id}`} />} variant="ghost" size="sm">
                Open
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    ),
  };

  return (
    <SelectionList
      items={segments}
      view={view}
      getId={(s) => s.id}
      getRowLabel={(s) => s.name}
      entityLabelPlural="segments"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
