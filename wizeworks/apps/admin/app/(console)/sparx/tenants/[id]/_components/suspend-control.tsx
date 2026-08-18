'use client';

// Suspend / reactivate a tenant (build-plan §5 Slice 8), gated `tenant:suspend`.
// STATUS-ONLY for now: it flips the account status and records it in the tenant's
// own activity log, but does NOT yet block the tenant's sign-in, API, or public
// site — the confirm copy says so plainly. Enforcement is a scoped follow-up
// (docs/apps/admin/slice-8-enforcement-followups.md).

import * as React from 'react';
import { Button, toast, useConfirm } from '@wizeworks/ui';
import { setTenantStatusAction } from '../actions';

export function SuspendControl({
  tenantId,
  tenantName,
  status,
}: {
  tenantId: string;
  tenantName: string;
  status: string;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const suspended = status === 'suspended';

  async function run() {
    const ok = await confirm({
      title: suspended ? `Reactivate ${tenantName}?` : `Suspend ${tenantName}?`,
      description: suspended
        ? `Sets ${tenantName} back to active. It appears in the tenant’s account activity as a WizeWorks-initiated change.`
        : `Marks ${tenantName} suspended and records it in the tenant’s account activity. Note: this is a status change for now — it does not yet block their sign-in, API, or public site. That enforcement is a separate, upcoming step.`,
      confirmLabel: suspended ? 'Reactivate' : 'Suspend',
      color: suspended ? 'module' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setTenantStatusAction(tenantId, !suspended);
      if (res.ok) {
        toast.success(suspended ? `${tenantName} reactivated` : `${tenantName} suspended`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      type="button"
      color={suspended ? 'primary' : 'danger'}
      variant="soft"
      onClick={run}
      disabled={pending}
      loading={pending}
    >
      {suspended ? 'Reactivate account' : 'Suspend account'}
    </Button>
  );
}
