'use server';

import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-rest-client';
import type { ActionResult } from './rest-action';
import { restAction } from './rest-action';

// Goods-receipt Server Action (docs/100 P3c). Posting a receipt books goods into
// stock and advances the PO — revalidate the receiving index, the PO list, and
// the affected PO detail so received counts + status refresh everywhere.

export async function createGoodsReceiptAction(
  input: unknown
): Promise<ActionResult<{ id: string; purchaseOrderId: string }>> {
  return restAction(async () => {
    const result = await api.post<{ id: string; purchaseOrderId: string }>(
      '/v1/inventory/receipts',
      input
    );
    revalidatePath('/inventory/receiving');
    revalidatePath('/inventory/purchase-orders');
    if (result.purchaseOrderId) {
      revalidatePath(`/inventory/purchase-orders/${result.purchaseOrderId}`);
    }
    return result;
  });
}
