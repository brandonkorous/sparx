'use client';

import {
  Badge,
  SelectionList,
  Stack,
  Text,
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
          <Text size="sm" variant="muted">
            Not yet
          </Text>
        ),
    },
    { header: 'Rate', cell: rate, align: 'right' },
    { header: 'Status', cell: statusBadge },
  ];

  const card: SelectionCard<PartnerReferral> = {
    title: (r) => (
      <Text size="sm" className="font-medium">
        {accountLabel(r)}
      </Text>
    ),
    subtitle: (r) => (
      <Text size="xs" variant="muted">
        Signed up {fmtDate(r.signupAt) ?? '—'}
      </Text>
    ),
    badge: statusBadge,
    body: (r) => (
      <Stack direction="row" align="center" justify="between" gap={2}>
        <Text size="xs" variant="muted">
          {r.firstPaymentAt
            ? `First payment ${fmtDate(r.firstPaymentAt)}`
            : 'Awaiting first payment'}
        </Text>
        {rate(r)}
      </Stack>
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
