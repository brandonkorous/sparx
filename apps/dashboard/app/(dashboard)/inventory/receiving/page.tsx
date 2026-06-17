import Link from 'next/link';
import { PackageCheck, ClipboardList } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Container,
  Heading,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

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
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<PackageCheck className="h-5 w-5" />}
          title="Receiving"
          description="Book goods against your purchase orders. Receiving raises stock through the ledger (moving-average cost) and advances each order to partial or received."
        />

        <Card>
          <CardContent>
            <Stack gap={3} className="py-2">
              <Stack direction="row" align="center" gap={2}>
                <Heading level={3}>Awaiting receipt</Heading>
                <Badge color="module">{awaiting.length}</Badge>
              </Stack>
              {awaiting.length === 0 ? (
                <Text size="sm" variant="muted">
                  Nothing awaiting receipt. Submit a purchase order to start receiving against it.
                </Text>
              ) : (
                <Stack gap={2}>
                  {awaiting.map((po) => (
                    <AwaitingRow key={po.id} po={po} />
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack gap={3} className="py-2">
              <Heading level={3}>Recent receipts</Heading>
              {receipts.length === 0 ? (
                <Text size="sm" variant="muted">
                  No goods received yet.
                </Text>
              ) : (
                <Stack gap={2}>
                  {receipts.map((r) => (
                    <ReceiptRow key={r.id} receipt={r} />
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

function AwaitingRow({ po }: { po: PurchaseOrderRow }) {
  const outstanding = Math.max(0, po.quantityOrdered - po.quantityReceived);
  const s = purchaseOrderStatus(po.status);
  return (
    <Stack
      direction="row"
      align="center"
      gap={3}
      wrap
      className="rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Link
        href={`/inventory/purchase-orders/${po.id}`}
        className="font-mono text-xs hover:text-[var(--module-active)]"
      >
        {po.number}
      </Link>
      <Stack gap={0} className="min-w-[10rem] flex-1">
        <Text size="sm" className="font-medium">
          {po.supplierName ?? po.supplierCode ?? 'Supplier'}
        </Text>
        <Text size="xs" variant="muted">
          {po.warehouseName ?? po.warehouseCode ?? '—'} · exp {formatDate(po.expectedArrivalAt)}
        </Text>
      </Stack>
      <Badge color={s.color}>{s.label}</Badge>
      <Text size="sm" variant="muted">
        {outstanding} outstanding
      </Text>
      <Button color="module" size="sm" asChild>
        <Link href={`/inventory/purchase-orders/${po.id}/receive`}>Receive</Link>
      </Button>
    </Stack>
  );
}

function ReceiptRow({ receipt }: { receipt: GoodsReceiptRow }) {
  return (
    <Stack
      direction="row"
      align="center"
      gap={3}
      wrap
      className="rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Link
        href={`/inventory/receiving/${receipt.id}`}
        className="font-mono text-xs hover:text-[var(--module-active)]"
      >
        {receipt.number}
      </Link>
      <Stack direction="row" align="center" gap={2} className="flex-1">
        <ClipboardList className="h-3.5 w-3.5 opacity-60" />
        <Text size="sm" variant="muted">
          {receipt.purchaseOrderNumber ?? '—'} · {formatDate(receipt.receivedAt)}
          {receipt.reference ? ` · ${receipt.reference}` : ''}
        </Text>
      </Stack>
      <Text size="sm">
        {receipt.quantityReceived} unit{receipt.quantityReceived === 1 ? '' : 's'} ·{' '}
        {receipt.lineCount} line{receipt.lineCount === 1 ? '' : 's'}
      </Text>
    </Stack>
  );
}

function byExpected(a: PurchaseOrderRow, b: PurchaseOrderRow): number {
  const av = a.expectedArrivalAt ? Date.parse(a.expectedArrivalAt) : Number.POSITIVE_INFINITY;
  const bv = b.expectedArrivalAt ? Date.parse(b.expectedArrivalAt) : Number.POSITIVE_INFINITY;
  return av - bv;
}
