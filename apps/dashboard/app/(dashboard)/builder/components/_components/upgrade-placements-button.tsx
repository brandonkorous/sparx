'use client';

// Bulk "update all placements" (docs/53 §6 / P-E) — re-pins every page/layout
// placement of this component to its latest version in one action, behind a
// confirm. Complements the per-placement "Update to vN" in the builder inspector.
// Disabled when every placement is already on the latest (nothing to move); the
// result note says how many surfaces changed.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpCircle } from 'lucide-react';
import { Button, Stack, Text, useConfirm } from '@sparx/ui';

import { upgradeAllPlacements } from '../_lib/component-actions';

export function UpgradePlacementsButton({
  componentKey,
  latestVersion,
  outdated,
}: {
  componentKey: string;
  latestVersion: number;
  /** True when at least one placement is pinned below the latest version. */
  outdated: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const onClick = async () => {
    const ok = await confirm({
      title: `Update all placements to v${latestVersion}?`,
      description:
        'Every page and layout that uses this component re-pins to the latest version. The change goes live on each surface’s next publish.',
      confirmLabel: 'Update all',
    });
    if (!ok) return;
    setBusy(true);
    const res = await upgradeAllPlacements(componentKey, latestVersion);
    setBusy(false);
    if (res.ok && res.data) {
      setNote(
        res.data.total === 0
          ? `Already on v${latestVersion} everywhere.`
          : `Updated ${res.data.total} place${res.data.total === 1 ? '' : 's'} to v${latestVersion}.`
      );
      router.refresh();
    } else {
      setNote(res.error ?? 'Update failed.');
    }
  };

  return (
    <Stack gap={2} align="start">
      <Button
        size="sm"
        variant="soft"
        leftIcon={<ArrowUpCircle className="h-3.5 w-3.5" />}
        disabled={busy || !outdated}
        title={
          outdated
            ? 'Re-pin every placement to the latest version'
            : 'All placements are already on the latest version'
        }
        onClick={() => void onClick()}
      >
        Update all placements to v{latestVersion}
      </Button>
      {note ? (
        <Text size="xs" variant="muted">
          {note}
        </Text>
      ) : null}
    </Stack>
  );
}
