'use client';

// The sparx.market participation toggle — enable/disable a tenant's whole
// marketplace presence (PUT /v1/market/profile with `enabled`). Disabling is
// DESTRUCTIVE: it tears down every listing + the directory row, so it goes
// behind useConfirm naming the loss (the platform destructive-action rule).
// Enabling re-projects every previously-listed product.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Switch } from 'silicaui-react';
import { useConfirm } from '@sparx/ui';

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
    <div className="flex flex-col gap-2">
      <div className="flex flex-row flex-wrap items-center gap-3">
        <Switch
          checked={profile.enabled}
          disabled={pending}
          onCheckedChange={(v) => void onToggle(v)}
          aria-label="Participate in sparx.market"
        />
        <div className="flex flex-row items-center gap-2">
          <p className="text-base font-medium">
            {profile.enabled ? 'Selling on sparx.market' : 'Not enrolled'}
          </p>
          <Badge color={profile.enabled ? 'success' : 'neutral'} variant="soft" size="sm">
            {profile.enabled ? 'Live' : 'Off'}
          </Badge>
        </div>
      </div>
      {error && (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
