import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClipboardList } from 'lucide-react';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import {
  formatDate,
  formatMoney,
  isDraft,
  purchaseOrderStatus,
  type PurchaseOrderDetail,
} from '../_components/types';
import { PurchaseOrderActionsBar } from './_components/purchase-order-actions-bar';
import { PurchaseOrderEditForm } from './_components/purchase-order-edit-form';
import { PurchaseOrderLinesPanel } from './_components/purchase-order-lines-panel';
import type { GoodsReceiptRow } from '../../receiving/_components/types';

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

export async function PurchaseOrderDetailContent({ id }: { id: string }) {
  let po: PurchaseOrderDetail;
  try {
    po = await api.get<PurchaseOrderDetail>(`/v1/inventory/purchase-orders/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const draft = isDraft(po.status);
  const [warehouses, receipts] = await Promise.all([
    draft
      ? api.getPaged<PartyOption[]>('/v1/inventory/locations?take=250').then((r) => r.data)
      : Promise.resolve([] as PartyOption[]),
    draft
      ? Promise.resolve([] as GoodsReceiptRow[])
      : api
          .getPaged<GoodsReceiptRow[]>(`/v1/inventory/receipts?purchase_order_id=${po.id}&take=50`)
          .then((r) => r.data),
  ]);
  const status = purchaseOrderStatus(po.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <ClipboardList className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{po.number}</h1>
            <Badge color={status.color}>{status.label}</Badge>
          </div>
          <p className="text-base-content text-sm">
            {po.supplierName ?? po.supplierCode ?? 'Supplier'} →{' '}
            {po.warehouseName ?? po.warehouseCode ?? 'Warehouse'}
            {po.reference ? ` · ref ${po.reference}` : ''}
          </p>
        </div>
        <PurchaseOrderActionsBar id={po.id} status={po.status} />
      </div>

      <div className="flex flex-row flex-wrap gap-4">
        <Stat label="Total" value={formatMoney(po.totalCents, po.currency)} />
        <Stat label="Received" value={`${po.quantityReceived}/${po.quantityOrdered} units`} />
        <Stat label="Ordered" value={formatDate(po.orderedAt)} />
        <Stat label="Expected" value={formatDate(po.expectedArrivalAt)} />
        <Stat label="Terms" value={po.paymentTerms ?? '—'} />
      </div>

      {draft ? (
        <PurchaseOrderEditForm po={po} warehouses={warehouses} />
      ) : (
        <ReadOnlySummary po={po} />
      )}

      <PurchaseOrderLinesPanel
        id={po.id}
        lines={po.lines}
        editable={draft}
        summary={{
          subtotalCents: po.subtotalCents,
          shippingCents: po.shippingCents,
          totalCents: po.totalCents,
          currency: po.currency,
        }}
      />

      {!draft && <ReceiptsPanel receipts={receipts} />}
    </div>
  );
}

function ReceiptsPanel({ receipts }: { receipts: GoodsReceiptRow[] }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-3 py-2">
          <h3 className="text-xl font-semibold">Receipts</h3>
          {receipts.length === 0 ? (
            <p className="text-base-content text-sm">
              No goods received yet. Use <span className="font-medium">Receive</span> to book stock
              against this order.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {receipts.map((r) => (
                <div
                  key={r.id}
                  className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2"
                >
                  <Link
                    href={`/inventory/receiving/${r.id}`}
                    className="hover:text-module font-mono text-xs"
                  >
                    {r.number}
                  </Link>
                  <p className="text-base-content flex-1 text-sm">
                    {formatDate(r.receivedAt)}
                    {r.reference ? ` · ${r.reference}` : ''}
                  </p>
                  <p className="text-sm">
                    {r.quantityReceived} unit{r.quantityReceived === 1 ? '' : 's'} · {r.lineCount}{' '}
                    line{r.lineCount === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function ReadOnlySummary({ po }: { po: PurchaseOrderDetail }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-row flex-wrap gap-6">
            <Field label="Supplier">
              <Link href={`/inventory/suppliers/${po.supplierId}`} className="hover:text-module">
                {po.supplierName ?? po.supplierCode ?? '—'}
              </Link>
            </Field>
            <Field label="Warehouse">{po.warehouseName ?? po.warehouseCode ?? '—'}</Field>
            <Field label="Currency">{po.currency}</Field>
            <Field label="Payment terms">{po.paymentTerms ?? '—'}</Field>
          </div>
          {po.notes && <Field label="Notes">{po.notes}</Field>}
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0">
      <p className="text-base-content text-xs">{label}</p>
      <p className="text-sm">{children}</p>
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
