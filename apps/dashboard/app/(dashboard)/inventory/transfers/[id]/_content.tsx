import { notFound } from 'next/navigation';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <ArrowLeftRight className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{transfer.number}</h1>
            <Badge color={status.color}>{status.label}</Badge>
          </div>
          <div className="flex flex-row flex-wrap items-center gap-2">
            <p className="text-base-content text-sm">
              {warehouseLabel(transfer.fromWarehouseName, transfer.fromWarehouseCode)}
            </p>
            <ArrowRight className="text-base-content h-3.5 w-3.5" />
            <p className="text-base-content text-sm">
              {warehouseLabel(transfer.toWarehouseName, transfer.toWarehouseCode)}
            </p>
            {transfer.note ? <p className="text-base-content text-sm">· {transfer.note}</p> : null}
          </div>
        </div>
        <TransferActionsBar id={transfer.id} status={transfer.status} />
      </div>

      <div className="flex flex-row flex-wrap gap-4">
        <Stat label="Units" value={String(transfer.totalQuantity)} />
        <Stat label="Lines" value={String(transfer.lineCount)} />
        <Stat label="Shipped" value={formatDate(transfer.shippedAt)} />
        <Stat
          label={transfer.status === 'cancelled' ? 'Cancelled' : 'Received'}
          value={formatDate(
            transfer.status === 'cancelled' ? transfer.cancelledAt : transfer.receivedAt
          )}
        />
      </div>

      <TransferLinesPanel id={transfer.id} status={transfer.status} lines={transfer.lines} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[9rem] flex-1">
      <CardBody>
        <div className="flex flex-col gap-1 py-2">
          <p className="text-base-content text-xs">{label}</p>
          <p className="text-lg">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
