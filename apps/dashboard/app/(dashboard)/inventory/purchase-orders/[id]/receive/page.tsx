import { notFound, redirect } from 'next/navigation';
import { PackageCheck } from 'lucide-react';

import { PageHeader } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { ReceiveForm } from './_components/receive-form';
import type { PurchaseOrderDetail } from '../../_components/types';

// Receive against a PO (docs/100 P3c). Only submitted/partial POs can be received
// — anything else redirects back to the PO detail.

export const dynamic = 'force-dynamic';

export default async function ReceivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let po: PurchaseOrderDetail;
  try {
    po = await api.get<PurchaseOrderDetail>(`/v1/inventory/purchase-orders/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  if (po.status !== 'submitted' && po.status !== 'partial') {
    redirect(`/inventory/purchase-orders/${id}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<PackageCheck className="h-5 w-5" />}
          title={`Receive ${po.number}`}
          description={`Book goods into ${po.warehouseName ?? po.warehouseCode ?? 'the warehouse'}. Receiving advances the order to partial or received.`}
        />
        <ReceiveForm
          purchaseOrderId={po.id}
          purchaseOrderNumber={po.number}
          currency={po.currency}
          lines={po.lines}
          today={today}
        />
      </div>
    </div>
  );
}
