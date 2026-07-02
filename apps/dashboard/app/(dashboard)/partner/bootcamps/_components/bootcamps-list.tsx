'use client';

import Link from 'next/link';
import {
  Badge,
  SelectionList,
  Text,
  statusLabel,
  statusTone,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';

import { fmtDateRange } from '../../_lib/format';
import type { Bootcamp } from '../../_lib/types';

// The bootcamps list (docs/114 §B.7). Read-only (`selectable={false}`); the title
// is a plain <Link> into the full-page edit route (NOT EntityRowLink — partner
// isn't a module, so the detail-view registries don't apply). Status through
// statusTone; format + seats give the cohort's shape at a glance.

const FORMAT_LABELS: Record<Bootcamp['format'], string> = {
  virtual: 'Virtual',
  in_person: 'In person',
  hybrid: 'Hybrid',
  async: 'Self-paced',
};

function seatsLabel(b: Bootcamp): string {
  return b.seatsTotal == null ? 'Unlimited' : `${b.seatsFilled} / ${b.seatsTotal}`;
}

function statusBadge(b: Bootcamp) {
  return (
    <Badge color={statusTone(b.status)} variant="soft" size="sm">
      {statusLabel(b.status)}
    </Badge>
  );
}

function titleLink(b: Bootcamp) {
  return (
    <Link
      href={`/partner/bootcamps/${b.id}`}
      className="font-medium hover:text-[var(--module-active)]"
    >
      {b.title}
    </Link>
  );
}

export function BootcampsList({ rows, view }: { rows: Bootcamp[]; view: 'table' | 'card' }) {
  const columns: SelectionColumn<Bootcamp>[] = [
    { header: 'Title', cell: titleLink },
    {
      header: 'Format',
      cell: (b) => (
        <Badge color="info" variant="soft" size="sm">
          {FORMAT_LABELS[b.format]}
        </Badge>
      ),
    },
    { header: 'Dates', cell: (b) => fmtDateRange(b.startsAt, b.endsAt) },
    { header: 'Seats', cell: seatsLabel, align: 'right' },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<Bootcamp> = {
    title: titleLink,
    subtitle: (b) => (
      <Text size="xs" variant="muted">
        {fmtDateRange(b.startsAt, b.endsAt)}
      </Text>
    ),
    badge: statusBadge,
    body: (b) => (
      <div className="flex items-center gap-2">
        <Badge color="info" variant="soft" size="sm">
          {FORMAT_LABELS[b.format]}
        </Badge>
        <Text size="xs" variant="muted">
          {seatsLabel(b)} seats
        </Text>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(b) => b.id}
      selectable={false}
      entityLabelPlural="bootcamps"
      getRowLabel={(b) => b.title}
      columns={columns}
      card={card}
    />
  );
}
