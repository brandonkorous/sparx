'use client';

// B2B Accounts list with row selection + fleet-level bulk action bar
// (docs/68 B-3): Set status (Active / Inactive) and Delete. Mirrors the
// customers selection table; assign-rep is deferred (needs a rep picker).

import * as React from 'react';
import Link from 'next/link';
import { CircleCheck, CircleSlash, Trash2 } from 'lucide-react';
import {
  Badge,
  BulkActionBar,
  type BulkAction,
  Card,
  CardContent,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import type { B2bAccountRow } from '../page';
import {
  bulkDeleteB2bAccountsAction,
  bulkSetB2bAccountStatusAction,
} from './b2b-accounts-bulk-actions';

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

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function B2bAccountsSelectionTable({
  accounts,
}: {
  accounts: B2bAccountRow[];
}): React.JSX.Element {
  const [selected, setSelected] = React.useState<string[]>([]);

  const allIds = accounts.map((a) => a.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const someSelected = selected.length > 0 && !allSelected;

  function toggleAll(): void {
    setSelected(allSelected ? [] : allIds);
  }
  function toggle(id: string): void {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'Set active',
      icon: CircleCheck,
      onAction: async (ids) => {
        await bulkSetB2bAccountStatusAction(ids, 'active');
        setSelected([]);
      },
    },
    {
      label: 'Set inactive',
      icon: CircleSlash,
      onAction: async (ids) => {
        await bulkSetB2bAccountStatusAction(ids, 'inactive');
        setSelected([]);
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} B2B account{count === 1 ? "" : "s"}? Their contacts, quotes, and history are preserved but the account record will be removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteB2bAccountsAction(ids);
        setSelected([]);
      },
    },
  ];

  return (
    <>
      <Card padding="none">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={someSelected ? 'indeterminate' : allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all accounts"
                  />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pricing tier</TableHead>
                <TableHead>Credit limit</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>Discount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id} data-state={selected.includes(a.id) ? 'selected' : undefined}>
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selected.includes(a.id)}
                      onCheckedChange={() => toggle(a.id)}
                      aria-label={`Select ${a.companyName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/b2b/accounts/${a.id}`}
                      className="font-medium hover:text-[var(--module-active)] hover:underline"
                    >
                      {a.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge color={STATUS_VARIANT[a.status] ?? 'outline'} variant="soft">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.pricingTierName ? (
                      <Badge color="module" variant="outline">
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
                    <Text size="sm">{formatDollars(a.creditRemainingCents)}</Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm">{a.paymentTerms ?? '—'}</Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm">{a.discountPercent > 0 ? `${a.discountPercent}%` : '—'}</Text>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BulkActionBar selected={selected} onClear={() => setSelected([])} actions={bulkActions} />
    </>
  );
}
