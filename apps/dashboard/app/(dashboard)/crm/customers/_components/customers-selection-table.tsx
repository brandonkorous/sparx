'use client';

import * as React from 'react';
import { Building2, Trash2 } from 'lucide-react';
import {
  Badge,
  BulkActionBar,
  type BulkAction,
  Card,
  CardContent,
  Checkbox,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { bulkDeleteCustomersAction } from '../../customer-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

export interface CustomerListRow {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  doNotContact: boolean;
  orderCount: number;
  totalSpent: string | number;
  lastOrderAt: string | null;
  updatedAt: string;
}

const TYPE_LABELS = {
  prospect: 'Prospect',
  retail: 'Customer',
  b2b: 'B2B contact',
} as const;

interface CustomersSelectionTableProps {
  customers: CustomerListRow[];
  view: 'table' | 'card';
}

export function CustomersSelectionTable({ customers, view }: CustomersSelectionTableProps) {
  const [selected, setSelected] = React.useState<string[]>([]);

  const allIds = customers.map((c) => c.id);
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
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Delete {count} customer{count === 1 ? "" : "s"}? Their activity, notes, and orders are preserved but the contact record will be removed. This cannot be undone.',
      onAction: async (ids) => {
        await bulkDeleteCustomersAction(ids);
        setSelected([]);
      },
    },
  ];

  if (view === 'card') {
    return (
      <>
        <Grid minItemWidth="18rem" gap={4}>
          {customers.map((c) => (
            <Card key={c.id} variant="module" padding="md">
              <Stack gap={3}>
                <Stack direction="row" align="start" justify="between" gap={2}>
                  <Stack direction="row" align="start" gap={2} className="min-w-0">
                    <Checkbox
                      checked={selected.includes(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                      aria-label={`Select ${customerDisplayName(c)}`}
                      className="mt-0.5 shrink-0"
                    />
                    <Stack gap={1} className="min-w-0">
                      <EntityRowLink
                        href={`/crm/customers/${c.id}`}
                        entityType="customer"
                        entityId={c.id}
                        className="truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                      >
                        {customerDisplayName(c)}
                      </EntityRowLink>
                      {c.company ? (
                        <Stack direction="row" align="center" gap={1} className="min-w-0">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                          <Text size="xs" variant="muted" className="truncate">
                            {c.company}
                          </Text>
                        </Stack>
                      ) : (
                        c.email && (
                          <Text size="xs" variant="muted" className="truncate">
                            {c.email}
                          </Text>
                        )
                      )}
                    </Stack>
                  </Stack>
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABELS[c.type as keyof typeof TYPE_LABELS] ?? c.type}
                  </Badge>
                </Stack>
                <Stack direction="row" align="center" justify="between" gap={2}>
                  <Text size="sm" variant="muted">
                    {c.orderCount} order{c.orderCount === 1 ? '' : 's'}
                  </Text>
                  <Text size="sm" className="tabular-nums">
                    ${Number(c.totalSpent).toLocaleString()}
                  </Text>
                </Stack>
                {c.doNotContact && (
                  <Badge color="warning" className="self-start text-xs">
                    DNC
                  </Badge>
                )}
              </Stack>
            </Card>
          ))}
        </Grid>

        <BulkActionBar selected={selected} onClear={() => setSelected([])} actions={bulkActions} />
      </>
    );
  }

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
                    aria-label="Select all customers"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead>Last order</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow
                  key={c.id}
                  data-state={selected.includes(c.id) ? 'selected' : undefined}
                  className="group"
                >
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selected.includes(c.id)}
                      onCheckedChange={() => toggle(c.id)}
                      aria-label={`Select ${customerDisplayName(c)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <EntityRowLink
                      href={`/crm/customers/${c.id}`}
                      entityType="customer"
                      entityId={c.id}
                      className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--module-active)] hover:underline"
                    >
                      {customerDisplayName(c)}
                    </EntityRowLink>
                    {c.doNotContact && (
                      <Badge color="warning" className="ml-2">
                        DNC
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TYPE_LABELS[c.type as keyof typeof TYPE_LABELS] ?? c.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {c.company ? (
                      <Stack direction="row" align="center" gap={1}>
                        <Building2 className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                        <Text size="sm">{c.company}</Text>
                      </Stack>
                    ) : (
                      <Text size="sm" variant="muted">
                        —
                      </Text>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.orderCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    ${Number(c.totalSpent).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </Text>
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

function customerDisplayName(c: {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}): string {
  const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (c.company) return c.company;
  if (c.email) return c.email;
  return 'Unnamed customer';
}
