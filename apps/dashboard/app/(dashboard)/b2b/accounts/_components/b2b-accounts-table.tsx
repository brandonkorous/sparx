'use client';

import Link from 'next/link';
import { Badge, Table } from '@wizeworks/silicaui-react';
import type { B2bAccountRow } from '../page';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  credit_hold: 'warning',
  suspended: 'danger',
  inactive: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  credit_hold: 'Credit hold',
  suspended: 'Suspended',
  inactive: 'Inactive',
};

function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  accounts: B2bAccountRow[];
}

export function B2bAccountsTable({ accounts }: Props) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Company</th>
          <th>Status</th>
          <th>Pricing tier</th>
          <th>Credit limit</th>
          <th>Used</th>
          <th>Remaining</th>
          <th>Terms</th>
          <th>Discount</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((a) => {
          const utilPct = a.creditUtilizationPct;
          const utilizationColor =
            utilPct >= 90 ? 'text-danger' : utilPct >= 75 ? 'text-warning' : '';

          return (
            <tr key={a.id} className="hover:bg-base-200">
              <td>
                <Link
                  href={`/b2b/accounts/${a.id}`}
                  className="hover:text-module font-medium hover:underline"
                >
                  {a.companyName}
                </Link>
              </td>
              <td>
                <Badge color={STATUS_VARIANT[a.status] ?? 'neutral'} variant="soft" size="sm">
                  {STATUS_LABEL[a.status] ?? a.status}
                </Badge>
              </td>
              <td>
                {a.pricingTierName ? (
                  <Badge color="module" variant="soft" size="sm">
                    {a.pricingTierName}
                  </Badge>
                ) : (
                  <p className="text-base-content text-sm">—</p>
                )}
              </td>
              <td>
                <p className="text-sm">{formatDollars(a.creditLimitCents)}</p>
              </td>
              <td>
                <p className={`text-sm ${utilizationColor}`}>{formatDollars(a.creditUsedCents)}</p>
              </td>
              <td>
                <p className="text-sm">{formatDollars(a.creditRemainingCents)}</p>
              </td>
              <td>
                <p className="text-sm">{a.paymentTerms ?? '—'}</p>
              </td>
              <td>
                <p className="text-sm">{a.discountPercent > 0 ? `${a.discountPercent}%` : '—'}</p>
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
