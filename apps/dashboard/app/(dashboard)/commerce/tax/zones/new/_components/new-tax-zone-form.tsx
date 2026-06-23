'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  WizardFrame,
  WizardStep,
  type WizardStepDef,
} from '@sparx/ui';

import { createTaxZoneAction } from '../../../../tax-actions';

// New tax-zone form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → WizardFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → WizardFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
// No bespoke card-footer toolbar, no repeated page title — that drift is what
// docs/86 standardizes away.
//
// A tax zone HAS a detail view (its rates), so create flows INTO it: the overlay
// swaps the token to the new record (preserving drawer vs modal); the page
// navigates to it.

const NEXUS = ['physical', 'economic', 'voluntary'] as const;

interface NewTaxZoneFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: WizardStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function NewTaxZoneForm({ surface }: NewTaxZoneFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [country, setCountry] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [nexusType, setNexusType] = React.useState<(typeof NEXUS)[number]>('physical');
  const [registrationNumber, setRegistrationNumber] = React.useState('');

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
      router.push('/commerce/tax');
    }
  }, [surface, pathname, searchParams, router]);

  // After create: in an overlay, transition the token to the new zone's detail
  // (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `tax-zone:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/tax/zones/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    const trimmedCountry = country.toUpperCase().trim();
    const trimmedRegion = region.toUpperCase().trim();
    const trimmedReg = registrationNumber.trim();

    startTransition(async () => {
      const result = await createTaxZoneAction({
        country: trimmedCountry,
        ...(trimmedRegion ? { region: trimmedRegion } : {}),
        nexusType,
        ...(trimmedReg ? { registrationNumber: trimmedReg } : {}),
        isActive: true,
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
        title="New tax zone"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <WizardStep
          header={{
            title: 'New tax zone',
            supporting:
              'A zone is a country (optionally a region) where you have nexus and collect tax.',
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
                <Stack direction="row" gap={3} wrap>
                  <Stack gap={1} className="w-24">
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      maxLength={2}
                      placeholder="US"
                    />
                  </Stack>
                  <Stack gap={1} className="w-32">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      maxLength={6}
                      placeholder="US-CA"
                    />
                  </Stack>
                  <Stack gap={1} className="min-w-[10rem] flex-1">
                    <Label htmlFor="nexusType">Nexus *</Label>
                    <NativeSelect
                      id="nexusType"
                      value={nexusType}
                      onChange={(e) => setNexusType(e.target.value as (typeof NEXUS)[number])}
                    >
                      {NEXUS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                </Stack>
                <Stack gap={1}>
                  <Label htmlFor="registrationNumber">Registration number</Label>
                  <Input
                    id="registrationNumber"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    maxLength={63}
                  />
                  <Text size="xs" variant="muted">
                    Sales-tax permit, VAT ID, or equivalent.
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
