'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Card, CardBody, Input, Label, NativeSelect } from 'silicaui-react';

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';

import { createTaxZoneAction } from '../../../../tax-actions';
import { useUnsavedGuard } from '../../../../../_components/unsaved-guard';

// New tax-zone form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
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

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

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

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty =
    country.trim() !== '' ||
    region.trim() !== '' ||
    nexusType !== 'physical' ||
    registrationNumber.trim() !== '';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'tax zone' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path (a created zone isn't a discard) and,
  // through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
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

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

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
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New tax zone"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
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
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-row flex-wrap gap-3">
                  <div className="flex w-24 flex-col gap-1">
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      maxLength={2}
                      placeholder="US"
                    />
                  </div>
                  <div className="flex w-32 flex-col gap-1">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      maxLength={6}
                      placeholder="US-CA"
                    />
                  </div>
                  <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
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
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="registrationNumber">Registration number</Label>
                  <Input
                    id="registrationNumber"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    maxLength={63}
                  />
                  <p className="text-base-content/70 text-xs">
                    Sales-tax permit, VAT ID, or equivalent.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
          {error && (
            <p className="text-danger mt-4 text-sm" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
