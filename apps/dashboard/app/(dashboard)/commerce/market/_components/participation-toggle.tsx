'use client';

// The sparx.market participation toggle — enable/disable a tenant's whole
// marketplace presence (PUT /v1/market/profile with `enabled`). Disabling is
// DESTRUCTIVE: it tears down every listing + the directory row, so it goes
// behind useConfirm naming the loss (the platform destructive-action rule).
// Enabling re-projects every previously-listed product.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Stack, Switch, Text, useConfirm } from '@sparx/ui';

import { updateMarketProfileAction } from '../actions';
import type { MarketProfile } from '../_types';

export function ParticipationToggle({ profile }: { profile: MarketProfile }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function apply(enabled: boolean) {
    setError(null);
    startTransition(async () => {
      // The profile PUT replaces the whole record, so the public fields ride
      // along unchanged — only `enabled` flips.
      const res = await updateMarketProfileAction({
        enabled,
        bio: profile.bio,
        location: profile.location,
        headline: profile.headline,
        bannerMediaId: profile.bannerMediaId,
        defaultCategory: profile.defaultCategory,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  async function onToggle(next: boolean) {
    if (!next) {
      const ok = await confirm({
        title: 'Leave sparx.market?',
        description:
          'This removes all your products from sparx.market and hides your seller profile from the marketplace directory. Your listing choices are kept, so re-enabling restores them — but your products disappear from the marketplace immediately.',
        confirmLabel: 'Leave sparx.market',
        tone: 'danger',
      });
      if (!ok) return;
    }
    apply(next);
  }

  return (
    <Stack gap={2}>
      <Stack direction="row" align="center" gap={3} wrap>
        <Switch
          checked={profile.enabled}
          disabled={pending}
          onCheckedChange={(v) => void onToggle(v)}
          aria-label="Participate in sparx.market"
        />
        <Stack direction="row" align="center" gap={2}>
          <Text weight="medium">
            {profile.enabled ? 'Selling on sparx.market' : 'Not enrolled'}
          </Text>
          <Badge color={profile.enabled ? 'success' : 'neutral'} variant="soft" size="sm">
            {profile.enabled ? 'Live' : 'Off'}
          </Badge>
        </Stack>
      </Stack>
      {error && (
        <Text size="xs" variant="danger" role="alert">
          {error}
        </Text>
      )}
    </Stack>
  );
}
