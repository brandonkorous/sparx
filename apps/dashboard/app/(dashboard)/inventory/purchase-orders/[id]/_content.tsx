import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClipboardList } from 'lucide-react';

import { Badge, Card, CardContent, Heading, Stack, Text } from '@sparx/ui';

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
  const warehouses = draft
    ? (await api.getPaged<PartyOption[]>('/v1/inventory/locations?take=250')).data
    : [];
  const status = purchaseOrderStatus(po.status);

  return (
    <Stack gap={6}>
      <Stack direction="row" align="start" justify="between" wrap gap={4}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={3} wrap>
            <ClipboardList className="h-5 w-5" />
            <Heading level={1}>{po.number}</Heading>
            <Badge color={status.color}>{status.label}</Badge>
          </Stack>
          <Text size="sm" variant="muted">
            {po.supplierName ?? po.supplierCode ?? 'Supplier'} →{' '}
            {po.warehouseName ?? po.warehouseCode ?? 'Warehouse'}
            {po.reference ? ` · ref ${po.reference}` : ''}
          </Text>
        </Stack>
        <PurchaseOrderActionsBar id={po.id} status={po.status} />
      </Stack>

      <Stack direction="row" gap={4} wrap>
        <Stat label="Total" value={formatMoney(po.totalCents, po.currency)} />
        <Stat label="Received" value={`${po.quantityReceived}/${po.quantityOrdered} units`} />
        <Stat label="Ordered" value={formatDate(po.orderedAt)} />
        <Stat label="Expected" value={formatDate(po.expectedArrivalAt)} />
        <Stat label="Terms" value={po.paymentTerms ?? '—'} />
      </Stack>

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

      <Text size="xs" variant="muted">
        Receiving against this order (booking goods into stock) lands in{' '}
        <Link
          href="/inventory/purchase-orders"
          className="underline hover:text-[var(--module-active)]"
        >
          a later step
        </Link>{' '}
        (docs/100 P3c).
      </Text>
    </Stack>
  );
}

function ReadOnlySummary({ po }: { po: PurchaseOrderDetail }) {
  return (
    <Card>
      <CardContent>
        <Stack gap={3} className="py-2">
          <Stack direction="row" gap={6} wrap>
            <Field label="Supplier">
              <Link
                href={`/inventory/suppliers/${po.supplierId}`}
                className="hover:text-[var(--module-active)]"
              >
                {po.supplierName ?? po.supplierCode ?? '—'}
              </Link>
            </Field>
            <Field label="Warehouse">{po.warehouseName ?? po.warehouseCode ?? '—'}</Field>
            <Field label="Currency">{po.currency}</Field>
            <Field label="Payment terms">{po.paymentTerms ?? '—'}</Field>
          </Stack>
          {po.notes && <Field label="Notes">{po.notes}</Field>}
        </Stack>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Text size="sm">{children}</Text>
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
