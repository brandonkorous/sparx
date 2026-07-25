'use server';

// Server actions for platform coupon management (Slice 4). Each RE-CHECKS
// billing:act server-side (never trust the client that rendered the control),
// calls the audited api-rest billing seam, and records the operator action.

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import {
  OperatorApiError,
  type OperatorCouponInput,
  type OperatorPromotionCodeInput,
  type OperatorIdentity,
} from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';

export type BillingActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(err: unknown): string {
  return err instanceof OperatorApiError ? err.message : 'Something went wrong. Please try again.';
}

async function audit(
  operator: OperatorIdentity,
  action: string,
  targetType: string,
  targetId: string | null
): Promise<void> {
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'billing:act',
      action,
      targetType,
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
    await audit(operator, 'billing.coupon.create', 'coupon', coupon.id);
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
    await audit(operator, 'billing.coupon.delete', 'coupon', couponId);
    revalidatePath('/sparx/billing');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createPromotionCodeAction(
  input: OperatorPromotionCodeInput
): Promise<BillingActionResult> {
  const operator = await requireCapability('billing:act');
  try {
    const code = await operatorApi().createPromotionCode(input, operator.id);
    await audit(operator, 'billing.promotion_code.create', 'promotion_code', code.id);
    revalidatePath('/sparx/billing');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function deactivatePromotionCodeAction(id: string): Promise<BillingActionResult> {
  const operator = await requireCapability('billing:act');
  try {
    await operatorApi().deactivatePromotionCode(id, operator.id);
    await audit(operator, 'billing.promotion_code.deactivate', 'promotion_code', id);
    revalidatePath('/sparx/billing');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Typeahead search for the tenant-targeted promotion-code picker. Read-only; gated
 *  on billing:act (the same capability the create form requires). Returns a short
 *  list of {id, name, slug}; empty on a too-short query or any error. */
export async function searchTenantsAction(
  q: string
): Promise<{ id: string; name: string; slug: string }[]> {
  const operator = await requireCapability('billing:act');
  const query = q.trim();
  if (query.length < 2) return [];
  try {
    const res = await operatorApi().listTenants({ q: query, limit: 8 }, operator.id);
    return res.tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
  } catch {
    return [];
  }
}
