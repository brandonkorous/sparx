'use client';

import * as React from 'react';
import { queryKeys, useQuery } from '@sparx/query';
import { toast } from '@sparx/ui';

// Polls the deployed release and, when it diverges from the version THIS tab was
// built with, raises a sticky "refresh" toast with a Refresh action.
//
// First adopter of @sparx/query — and a textbook fit for the boundary rule:
// client-owned data that changes after load (poll + refetch-on-focus), which is
// exactly what TanStack Query is reserved for. See docs/95-client-data-fetching.md.

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
const POLL_INTERVAL_MS = 60_000;
const TOAST_ID = 'sparx-update-available';

interface VersionResponse {
  version: string;
}

async function fetchDeployedVersion(): Promise<string> {
  const res = await fetch('/api/version', { cache: 'no-store' });
  if (!res.ok) throw new Error(`version check failed: ${res.status}`);
  const body = (await res.json()) as VersionResponse;
  return body.version;
}

export function UpdateNotifier(): null {
  // In local dev both sides read 'dev', so there's nothing to detect — don't
  // poll at all. The check only does real work against a built image.
  const enabled = CURRENT_VERSION !== 'dev';

  const { data: deployedVersion } = useQuery({
    queryKey: queryKeys.appVersion(),
    queryFn: fetchDeployedVersion,
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0, // always reflect the live deployed value, never a cached one
    gcTime: 0,
    retry: 1,
  });

  const updateAvailable = Boolean(deployedVersion) && deployedVersion !== CURRENT_VERSION;

  React.useEffect(() => {
    if (!updateAvailable) return;
    // `id` dedupes: the same sticky toast is reused no matter how many polls
    // observe the new version. Never auto-reload — the builder and forms hold
    // unsaved state, so the refresh stays user-initiated.
    toast('A new version of sparx is available', {
      id: TOAST_ID,
      description: 'Refresh to load the latest updates.',
      duration: Number.POSITIVE_INFINITY,
      action: {
        label: 'Refresh',
        onClick: () => window.location.reload(),
      },
    });
  }, [updateAvailable]);

  return null;
}
