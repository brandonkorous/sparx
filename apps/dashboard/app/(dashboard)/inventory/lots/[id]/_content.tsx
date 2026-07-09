import { notFound } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import {
  formatDate,
  hazmatLabel,
  recallBadge,
  serialStatusColor,
  serialStatusLabel,
  type LotDetail,
  type SerialRow,
} from '../_components/types';
import { LotActionsBar } from './_components/lot-actions-bar';
import { SerialsPanel } from './_components/serials-panel';

// Lot detail (docs/100 P4d) — one batch: its metadata, recall state + actions, and
// the serial roster (list / add / status changes). Quantities are traceability
// metadata; authoritative on-hand lives on the (variant, warehouse) level.

export async function LotDetailContent({ id }: { id: string }) {
  let lot: LotDetail;
  try {
    lot = await api.get<LotDetail>(`/v1/inventory/lots/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  const { data: serials } = await api.getPaged<SerialRow[]>(
    `/v1/inventory/lots/${id}/serials?take=500`
  );

  const recall = recallBadge(lot.recallStatus);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <CircleAlert className="h-5 w-5" />
            <h1 className="font-mono text-3xl font-semibold">{lot.lotNumber}</h1>
            {recall ? <Badge color={recall.color}>{recall.label}</Badge> : null}
            {lot.hazmatClass !== 'none' ? (
              <Badge color="warning" variant="soft">
                {hazmatLabel(lot.hazmatClass)}
              </Badge>
            ) : null}
          </div>
          <p className="text-base-content/70 text-sm">
            {lot.productTitle ?? lot.variantSku ?? lot.variantId.slice(0, 8)}
            {lot.variantSku ? ` · ${lot.variantSku}` : ''} ·{' '}
            {lot.warehouseName ?? lot.warehouseCode ?? 'Warehouse'}
          </p>
        </div>
        <LotActionsBar id={lot.id} recallStatus={lot.recallStatus} />
      </div>

      {recall && lot.recallStatus === 'active' ? (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1 py-1">
              <p className="text-danger text-sm font-medium">Recall active</p>
              <p className="text-sm">{lot.recallReason ?? 'No reason recorded.'}</p>
              <p className="text-base-content/70 text-xs">Recalled {formatDate(lot.recalledAt)}</p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-row flex-wrap gap-4">
        <Stat label="Quantity" value={String(lot.quantity)} />
        <Stat label="Serials" value={String(lot.serialCount)} />
        <Stat label="Manufactured" value={formatDate(lot.manufacturedAt)} />
        <Stat label="Expires" value={formatDate(lot.expiresAt)} />
        <Stat label="Supplier ref" value={lot.supplierBatchRef ?? '—'} />
      </div>

      {lot.serialCounts.length > 0 ? (
        <div className="flex flex-row flex-wrap items-center gap-2">
          <p className="text-base-content/70 text-sm">Serial status:</p>
          {lot.serialCounts.map((c) => (
            <Badge key={c.status} color={serialStatusColor(c.status)} variant="soft">
              {serialStatusLabel(c.status)} · {c.count}
            </Badge>
          ))}
        </div>
      ) : null}

      <SerialsPanel
        lotId={lot.id}
        variantId={lot.variantId}
        warehouseId={lot.warehouseId}
        serials={serials}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[8rem] flex-1">
      <CardBody>
        <div className="flex flex-col gap-1 py-2">
          <p className="text-base-content/70 text-xs">{label}</p>
          <p className="text-lg">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
