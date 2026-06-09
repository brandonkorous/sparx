'use client';

import * as React from 'react';
import { XCircle } from 'lucide-react';
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

import { bulkCancelOrdersAction } from '../../order-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: string | number;
  amountPaid: string | number;
  placedAt: string | null;
  channel: string | null;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'danger'> = {
  placed: 'outline',
  fulfilled: 'success',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'warning',
};

interface OrdersSelectionTableProps {
  orders: OrderRow[];
}

export function OrdersSelectionTable({ orders }: OrdersSelectionTableProps) {
  const [selected, setSelected] = React.useState<string[]>([]);

  const allIds = orders.map((o) => o.id);
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
      label: 'Cancel',
      icon: XCircle,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Cancel {count} order{count === 1 ? "" : "s"}? Inventory is restocked and payment voids are queued. This cannot be undone.',
      onAction: async (ids) => {
        await bulkCancelOrdersAction(ids);
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
                    aria-label="Select all orders"
                  />
                </TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Channel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow
                  key={o.id}
                  data-state={selected.includes(o.id) ? 'selected' : undefined}
                  className="group"
                >
                  <TableCell className="w-10">
                    <Checkbox
                      checked={selected.includes(o.id)}
                      onCheckedChange={() => toggle(o.id)}
                      aria-label={`Select order ${o.orderNumber}`}
                    />
                  </TableCell>
                  <TableCell>
                    <EntityRowLink
                      href={`/crm/orders/${o.id}`}
                      entityType="order"
                      entityId={o.id}
                      className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                    >
                      {o.orderNumber}
                    </EntityRowLink>
                  </TableCell>
                  <TableCell>
                    <Badge color={STATUS_VARIANT[o.status] ?? 'outline'} className="text-xs">
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {o.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.currency} {Number(o.total).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number.isNaN(Number(o.amountPaid))
                      ? '—'
                      : `${o.currency} ${Number(o.amountPaid).toLocaleString()}`}
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {o.placedAt ? new Date(o.placedAt).toLocaleDateString() : '—'}
                    </Text>
                  </TableCell>
                  <TableCell>
                    <Text size="sm" variant="muted">
                      {o.channel ?? '—'}
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
