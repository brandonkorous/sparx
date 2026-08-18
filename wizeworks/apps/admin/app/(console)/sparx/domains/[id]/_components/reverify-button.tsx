'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, toast, useConfirm } from '@wizeworks/ui';
import { reverifyDomainAction } from '../../actions';

// Force re-verify. Confirmed first (it re-runs DNS verification / re-triggers the
// domain worker), then dispatches the domain:manage server action and toasts the
// outcome. A `noop` outcome (auto-managed host / already-verified apex) is shown
// as an info toast, not an error.
export function ReverifyButton({
  domainId,
  tenantId,
  host,
}: {
  domainId: string;
  tenantId: string;
  host: string;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  async function run() {
    const ok = await confirm({
      title: `Re-verify ${host}?`,
      description:
        'This re-checks the domain’s DNS records now (custom domains) or re-triggers the domain worker to re-check propagation (purchased domains). It never changes billing or DNS.',
      confirmLabel: 'Re-verify',
      color: 'module',
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await reverifyDomainAction(domainId, tenantId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { mode, passed, message } = res.result;
      if (mode === 'synchronous') {
        if (passed) toast.success(message);
        else toast.error(message);
      } else {
        // queued / noop — informational
        toast.success(message);
      }
    });
  }

  return (
    <Button type="button" variant="soft" onClick={run} disabled={pending} loading={pending}>
      <RefreshCw className="mr-1.5 h-4 w-4" />
      Re-verify
    </Button>
  );
}
