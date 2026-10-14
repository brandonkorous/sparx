// One order pane's whole model: what it reads, plus every action it can take.

import type { SurfaceContext } from '../../lib/surfaces/registry';
import { usePurchaseOrderBase } from './use-purchase-order-base';
import { usePurchaseOrderSave } from './use-purchase-order-save';
import { usePurchaseOrderPlace } from './use-purchase-order-place';
import { usePurchaseOrderLifecycle } from './use-purchase-order-lifecycle';

export function usePurchaseOrderDetail(ctx: SurfaceContext) {
  const base = usePurchaseOrderBase(ctx);
  const saver = usePurchaseOrderSave(base);
  const placer = usePurchaseOrderPlace(base, saver.doSave);
  const lifecycle = usePurchaseOrderLifecycle(base);
  return { ...base, ...saver, ...placer, ...lifecycle };
}

export type PurchaseOrderPane = ReturnType<typeof usePurchaseOrderDetail>;
