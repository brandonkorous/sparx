'use client';

// Operator lifecycle controls for a site (gated `site:act`): pause / archive /
// reactivate (properties.status). Each is confirmed and records against the owning
// tenant's activity log. Pausing/archiving is a status change — the confirm copy
// describes what it means in plain terms.

import * as React from 'react';
import { Button, Stack, toast, useConfirm } from '@sparx/ui';
import { setSiteStatusAction } from '../actions';

type SiteStatus = 'active' | 'paused' | 'archived';

export function SiteStatusControl({
  siteId,
  tenantId,
  siteName,
  status,
}: {
  siteId: string;
  tenantId: string;
  siteName: string;
  status: string;
}) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();

  function apply(next: SiteStatus, title: string, description: string, confirmLabel: string) {
    startTransition(async () => {
      const ok = await confirm({
        title,
        description,
        confirmLabel,
        tone: next === 'active' ? 'module' : 'danger',
      });
      if (!ok) return;
      const res = await setSiteStatusAction(siteId, tenantId, next);
      if (res.ok) toast.success(`${siteName} is now ${next}`);
      else toast.error(res.error);
    });
  }

  return (
    <Stack direction="row" gap={2} className="flex-wrap">
      {status !== 'active' ? (
        <Button
          type="button"
          color="primary"
          variant="soft"
          disabled={pending}
          onClick={() =>
            apply(
              'active',
              `Reactivate ${siteName}?`,
              `Sets ${siteName} back to active and live. It appears in the tenant’s account activity as a WizeWorks-initiated change.`,
              'Reactivate'
            )
          }
        >
          Reactivate
        </Button>
      ) : null}
      {status !== 'paused' ? (
        <Button
          type="button"
          color="warning"
          variant="soft"
          disabled={pending}
          onClick={() =>
            apply(
              'paused',
              `Pause ${siteName}?`,
              `Temporarily takes ${siteName} out of active service. Recorded in the tenant’s account activity; reactivate any time from this page.`,
              'Pause site'
            )
          }
        >
          Pause
        </Button>
      ) : null}
      {status !== 'archived' ? (
        <Button
          type="button"
          color="danger"
          variant="soft"
          disabled={pending}
          onClick={() =>
            apply(
              'archived',
              `Archive ${siteName}?`,
              `Archives ${siteName} — it’s retired from active service but its content is kept. Recorded in the tenant’s account activity; you can reactivate it later.`,
              'Archive site'
            )
          }
        >
          Archive
        </Button>
      ) : null}
    </Stack>
  );
}
