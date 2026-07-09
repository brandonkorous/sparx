'use client';

import { Badge } from '@wizeworks/silicaui-react';
import {
  SelectionList,
  statusLabel,
  statusTone,
  type SelectionCard,
  type SelectionColumn,
} from '@sparx/ui';

import { fmtDate, fmtRate, shortTenantRef } from '../../_lib/format';
import type { PartnerReferral } from '../../_lib/types';

// The referral ledger list (docs/114 §B.7). Read-only (`selectable={false}`), no
// EntityRowLink (partner isn't a module) — a referred account isn't a navigable
// module entity, so its label is plain text. The account now shows the referred
// org's real name (resolved server-side), falling back to a short id only when it
// can't be resolved. Status resolves through the shared statusTone so
// "active"/"pending"/"churned"/"forfeited" read at a glance.

function accountLabel(r: PartnerReferral): string {
  return r.referredOrgName ?? shortTenantRef(r.referredTenantId);
}

function statusBadge(r: PartnerReferral) {
  return (
    <Badge color={statusTone(r.status)} variant="soft" size="sm">
      {statusLabel(r.status)}
    </Badge>
  );
}

function rate(r: PartnerReferral) {
  return (
    <span className="tabular-nums">
      {fmtRate(r.commissionRate)}
      {r.commissionType === 'ongoing' ? ' ongoing' : ''}
    </span>
  );
}

export function ReferralsList({ rows, view }: { rows: PartnerReferral[]; view: 'table' | 'card' }) {
  const columns: SelectionColumn<PartnerReferral>[] = [
    {
      header: 'Account',
      cell: (r) => <span className="font-medium">{accountLabel(r)}</span>,
    },
    { header: 'Signed up', cell: (r) => fmtDate(r.signupAt) ?? '—' },
    {
      header: 'First payment',
      cell: (r) =>
        r.firstPaymentAt ? (
          fmtDate(r.firstPaymentAt)
        ) : (
          <p className="text-base-content/70 text-sm">Not yet</p>
        ),
    },
    { header: 'Rate', cell: rate, align: 'right' },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<PartnerReferral> = {
    title: (r) => <p className="text-sm font-medium">{accountLabel(r)}</p>,
    subtitle: (r) => (
      <p className="text-base-content/70 text-xs">Signed up {fmtDate(r.signupAt) ?? '—'}</p>
    ),
    badge: statusBadge,
    body: (r) => (
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-base-content/70 text-xs">
          {r.firstPaymentAt
            ? `First payment ${fmtDate(r.firstPaymentAt)}`
            : 'Awaiting first payment'}
        </p>
        {rate(r)}
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(r) => r.id}
      selectable={false}
      entityLabelPlural="referrals"
      getRowLabel={(r) => accountLabel(r)}
      columns={columns}
      card={card}
    />
  );
}
