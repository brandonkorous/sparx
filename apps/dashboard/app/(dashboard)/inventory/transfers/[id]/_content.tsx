import { notFound } from 'next/navigation';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';

import { Badge, Card, CardContent, Heading, Stack, Text } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import {
  formatDate,
  transferStatus,
  warehouseLabel,
  type InventoryTransferDetail,
} from '../_components/types';
import { TransferActionsBar } from './_components/transfer-actions-bar';
import { TransferLinesPanel } from './_components/transfer-lines-panel';

// Inventory transfer detail (docs/100 P4) — the working surface for one transfer:
// the lifecycle bar (ship → receive → cancel), the route, and the lines table
// (quantity / received). While `draft` the lines are editable; while `in_transit`
// the panel becomes a receive form; once received/cancelled it is read-only.

export async function InventoryTransferDetailContent({ id }: { id: string }) {
  let transfer: InventoryTransferDetail;
  try {
    transfer = await api.get<InventoryTransferDetail>(`/v1/inventory/transfers/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const status = transferStatus(transfer.status);

  return (
    <Stack gap={6}>
      <Stack direction="row" align="start" justify="between" wrap gap={4}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={3} wrap>
            <ArrowLeftRight className="h-5 w-5" />
            <Heading level={1}>{transfer.number}</Heading>
            <Badge color={status.color}>{status.label}</Badge>
          </Stack>
          <Stack direction="row" align="center" gap={2} wrap>
            <Text size="sm" variant="muted">
              {warehouseLabel(transfer.fromWarehouseName, transfer.fromWarehouseCode)}
            </Text>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            <Text size="sm" variant="muted">
              {warehouseLabel(transfer.toWarehouseName, transfer.toWarehouseCode)}
            </Text>
            {transfer.note ? (
              <Text size="sm" variant="muted">
                · {transfer.note}
              </Text>
            ) : null}
          </Stack>
        </Stack>
        <TransferActionsBar id={transfer.id} status={transfer.status} />
      </Stack>

      <Stack direction="row" gap={4} wrap>
        <Stat label="Units" value={String(transfer.totalQuantity)} />
        <Stat label="Lines" value={String(transfer.lineCount)} />
        <Stat label="Shipped" value={formatDate(transfer.shippedAt)} />
        <Stat
          label={transfer.status === 'cancelled' ? 'Cancelled' : 'Received'}
          value={formatDate(
            transfer.status === 'cancelled' ? transfer.cancelledAt : transfer.receivedAt
          )}
        />
      </Stack>

      <TransferLinesPanel id={transfer.id} status={transfer.status} lines={transfer.lines} />
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[9rem] flex-1">
      <CardContent>
        <Stack gap={1} className="py-2">
          <Text size="xs" variant="muted">
            {label}
          </Text>
          <Text size="lg">{value}</Text>
        </Stack>
      </CardContent>
    </Card>
  );
}
