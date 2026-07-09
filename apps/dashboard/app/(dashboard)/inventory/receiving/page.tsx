import Link from 'next/link';
import { PackageCheck, ClipboardList } from 'lucide-react';

import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { purchaseOrderStatus, type PurchaseOrderRow } from '../purchase-orders/_components/types';
import { formatDate, type GoodsReceiptRow } from './_components/types';

// Receiving (docs/100 P3c) — the inbound work surface: purchase orders awaiting
// goods + a feed of recent receipts. "Receive" books stock against a PO, writing
// `receive` movements and advancing the order to partial/received.

export const dynamic = 'force-dynamic';

export default async function ReceivingPage() {
  const [submitted, partial, recent] = await Promise.all([
    api.getPaged<PurchaseOrderRow[]>('/v1/inventory/purchase-orders?status=submitted&take=100'),
    api.getPaged<PurchaseOrderRow[]>('/v1/inventory/purchase-orders?status=partial&take=100'),
    api.getPaged<GoodsReceiptRow[]>('/v1/inventory/receipts?take=25'),
  ]);

  const awaiting = [...submitted.data, ...partial.data].sort(byExpected);
  const receipts = recent.data;

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<PackageCheck className="h-5 w-5" />}
          title="Receiving"
          description="Book goods against your purchase orders. Receiving raises stock through the ledger (moving-average cost) and advances each order to partial or received."
        />

        <Card>
          <CardBody>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-row items-center gap-2">
                <h3 className="text-xl font-semibold">Awaiting receipt</h3>
                <Badge color="module">{awaiting.length}</Badge>
              </div>
              {awaiting.length === 0 ? (
                <p className="text-base-content/70 text-sm">
                  Nothing awaiting receipt. Submit a purchase order to start receiving against it.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {awaiting.map((po) => (
                    <AwaitingRow key={po.id} po={po} />
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex flex-col gap-3 py-2">
              <h3 className="text-xl font-semibold">Recent receipts</h3>
              {receipts.length === 0 ? (
                <p className="text-base-content/70 text-sm">No goods received yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {receipts.map((r) => (
                    <ReceiptRow key={r.id} receipt={r} />
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function AwaitingRow({ po }: { po: PurchaseOrderRow }) {
  const outstanding = Math.max(0, po.quantityOrdered - po.quantityReceived);
  const s = purchaseOrderStatus(po.status);
  return (
    <div className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2">
      <Link
        href={`/inventory/purchase-orders/${po.id}`}
        className="hover:text-module font-mono text-xs"
      >
        {po.number}
      </Link>
      <div className="flex min-w-[10rem] flex-1 flex-col gap-0">
        <p className="text-sm font-medium">{po.supplierName ?? po.supplierCode ?? 'Supplier'}</p>
        <p className="text-base-content/70 text-xs">
          {po.warehouseName ?? po.warehouseCode ?? '—'} · exp {formatDate(po.expectedArrivalAt)}
        </p>
      </div>
      <Badge color={s.color}>{s.label}</Badge>
      <p className="text-base-content/70 text-sm">{outstanding} outstanding</p>
      <Button
        color="module"
        size="sm"
        render={<Link href={`/inventory/purchase-orders/${po.id}/receive`} />}
      >
        Receive
      </Button>
    </div>
  );
}

function ReceiptRow({ receipt }: { receipt: GoodsReceiptRow }) {
  return (
    <div className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2">
      <Link
        href={`/inventory/receiving/${receipt.id}`}
        className="hover:text-module font-mono text-xs"
      >
        {receipt.number}
      </Link>
      <div className="flex flex-1 flex-row items-center gap-2">
        <ClipboardList className="h-3.5 w-3.5 opacity-60" />
        <p className="text-base-content/70 text-sm">
          {receipt.purchaseOrderNumber ?? '—'} · {formatDate(receipt.receivedAt)}
          {receipt.reference ? ` · ${receipt.reference}` : ''}
        </p>
      </div>
      <p className="text-sm">
        {receipt.quantityReceived} unit{receipt.quantityReceived === 1 ? '' : 's'} ·{' '}
        {receipt.lineCount} line{receipt.lineCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function byExpected(a: PurchaseOrderRow, b: PurchaseOrderRow): number {
  const av = a.expectedArrivalAt ? Date.parse(a.expectedArrivalAt) : Number.POSITIVE_INFINITY;
  const bv = b.expectedArrivalAt ? Date.parse(b.expectedArrivalAt) : Number.POSITIVE_INFINITY;
  return av - bv;
}
