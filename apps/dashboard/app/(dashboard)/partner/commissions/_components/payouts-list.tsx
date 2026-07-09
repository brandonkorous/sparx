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
import { fmtDate, fmtDateRange } from '../../_lib/format';
import type { PartnerPayoutRun } from '../../_lib/types';

// The payout-run history (docs/114 §B.4) — one Stripe Connect transfer per run.
// Read-only; amounts right-aligned + tabular, status through statusTone ("paid"
// green, "processing"/"pending" in-motion, "failed" red).

function statusBadge(p: PartnerPayoutRun) {
  return (
    <Badge color={statusTone(p.status)} variant="soft" size="sm">
      {statusLabel(p.status)}
    </Badge>
  );
}

export function PayoutsList({ rows, view }: { rows: PartnerPayoutRun[]; view: 'table' | 'card' }) {
  const columns: SelectionColumn<PartnerPayoutRun>[] = [
    { header: 'Period', cell: (p) => fmtDateRange(p.periodStart, p.periodEnd) },
    {
      header: 'Amount',
      cell: (p) => <span className="font-medium">{fmtMoneyCents(p.amountCents, p.currency)}</span>,
      align: 'right',
    },
    {
      header: 'Commissions',
      cell: (p) => p.commissionCount,
      align: 'right',
    },
    { header: 'Paid', cell: (p) => fmtDate(p.paidAt) ?? '—' },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<PartnerPayoutRun> = {
    title: (p) => (
      <p className="text-sm font-medium tabular-nums">{fmtMoneyCents(p.amountCents, p.currency)}</p>
    ),
    subtitle: (p) => (
      <p className="text-base-content/70 text-xs">
        {fmtDateRange(p.periodStart, p.periodEnd)} · {p.commissionCount} commission
        {p.commissionCount === 1 ? '' : 's'}
      </p>
    ),
    badge: statusBadge,
    body: (p) =>
      p.status === 'failed' && p.failureReason ? (
        <p className="text-danger text-xs">{p.failureReason}</p>
      ) : null,
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(p) => p.id}
      selectable={false}
      entityLabelPlural="payouts"
      getRowLabel={(p) => fmtDateRange(p.periodStart, p.periodEnd)}
      columns={columns}
      card={card}
    />
  );
}
