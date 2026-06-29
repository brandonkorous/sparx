'use client';

import Link from 'next/link';
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
import type { B2bAccountRow } from '../page';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'outline'> = {
  active: 'success',
  credit_hold: 'warning',
  suspended: 'danger',
  inactive: 'outline',
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
      <TableHeader>
        <TableRow>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Pricing tier</TableHead>
          <TableHead>Credit limit</TableHead>
          <TableHead>Used</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>Terms</TableHead>
          <TableHead>Discount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((a) => {
          const utilPct = a.creditUtilizationPct;
          const utilizationColor =
            utilPct >= 90
              ? 'text-[var(--color-danger-600)]'
              : utilPct >= 75
                ? 'text-[var(--color-warning-600)]'
                : '';

          return (
            <TableRow key={a.id} className="hover:bg-[var(--color-surface-subtle)]">
              <TableCell>
                <Link
                  href={`/b2b/accounts/${a.id}`}
                  className="font-medium hover:text-[var(--module-active)] hover:underline"
                >
                  {a.companyName}
                </Link>
              </TableCell>
              <TableCell>
                <Badge color={STATUS_VARIANT[a.status] ?? 'neutral'} variant="soft" size="sm">
                  {STATUS_LABEL[a.status] ?? a.status}
                </Badge>
              </TableCell>
              <TableCell>
                {a.pricingTierName ? (
                  <Badge color="module" variant="soft" size="sm">
                    {a.pricingTierName}
                  </Badge>
                ) : (
                  <Text size="sm" variant="muted">
                    —
                  </Text>
                )}
              </TableCell>
              <TableCell>
                <Text size="sm">{formatDollars(a.creditLimitCents)}</Text>
              </TableCell>
              <TableCell>
                <Text size="sm" className={utilizationColor}>
                  {formatDollars(a.creditUsedCents)}
                </Text>
              </TableCell>
              <TableCell>
                <Text size="sm">{formatDollars(a.creditRemainingCents)}</Text>
              </TableCell>
              <TableCell>
                <Text size="sm">{a.paymentTerms ?? '—'}</Text>
              </TableCell>
              <TableCell>
                <Text size="sm">{a.discountPercent > 0 ? `${a.discountPercent}%` : '—'}</Text>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
