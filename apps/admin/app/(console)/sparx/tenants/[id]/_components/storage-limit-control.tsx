'use client';

// Operator storage-limit override editor (build-plan §5 Slice 8), gated
// `tenant:suspend`. STORED + DISPLAYED only for now — the cap is not yet enforced
// at the upload path (a scoped follow-up: docs/apps/admin/
// slice-8-enforcement-followups.md). The current value is shown on the read-only
// StorageCard; this control just edits it. Operators think in GB, so the input is
// GB and converts to bytes on save.

import * as React from 'react';
import { Button, Card, Heading, Stack, Text, toast, useConfirm } from '@sparx/ui';
import { Field, FieldControl, FieldLabel } from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
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

  const v = useFieldValidation(
    { gb },
    { gb: rule.number({ gt: 0, message: 'Enter a limit in GB greater than zero.' }) }
  );

  // Reconcile to server truth after a save/clear revalidates the page.
  React.useEffect(() => {
    setGb(toGbInput(currentLimitBytes));
  }, [currentLimitBytes]);

  function save() {
    if (!v.validate()) return;
    const limitBytes = Math.round(Number.parseFloat(gb) * BYTES_PER_GB);
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
      color: 'warning',
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
          <Field {...v.field('gb')} className="max-w-[200px] flex-1">
            <FieldLabel>Limit (GB)</FieldLabel>
            <FieldControl
              name="storage-gb"
              type="number"
              min="0"
              step="0.1"
              value={gb}
              onChange={(e) => setGb(e.target.value)}
              {...v.control('gb')}
              placeholder="e.g. 50"
            />
          </Field>
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
