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
import {
  Badge,
  Button,
  Card,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
} from '@sparx/ui';

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
        <Stack gap={1} className="min-w-0">
          <Stack direction="row" align="center" gap={2} wrap>
            {nameLink(s, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline')}
            {badges(s)}
          </Stack>
          <Text size="xs" variant="muted">
            slug <code>{s.slug}</code>
          </Text>
        </Stack>
      ),
    },
    {
      header: 'Description',
      cell: (s) =>
        s.description ? (
          <Text size="sm" variant="muted" className="line-clamp-2">
            {s.description}
          </Text>
        ) : (
          <Text size="sm" variant="muted">
            —
          </Text>
        ),
    },
    {
      header: 'Members',
      align: 'right',
      cell: (s) => <Text size="sm">{s.memberCount.toLocaleString()}</Text>,
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (s) => (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/crm/segments/${s.id}`}>Open</Link>
        </Button>
      ),
    },
  ];

  const card: SelectionCard<SegmentListRow> = {
    title: (s) =>
      nameLink(s, 'text-base font-medium hover:text-[var(--module-active)] hover:underline'),
    render: (s) => (
      <Card variant="default" padding="md">
        <Stack direction="row" align="center" justify="between" wrap gap={3}>
          <Stack gap={1} className="min-w-0 flex-1">
            <Stack direction="row" align="center" gap={2} wrap>
              {nameLink(
                s,
                'text-base font-medium hover:text-[var(--module-active)] hover:underline'
              )}
              {badges(s)}
            </Stack>
            {s.description && (
              <Text size="sm" variant="muted" className="truncate">
                {s.description}
              </Text>
            )}
            <Text size="xs" variant="muted">
              slug <code>{s.slug}</code>
            </Text>
          </Stack>
          <Stack direction="row" align="center" gap={3}>
            <Stack gap={0}>
              <Text size="xs" variant="muted">
                Members
              </Text>
              <Text size="lg" weight="medium" className="tabular-nums">
                {s.memberCount.toLocaleString()}
              </Text>
            </Stack>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/crm/segments/${s.id}`}>Open</Link>
            </Button>
          </Stack>
        </Stack>
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
