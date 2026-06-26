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
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  Textarea,
} from '@sparx/ui';

import { updateMarketProfileAction } from '../actions';
import type { MarketProfile } from '../_types';

const NO_DEFAULT = '__none__';

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
      <Stack gap={4}>
        <Stack gap={2}>
          <Label htmlFor="market-headline">Headline</Label>
          <Input
            id="market-headline"
            value={form.headline}
            maxLength={255}
            placeholder="One line that sums up your store"
            onChange={(e) => set('headline', e.target.value)}
          />
          <Text size="xs" variant="muted">
            Shown under your store name on your marketplace profile.
          </Text>
        </Stack>

        <Stack direction="row" gap={4} wrap>
          <Stack gap={2} className="min-w-[14rem] flex-1">
            <Label htmlFor="market-location">Location</Label>
            <Input
              id="market-location"
              value={form.location}
              maxLength={160}
              placeholder="City, State"
              onChange={(e) => set('location', e.target.value)}
            />
          </Stack>
          <Stack gap={2} className="min-w-[14rem] flex-1">
            <Label htmlFor="market-category">Default category</Label>
            <Select value={form.defaultCategory} onValueChange={(v) => set('defaultCategory', v)}>
              <SelectTrigger id="market-category">
                <SelectValue placeholder="No default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFAULT}>No default</SelectItem>
                {MARKET_CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Text size="xs" variant="muted">
              New listings default to this aisle.
            </Text>
          </Stack>
        </Stack>

        <Stack gap={2}>
          <Label htmlFor="market-bio">About your store</Label>
          <Textarea
            id="market-bio"
            rows={5}
            value={form.bio}
            maxLength={2000}
            placeholder="Tell shoppers who you are and what you sell."
            onChange={(e) => set('bio', e.target.value)}
          />
        </Stack>

        <Stack
          direction="row"
          align="center"
          justify="between"
          gap={3}
          className="rounded-md bg-[var(--color-bg-subtle)] px-4 py-3"
          wrap
        >
          <Stack gap={1}>
            <Text size="sm" weight="medium">
              Commission rate
            </Text>
            <Text size="xs" variant="muted">
              Deducted from each sale at settlement.
              {profile.hasCommissionOverride ? ' Custom rate negotiated for your store.' : ''}
            </Text>
          </Stack>
          <Text size="lg" weight="medium" className="tabular-nums">
            {formatBps(profile.commissionBps)}
          </Text>
        </Stack>

        <Stack direction="row" align="center" justify="end" gap={3} wrap>
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mr-auto">
              {error}
            </Text>
          )}
          {savedAt !== null && !dirty && (
            <Stack
              direction="row"
              align="center"
              gap={1}
              className="text-[var(--color-success-text)]"
            >
              <Check className="h-4 w-4" />
              <Text size="sm" variant="success">
                Saved
              </Text>
            </Stack>
          )}
          <Button type="submit" color="module" disabled={pending || !dirty} loading={pending}>
            Save profile
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
