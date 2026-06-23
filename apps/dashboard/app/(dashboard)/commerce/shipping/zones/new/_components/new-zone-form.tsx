'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  Input,
  Label,
  ModuleProvider,
  Stack,
  Text,
  Textarea,
  WizardFrame,
  WizardStep,
  type WizardStepDef,
} from '@sparx/ui';

import { createShippingZoneAction } from '../../../../shipping-actions';

// New shipping-zone form, on the standard create surface (docs/86 F layout). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → WizardFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → WizardFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Zones have a detail view, so create flows INTO it: the overlay swaps the token
// to the new record (preserving drawer vs modal); the page navigates to it.

interface NewZoneFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: WizardStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function NewZoneForm({ surface }: NewZoneFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [priority, setPriority] = React.useState('0');
  const [countriesRaw, setCountriesRaw] = React.useState('');
  const [regionsRaw, setRegionsRaw] = React.useState('');

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
      router.push('/commerce/shipping');
    }
  }, [surface, pathname, searchParams, router]);

  // After create: in an overlay, transition the token to the new record's detail
  // (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `shipping-zone:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/shipping/zones/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    const priorityValue = Number(priority);
    const countries = countriesRaw
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const regions = regionsRaw
      .split(/[,\s]+/)
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createShippingZoneAction({
        name: name.trim(),
        priority: Number.isFinite(priorityValue) ? priorityValue : 0,
        targeting: { countries, regions, postalCodeRanges: [] },
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onCreated(result.data.id);
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <WizardFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New shipping zone"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <WizardStep
          header={{
            title: 'New shipping zone',
            supporting:
              'Zones are evaluated highest-priority first. A zone with no countries matches any address (low-priority catch-all).',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create zone',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack gap={1}>
                  <Label htmlFor="zone-name">Name *</Label>
                  <Input
                    id="zone-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Domestic US"
                  />
                </Stack>
                <Stack gap={1}>
                  <Label htmlFor="zone-priority">Priority</Label>
                  <Input
                    id="zone-priority"
                    type="number"
                    min={0}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  />
                  <Text size="xs" variant="muted">
                    Higher numbers evaluate first. Use catch-all zones at priority 0.
                  </Text>
                </Stack>
                <Stack gap={1}>
                  <Label htmlFor="zone-countries">Countries</Label>
                  <Textarea
                    id="zone-countries"
                    rows={2}
                    value={countriesRaw}
                    onChange={(e) => setCountriesRaw(e.target.value)}
                    placeholder="US, CA"
                    className="font-mono text-xs"
                  />
                  <Text size="xs" variant="muted">
                    ISO 3166-1 alpha-2 codes. Leave empty to match any country.
                  </Text>
                </Stack>
                <Stack gap={1}>
                  <Label htmlFor="zone-regions">Regions (optional)</Label>
                  <Textarea
                    id="zone-regions"
                    rows={2}
                    value={regionsRaw}
                    onChange={(e) => setRegionsRaw(e.target.value)}
                    placeholder="US-CA, US-OR"
                    className="font-mono text-xs"
                  />
                  <Text size="xs" variant="muted">
                    ISO 3166-2 subdivision codes for narrower targeting.
                  </Text>
                </Stack>
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
