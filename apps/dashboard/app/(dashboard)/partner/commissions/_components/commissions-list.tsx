'use client';

import { Badge } from '@wizeworks/silicaui-react';
import {
  SelectionList,
  statusLabel,
  statusTone,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';

import { fmtMoneyCents } from '../../../_components/overview-bits';
import { fmtDate } from '../../_lib/format';
import type { PartnerCommission } from '../../_lib/types';

// The commission ledger (docs/114 §B.7). Read-only; each row is a money accrual,
// so amounts are right-aligned + tabular and status resolves through statusTone
// ("paid" green, "pending"/"approved" amber, "forfeited" red).

function statusBadge(c: PartnerCommission) {
  return (
    <Badge color={statusTone(c.status)} variant="soft" size="sm">
      {statusLabel(c.status)}
    </Badge>
  );
}

function kindBadge(c: PartnerCommission) {
  return (
    <Badge color="neutral" variant="soft" size="sm">
      {c.kind === 'ongoing' ? 'Ongoing' : 'First payment'}
    </Badge>
  );
}

export function CommissionsList({
  rows,
  view,
}: {
  rows: PartnerCommission[];
  view: 'table' | 'card';
}) {
  const columns: SelectionColumn<PartnerCommission>[] = [
    {
      header: 'Amount',
      cell: (c) => <span className="font-medium">{fmtMoneyCents(c.amountCents, c.currency)}</span>,
      align: 'right',
    },
    { header: 'Type', cell: kindBadge },
    { header: 'Period', cell: (c) => c.period ?? '—' },
    { header: 'Accrued', cell: (c) => fmtDate(c.createdAt) ?? '—' },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<PartnerCommission> = {
    title: (c) => (
      <p className="text-sm font-medium tabular-nums">{fmtMoneyCents(c.amountCents, c.currency)}</p>
    ),
    subtitle: (c) => (
      <p className="text-base-content text-xs">
        {c.kind === 'ongoing' ? 'Ongoing' : 'First payment'}
        {c.period ? ` · ${c.period}` : ''} · {fmtDate(c.createdAt) ?? '—'}
      </p>
    ),
    badge: statusBadge,
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(c) => c.id}
      selectable={false}
      entityLabelPlural="commissions"
      getRowLabel={(c) => fmtMoneyCents(c.amountCents, c.currency)}
      columns={columns}
      card={card}
    />
  );
}
