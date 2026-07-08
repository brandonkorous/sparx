'use client';

// The seller's public sparx.market profile — bio, location, headline, default
// category, and banner image. Commission is shown read-only (platform-set; not
// editable here per the API contract). Explicit-save, dirty-gated (no autosave),
// mirroring the platform form standard. The participation toggle lives in its
// own component; this form keeps `enabled` at its current value on save.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { formatBps, MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import { Button, Input, Label, Select, Textarea } from 'silicaui-react';

import { updateMarketProfileAction } from '../actions';
import type { MarketProfile } from '../_types';

const NO_DEFAULT = '__none__';

// Value→label map that powers the default-category Select's trigger + options.
const CATEGORY_ITEMS: Record<string, string> = {
  [NO_DEFAULT]: 'No default',
  ...Object.fromEntries(MARKET_CATEGORIES.map((c) => [c.slug, c.name])),
};

interface FormState {
  headline: string;
  location: string;
  bio: string;
  defaultCategory: string;
}

export function ProfileForm({ profile }: { profile: MarketProfile }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const initial = React.useMemo<FormState>(
    () => ({
      headline: profile.headline ?? '',
      location: profile.location ?? '',
      bio: profile.bio ?? '',
      defaultCategory: profile.defaultCategory ?? NO_DEFAULT,
    }),
    [profile]
  );

  const [form, setForm] = React.useState<FormState>(initial);
  const [baseline, setBaseline] = React.useState<FormState>(initial);

  const dirty = (Object.keys(form) as (keyof FormState)[]).some((k) => form[k] !== baseline[k]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSavedAt(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const res = await updateMarketProfileAction({
        // Participation flag rides along unchanged — saving the profile must not
        // flip a seller in or out of the marketplace.
        enabled: profile.enabled,
        headline: form.headline.trim() || null,
        location: form.location.trim() || null,
        bio: form.bio.trim() || null,
        defaultCategory: form.defaultCategory === NO_DEFAULT ? null : form.defaultCategory,
        bannerMediaId: profile.bannerMediaId,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setBaseline(form);
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="market-headline">Headline</Label>
          <Input
            id="market-headline"
            value={form.headline}
            maxLength={255}
            placeholder="One line that sums up your store"
            onChange={(e) => set('headline', e.target.value)}
          />
          <p className="text-base-content/70 text-xs">
            Shown under your store name on your marketplace profile.
          </p>
        </div>

        <div className="flex flex-row flex-wrap gap-4">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <Label htmlFor="market-location">Location</Label>
            <Input
              id="market-location"
              value={form.location}
              maxLength={160}
              placeholder="City, State"
              onChange={(e) => set('location', e.target.value)}
            />
          </div>
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <Label htmlFor="market-category">Default category</Label>
            <Select
              id="market-category"
              value={form.defaultCategory}
              onValueChange={(v) => set('defaultCategory', v as string)}
              placeholder="No default"
              items={CATEGORY_ITEMS}
            />
            <p className="text-base-content/70 text-xs">New listings default to this aisle.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="market-bio">About your store</Label>
          <Textarea
            id="market-bio"
            rows={5}
            value={form.bio}
            maxLength={2000}
            placeholder="Tell shoppers who you are and what you sell."
            onChange={(e) => set('bio', e.target.value)}
          />
        </div>

        <div className="flex flex-row flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--color-bg-subtle)] px-4 py-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Commission rate</p>
            <p className="text-base-content/70 text-xs">
              Deducted from each sale at settlement.
              {profile.hasCommissionOverride ? ' Custom rate negotiated for your store.' : ''}
            </p>
          </div>
          <p className="text-lg font-medium tabular-nums">{formatBps(profile.commissionBps)}</p>
        </div>

        <div className="flex flex-row flex-wrap items-center justify-end gap-3">
          {error && (
            <p className="text-danger mr-auto text-sm" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          {savedAt !== null && !dirty && (
            <div className="flex flex-row items-center gap-1 text-[var(--color-success-text)]">
              <Check className="h-4 w-4" />
              <p className="text-success text-sm">Saved</p>
            </div>
          )}
          <Button type="submit" color="module" disabled={pending || !dirty} loading={pending}>
            Save profile
          </Button>
        </div>
      </div>
    </form>
  );
}
