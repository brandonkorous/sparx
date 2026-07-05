'use server';

// Server actions for platform coupon management (Slice 4). Each RE-CHECKS
// billing:act server-side (never trust the client that rendered the control),
// calls the audited api-rest billing seam, and records the operator action.

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { OperatorApiError, type OperatorCouponInput, type OperatorIdentity } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';

export type BillingActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(err: unknown): string {
  return err instanceof OperatorApiError ? err.message : 'Something went wrong. Please try again.';
}

async function audit(
  operator: OperatorIdentity,
  action: string,
  targetId: string | null
): Promise<void> {
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'billing:act',
      action,
      targetType: 'coupon',
      targetId,
    });
  } catch {
    // best-effort audit
  }
}

export async function createCouponAction(input: OperatorCouponInput): Promise<BillingActionResult> {
  const operator = await requireCapability('billing:act');
  try {
    const coupon = await operatorApi().createCoupon(input, operator.id);
    await audit(operator, 'billing.coupon.create', coupon.id);
    revalidatePath('/sparx/billing');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deleteCouponAction(couponId: string): Promise<BillingActionResult> {
  const operator = await requireCapability('billing:act');
  try {
    await operatorApi().deleteCoupon(couponId, operator.id);
    await audit(operator, 'billing.coupon.delete', couponId);
    revalidatePath('/sparx/billing');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
