import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PackageCheck } from 'lucide-react';

import { Badge, Card, CardContent, Heading, Stack, Text } from '@sparx/ui';

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
    <Stack gap={6}>
      <Stack direction="row" align="start" justify="between" wrap gap={4}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={3} wrap>
            <PackageCheck className="h-5 w-5" />
            <Heading level={1}>{receipt.number}</Heading>
            <Badge color="success">received</Badge>
          </Stack>
          <Text size="sm" variant="muted">
            {receipt.purchaseOrderNumber ? (
              <>
                against{' '}
                <Link
                  href={`/inventory/purchase-orders/${receipt.purchaseOrderId}`}
                  className="underline hover:text-[var(--module-active)]"
                >
                  {receipt.purchaseOrderNumber}
                </Link>
              </>
            ) : null}{' '}
            · {receipt.warehouseName ?? receipt.warehouseCode ?? '—'} ·{' '}
            {formatDate(receipt.receivedAt)}
          </Text>
        </Stack>
      </Stack>

      <Stack direction="row" gap={4} wrap>
        <Stat label="Units received" value={String(receipt.quantityReceived)} />
        <Stat label="Lines" value={String(receipt.lineCount)} />
        <Stat label="Cost received" value={formatMoney(totalCents, 'USD')} />
        <Stat label="Reference" value={receipt.reference ?? '—'} />
      </Stack>

      <Card>
        <CardContent>
          <Stack gap={3} className="py-2">
            <Heading level={3}>Lines</Heading>
            <Stack gap={2}>
              {receipt.lines.map((l) => (
                <Stack
                  key={l.id}
                  direction="row"
                  align="center"
                  gap={3}
                  wrap
                  className="rounded border border-[var(--color-border-default)] px-3 py-2"
                >
                  <Stack gap={0} className="min-w-[12rem] flex-1">
                    <Text size="sm" className="font-medium">
                      {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
                    </Text>
                    <Text size="xs" variant="muted" className="font-mono">
                      {l.variantSku ?? l.variantId}
                      {l.lotNumber ? ` · lot ${l.lotNumber}` : ''}
                    </Text>
                  </Stack>
                  <Text size="sm">×{l.quantityReceived}</Text>
                  <Text size="sm" variant="muted" className="w-[6rem] text-right">
                    {formatMoney(l.unitCostCents, 'USD')}
                  </Text>
                  <Text size="sm" className="w-[6rem] text-right font-medium">
                    {formatMoney(l.unitCostCents * l.quantityReceived, 'USD')}
                  </Text>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {receipt.note && (
        <Card>
          <CardContent>
            <Stack gap={1} className="py-2">
              <Text size="xs" variant="muted">
                Note
              </Text>
              <Text size="sm" className="whitespace-pre-wrap">
                {receipt.note}
              </Text>
            </Stack>
          </CardContent>
        </Card>
      )}
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
