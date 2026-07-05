'use server';

// Per-tenant billing write actions (Slice 4): refund a platform charge, author an
// enterprise invoice. Both RE-CHECK billing:act server-side and audit against the
// target tenant (owner-visible attribution comes later via the tenant audit log;
// the operator audit log records it now).

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import {
  OperatorApiError,
  type OperatorIdentity,
  type OperatorInvoiceInput,
  type OperatorRefundInput,
} from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';

export type BillingActionResult = { ok: true; message: string } | { ok: false; error: string };

function errorMessage(err: unknown): string {
  return err instanceof OperatorApiError ? err.message : 'Something went wrong. Please try again.';
}

async function audit(
  operator: OperatorIdentity,
  action: string,
  tenantId: string,
  diff: unknown
): Promise<void> {
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'billing:act',
      action,
      targetTenantId: tenantId,
      diff,
    });
  } catch {
    // best-effort audit
  }
}

export async function refundChargeAction(
  tenantId: string,
  input: OperatorRefundInput
): Promise<BillingActionResult> {
  const operator = await requireCapability('billing:act');
  try {
    const result = await operatorApi().refundCharge(input, operator.id);
    await audit(operator, 'billing.refund', tenantId, {
      chargeId: input.chargeId,
      amountCents: result.amountCents,
      reason: input.reason ?? null,
    });
    revalidatePath(`/sparx/tenants/${tenantId}/billing`);
    return { ok: true, message: 'Refund issued.' };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function createInvoiceAction(
  input: OperatorInvoiceInput
): Promise<BillingActionResult> {
  const operator = await requireCapability('billing:act');
  try {
    const result = await operatorApi().createInvoice(input, operator.id);
    await audit(operator, 'billing.invoice.create', input.tenantId, {
      invoiceId: result.id,
      totalCents: result.totalCents,
      finalized: input.autoFinalize,
    });
    revalidatePath(`/sparx/tenants/${input.tenantId}/billing`);
    return {
      ok: true,
      message: input.autoFinalize ? 'Invoice issued.' : 'Draft invoice created.',
    };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
