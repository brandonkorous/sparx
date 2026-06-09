'use client';

import * as React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import {
  Badge,
  BulkActionBar,
  type BulkAction,
  Card,
  CardContent,
  Checkbox,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { bulkDeleteB2bAccountsAction, bulkSetB2bStatusAction } from '../../b2b-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

export interface B2bAccountRow {
  id: string;
  companyName: string;
  status: string;
  pricingTier: string | null;
  creditLimit: string | number;
  creditUsed: string | number;
  fleetSize: number | null;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'danger'> = {
  active: 'success',
  credit_hold: 'warning',
  suspended: 'danger',
  inactive: 'outline',
};

interface B2bAccountsSelectionTableProps {
  accounts: B2bAccountRow[];
}

export function B2bAccountsSelectionTable({ accounts }: B2bAccountsSelectionTableProps) {
  const [selected, setSelected] = React.useState<string[]>([]);

  const allIds = accounts.map((a) => a.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const someSelected = selected.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? [] : allIds);
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'Set active',
      onAction: async (ids) => {
        await bulkSetB2bStatusAction(ids, 'active');
        setSelected([]);
      },
    },
    {
      label: 'Set credit hold',
      onAction: async (ids) => {
        await bulkSetB2bStatusAction(ids, 'credit_hold');
        setSelected([]);
      },
    },
    {
      label: 'Suspend',
      onAction: async (ids) => {
        await bulkSetB2bStatusAction(ids, 'suspended');
        setSelected([]);
      },
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} B2B account{count === 1 ? "" : "s"}? Credit history and contacts are also removed. This cannot be undone.',
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
                    aria-label="Select all B2B accounts"
                  />
                </TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pricing tier</TableHead>
                <TableHead className="text-right">Credit limit</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead>Fleet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => {
                const limit = Number(a.creditLimit);
                const used = Number(a.creditUsed);
                const utilization = limit > 0 ? used / limit : 0;
                return (
                  <TableRow
                    key={a.id}
                    data-state={selected.includes(a.id) ? 'selected' : undefined}
                    className="group"
                  >
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selected.includes(a.id)}
                        onCheckedChange={() => toggle(a.id)}
                        aria-label={`Select ${a.companyName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <EntityRowLink
                        href={`/crm/b2b/${a.id}`}
                        entityType="b2b-account"
                        entityId={a.id}
                        className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {a.companyName}
                      </EntityRowLink>
                    </TableCell>
                    <TableCell>
                      <Badge color={STATUS_VARIANT[a.status] ?? 'outline'} className="text-xs">
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {a.pricingTier ?? '—'}
                      </Text>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${limit.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Stack direction="row" gap={1} align="center" justify="end">
                        <span>${used.toLocaleString()}</span>
                        {utilization >= 0.85 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning-500)]" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {a.fleetSize ?? '—'}
                      </Text>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BulkActionBar selected={selected} onClear={() => setSelected([])} actions={bulkActions} />
    </>
  );
}
