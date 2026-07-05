'use client';

// Operator storage-limit override editor (build-plan §5 Slice 8), gated
// `tenant:suspend`. STORED + DISPLAYED only for now — the cap is not yet enforced
// at the upload path (a scoped follow-up: docs/apps/admin/
// slice-8-enforcement-followups.md). The current value is shown on the read-only
// StorageCard; this control just edits it. Operators think in GB, so the input is
// GB and converts to bytes on save.

import * as React from 'react';
import { Button, Card, Heading, Input, Label, Stack, Text, toast, useConfirm } from '@sparx/ui';
import { formatBytes } from '@/lib/format';
import { setTenantStorageLimitAction } from '../actions';

const BYTES_PER_GB = 1024 ** 3;

function toGbInput(bytes: number | null): string {
  return bytes != null ? String(Number((bytes / BYTES_PER_GB).toFixed(2))) : '';
}

export function StorageLimitControl({
  tenantId,
  currentLimitBytes,
}: {
  tenantId: string;
  currentLimitBytes: number | null;
}) {
  const confirm = useConfirm();
  const [gb, setGb] = React.useState(toGbInput(currentLimitBytes));
  const [pending, startTransition] = React.useTransition();

  // Reconcile to server truth after a save/clear revalidates the page.
  React.useEffect(() => {
    setGb(toGbInput(currentLimitBytes));
  }, [currentLimitBytes]);

  function save() {
    const value = Number.parseFloat(gb);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a limit in GB greater than zero.');
      return;
    }
    const limitBytes = Math.round(value * BYTES_PER_GB);
    startTransition(async () => {
      const res = await setTenantStorageLimitAction(tenantId, limitBytes);
      if (res.ok) toast.success(`Storage limit set to ${formatBytes(limitBytes)}.`);
      else toast.error(res.error);
    });
  }

  async function clear() {
    const ok = await confirm({
      title: 'Remove storage limit?',
      description:
        'Clears this tenant’s storage-cap override. No data is affected; the platform default applies once cap enforcement ships.',
      confirmLabel: 'Remove limit',
      tone: 'warning',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setTenantStorageLimitAction(tenantId, null);
      if (res.ok) toast.success('Storage limit removed.');
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={3}>Storage limit</Heading>
          <Text size="sm" variant="muted">
            An operator override for this tenant’s storage cap. Saved and shown now; not yet
            enforced at upload time — that enforcement is an upcoming step.
          </Text>
        </Stack>
        <div className="flex flex-wrap items-end gap-2">
          <Stack gap={1} className="max-w-[200px] flex-1">
            <Label htmlFor="storage-gb">Limit (GB)</Label>
            <Input
              id="storage-gb"
              type="number"
              min="0"
              step="0.1"
              value={gb}
              onChange={(e) => setGb(e.target.value)}
              placeholder="e.g. 50"
            />
          </Stack>
          <Button type="button" color="primary" onClick={save} disabled={pending} loading={pending}>
            Save limit
          </Button>
          {currentLimitBytes != null ? (
            <Button type="button" variant="soft" onClick={() => void clear()} disabled={pending}>
              Remove
            </Button>
          ) : null}
        </div>
      </Stack>
    </Card>
  );
}
