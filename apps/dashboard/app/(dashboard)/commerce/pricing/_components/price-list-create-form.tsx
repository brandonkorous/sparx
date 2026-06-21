'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  WizardFrame,
  WizardStep,
  type WizardStepDef,
} from '@sparx/ui';

import { createPriceListAction } from '../../pricing-actions';

// New-price-list form, on the standard create surface (docs/86 F layout). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → WizardFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → WizardFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
// No bespoke card-footer toolbar, no repeated page title — that drift is what
// docs/86 standardizes away.
//
// Price lists DO have a detail view, so create flows into it: on success the
// overlay swaps its token to the new record's detail (preserving drawer vs
// modal); the page navigates to the record. Targeting and per-variant entries
// are managed from that detail page.

const CHANNELS = ['storefront', 'b2b_portal', 'admin', 'subscription'] as const;

interface PriceListCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: WizardStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function PriceListCreateForm({ surface }: PriceListCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');
  const [channel, setChannel] = React.useState('');
  const [priority, setPriority] = React.useState('0');

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list.
  const cancel = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/pricing');
    }
  }, [surface, pathname, searchParams, router]);

  // After create: in an overlay, transition the token to the new record's
  // detail (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `price-list:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/pricing/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      currency: (currency.trim() || 'USD').toUpperCase(),
      channel: channel === '' ? undefined : channel,
      priority: Number(priority.trim() || '0') || 0,
    };
    startTransition(async () => {
      const result = await createPriceListAction(input);
      if (!result.ok) {
        setError(result.error.message);
        const map: Record<string, string> = {};
        for (const d of result.error.details ?? []) map[d.field] = d.message;
        setFieldErrors(map);
        return;
      }
      onCreated(result.data.id);
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <WizardFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New price list"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <WizardStep
          header={{
            title: 'Price list basics',
            supporting:
              'Targeting (segment, B2B account) can be set after the list exists. Per-variant entries are managed from the detail page.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create price list',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack gap={2}>
                  <Label htmlFor="pl-name">Name</Label>
                  <Input
                    id="pl-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Fleet wholesale"
                  />
                  {fieldErrors.name && (
                    <Text size="xs" variant="danger">
                      {fieldErrors.name}
                    </Text>
                  )}
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="pl-description">Description</Label>
                  <Textarea
                    id="pl-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </Stack>
                <Stack direction="row" gap={3} wrap>
                  <Stack gap={2} className="w-[8rem]">
                    <Label htmlFor="pl-currency">Currency</Label>
                    <Input
                      id="pl-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      maxLength={3}
                    />
                    {fieldErrors.currency && (
                      <Text size="xs" variant="danger">
                        {fieldErrors.currency}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={2} className="min-w-[12rem] flex-1">
                    <Label htmlFor="pl-channel">Channel</Label>
                    <NativeSelect
                      id="pl-channel"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    >
                      <option value="">all channels</option>
                      {CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                  <Stack gap={2} className="w-[8rem]">
                    <Label htmlFor="pl-priority">Priority</Label>
                    <Input
                      id="pl-priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                  </Stack>
                </Stack>
                <CardDescription>
                  Status starts as <strong>draft</strong> — flip it to active from the list page
                  once you&apos;ve added entries.
                </CardDescription>
              </Stack>
            </CardContent>
          </Card>
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
        </WizardStep>
      </WizardFrame>
    </ModuleProvider>
  );
}
