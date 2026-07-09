import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PackageCheck } from 'lucide-react';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { formatDate, formatMoney, type GoodsReceiptDetail } from '../_components/types';

// Goods-receipt detail (docs/100 P3c) — read-only. A receipt is immutable once
// posted; corrections are later adjustments/counts (P4).

export async function GoodsReceiptDetailContent({ id }: { id: string }) {
  let receipt: GoodsReceiptDetail;
  try {
    receipt = await api.get<GoodsReceiptDetail>(`/v1/inventory/receipts/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const totalCents = receipt.lines.reduce((s, l) => s + l.unitCostCents * l.quantityReceived, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <PackageCheck className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{receipt.number}</h1>
            <Badge color="success">received</Badge>
          </div>
          <p className="text-base-content/70 text-sm">
            {receipt.purchaseOrderNumber ? (
              <>
                against{' '}
                <Link
                  href={`/inventory/purchase-orders/${receipt.purchaseOrderId}`}
                  className="hover:text-module underline"
                >
                  {receipt.purchaseOrderNumber}
                </Link>
              </>
            ) : null}{' '}
            · {receipt.warehouseName ?? receipt.warehouseCode ?? '—'} ·{' '}
            {formatDate(receipt.receivedAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-row flex-wrap gap-4">
        <Stat label="Units received" value={String(receipt.quantityReceived)} />
        <Stat label="Lines" value={String(receipt.lineCount)} />
        <Stat label="Cost received" value={formatMoney(totalCents, 'USD')} />
        <Stat label="Reference" value={receipt.reference ?? '—'} />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-3 py-2">
            <h3 className="text-xl font-semibold">Lines</h3>
            <div className="flex flex-col gap-2">
              {receipt.lines.map((l) => (
                <div
                  key={l.id}
                  className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2"
                >
                  <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
                    <p className="text-sm font-medium">
                      {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
                    </p>
                    <p className="text-base-content/70 font-mono text-xs">
                      {l.variantSku ?? l.variantId}
                      {l.lotNumber ? ` · lot ${l.lotNumber}` : ''}
                    </p>
                  </div>
                  <p className="text-sm">×{l.quantityReceived}</p>
                  <p className="text-base-content/70 w-[6rem] text-right text-sm">
                    {formatMoney(l.unitCostCents, 'USD')}
                  </p>
                  <p className="w-[6rem] text-right text-sm font-medium">
                    {formatMoney(l.unitCostCents * l.quantityReceived, 'USD')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {receipt.note && (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1 py-2">
              <p className="text-base-content/70 text-xs">Note</p>
              <p className="text-sm whitespace-pre-wrap">{receipt.note}</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[9rem] flex-1">
      <CardBody>
        <div className="flex flex-col gap-1 py-2">
          <p className="text-base-content/70 text-xs">{label}</p>
          <p className="text-lg">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
