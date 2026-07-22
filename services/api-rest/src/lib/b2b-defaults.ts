// B2B activation defaults (docs/104 L2).
//
// On `module.activated(b2b)`, seed a single tenant-wide purchase-approval rule
// so the B2B → Approval rules surface is wired and ready to switch on — but
// seeded INACTIVE (`isActive: false`) so it changes no checkout behaviour until
// the tenant deliberately enables and tunes it. The threshold ($5,000) is a sane
// starting point a tenant edits in place.
//
// Find-or-create by "a tenant-wide rule (accountId null) already exists": a
// tenant that configured approvals — or already has this default — is never
// disturbed (docs/104 R1–R4). `tenantId` is scoped explicitly (not just RLS)
// since the local superuser bypasses RLS.

import { withTenant, type TenantContext } from '@sparx/db';

const DEFAULT_THRESHOLD_CENTS = 500_000; // $5,000

export async function bootstrapDefaultApprovalRule(
  ctx: TenantContext
): Promise<{ created: boolean }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseApprovalRule.findFirst({
      where: { tenantId: ctx.tenantId, accountId: null, propertyId: null },
      select: { id: true },
    });
    if (existing) return { created: false };

    await tx.purchaseApprovalRule.create({
      data: {
        tenantId: ctx.tenantId,
        accountId: null,
        // The activation default stays tenant-wide (docs/131 §4), and it is safe
        // to do so precisely because it ships INACTIVE. It is a starting point an
        // operator opts into, not a control that fires — so it cannot gate a
        // business nobody configured it for.
        propertyId: null,
        minAmountCents: DEFAULT_THRESHOLD_CENTS,
        isActive: false,
      },
    });
    return { created: true };
  });
}
