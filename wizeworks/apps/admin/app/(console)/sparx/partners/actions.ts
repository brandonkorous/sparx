'use server';

// Partner-program write actions (Slice 9). Each re-checks `partner:act`
// SERVER-SIDE, acts through the operator seam (which drives partnerService /
// the payout runners and stamps the partner tenant's audit_logs), then writes the
// wize_admin operator audit and revalidates. Approve/reject/tier/status affect one
// partner; commission-approve + payout-run are platform-wide money actions.

import { revalidatePath } from 'next/cache';
import { requireCapability } from '@wizeworks/operator-auth/next';
import { logOperatorAction } from '@wizeworks/operator-auth';
import {
  OperatorApiError,
  type OperatorCommissionApproveResult,
  type OperatorPartnerApplication,
  type OperatorPartnerListItem,
  type OperatorPartnerTier,
  type OperatorPayoutRunResult,
} from '@wizeworks/operator';
import { operatorApi } from '@/lib/operator-api';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  return e instanceof OperatorApiError ? e.message : 'Something went wrong. Please try again.';
}

export async function approveApplicationAction(
  applicationId: string
): Promise<ActionResult<OperatorPartnerListItem>> {
  const operator = await requireCapability('partner:act');
  try {
    const partner = await operatorApi().approvePartnerApplication(applicationId, {}, operator.id);
    await audit(operator, 'partner.application.approve', partner.tenantId, {
      applicationId,
      tier: partner.tier,
    });
    revalidatePath('/sparx/partners');
    return { ok: true, data: partner };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function rejectApplicationAction(
  applicationId: string
): Promise<ActionResult<OperatorPartnerApplication>> {
  const operator = await requireCapability('partner:act');
  try {
    const application = await operatorApi().rejectPartnerApplication(
      applicationId,
      {},
      operator.id
    );
    await audit(operator, 'partner.application.reject', undefined, { applicationId });
    revalidatePath('/sparx/partners');
    return { ok: true, data: application };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function setPartnerTierAction(
  tenantId: string,
  tier: OperatorPartnerTier
): Promise<ActionResult<OperatorPartnerListItem>> {
  const operator = await requireCapability('partner:act');
  try {
    const partner = await operatorApi().setPartnerTier(tenantId, { tier }, operator.id);
    await audit(operator, 'partner.tier.set', tenantId, { tier });
    revalidatePath(`/sparx/partners/${tenantId}`);
    revalidatePath('/sparx/partners');
    return { ok: true, data: partner };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function setPartnerStatusAction(
  tenantId: string,
  status: 'active' | 'suspended'
): Promise<ActionResult<OperatorPartnerListItem>> {
  const operator = await requireCapability('partner:act');
  try {
    const partner = await operatorApi().setPartnerStatus(tenantId, { status }, operator.id);
    await audit(
      operator,
      status === 'suspended' ? 'partner.suspend' : 'partner.reinstate',
      tenantId,
      { status }
    );
    revalidatePath(`/sparx/partners/${tenantId}`);
    revalidatePath('/sparx/partners');
    return { ok: true, data: partner };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function approveCommissionsAction(): Promise<
  ActionResult<OperatorCommissionApproveResult>
> {
  const operator = await requireCapability('partner:act');
  try {
    const result = await operatorApi().approvePartnerCommissions(operator.id);
    await audit(operator, 'partner.commissions.approve', undefined, { approved: result.approved });
    revalidatePath('/sparx/partners');
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function runPayoutsAction(): Promise<ActionResult<OperatorPayoutRunResult>> {
  const operator = await requireCapability('partner:act');
  try {
    const result = await operatorApi().runPartnerPayouts(operator.id);
    await audit(operator, 'partner.payouts.run', undefined, {
      partnersPaid: result.partnersPaid,
      totalCents: result.totalCents,
    });
    revalidatePath('/sparx/partners');
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/** Best-effort wize_admin operator audit — never blocks the action. */
async function audit(
  operator: { id: string; email: string },
  action: string,
  targetTenantId: string | undefined,
  diff: Record<string, unknown>
): Promise<void> {
  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'partner:act',
      action,
      ...(targetTenantId ? { targetTenantId } : {}),
      diff,
    });
  } catch {
    // swallowed
  }
}
