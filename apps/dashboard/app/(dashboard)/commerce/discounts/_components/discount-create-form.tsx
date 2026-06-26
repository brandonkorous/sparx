'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createDiscountAction } from '../../discount-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// New-discount form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in module-tinted Cards.
// No bespoke card-footer toolbar, no repeated page title — that drift is what
// docs/86 standardizes away.
//
// Discounts have no standalone detail view yet (BOGO/bundle types + conditions
// land later), so on success we close the overlay (or return to the list) and
// refresh.

const TYPES = ['percent', 'fixed', 'free_shipping'] as const;
const STACKING = [
  'none',
  'combine_with_subscribe_and_save',
  'combine_with_loyalty',
  'combine_with_all',
] as const;

const STEPS: SurfaceStepDef[] = [{ key: 'discount', label: 'Discount' }];

export function DiscountCreateForm({ surface }: { surface: 'page' | 'overlay' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isAutomatic, setIsAutomatic] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [type, setType] = React.useState<(typeof TYPES)[number]>('percent');
  const [valuePercent, setValuePercent] = React.useState('10');
  const [valueDollars, setValueDollars] = React.useState('10');
  const [currency, setCurrency] = React.useState('USD');
  const [perCustomerLimit, setPerCustomerLimit] = React.useState('1');
  const [totalUsageLimit, setTotalUsageLimit] = React.useState('');
  const [priority, setPriority] = React.useState('0');
  const [stacking, setStacking] = React.useState<(typeof STACKING)[number]>('none');

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty =
    name.trim() !== '' ||
    description.trim() !== '' ||
    code.trim() !== '' ||
    isAutomatic ||
    type !== 'percent' ||
    valuePercent !== '10' ||
    valueDollars !== '10' ||
    currency !== 'USD' ||
    perCustomerLimit !== '1' ||
    totalUsageLimit !== '' ||
    priority !== '0' ||
    stacking !== 'none';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'discount' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path (a created discount isn't a discard) and,
  // through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/discounts');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: discounts have no detail view, so close the overlay (or leave
  // the /new page) and refresh — the list picks up the new discount. Routes
  // through the unguarded `close` (a successful create is not a discard).
  function afterCreate() {
    if (surface === 'overlay') {
      close();
      router.refresh();
    } else {
      router.push('/commerce/discounts');
    }
  }

  function submit() {
    setError(null);

    if (!name.trim()) {
      setError('Internal name is required');
      return;
    }
    if (!isAutomatic && !code.trim()) {
      setError('Code is required for a non-automatic discount');
      return;
    }

    const input: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      code: isAutomatic ? null : code.trim().toUpperCase(),
      stacking,
      priority: Number(priority) || 0,
      perCustomerLimit: Number(perCustomerLimit) || 1,
    };

    if (type === 'percent') {
      const percent = Number(valuePercent);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        setError('Percent must be between 1 and 100');
        return;
      }
      input.valuePercent = percent;
    } else if (type === 'fixed') {
      const dollars = Number(valueDollars);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setError('Amount must be positive');
        return;
      }
      input.valueCents = Math.round(dollars * 100);
      input.currency = currency.trim().toUpperCase() || 'USD';
    }

    if (totalUsageLimit.trim()) {
      const limit = Number(totalUsageLimit);
      if (Number.isFinite(limit) && limit > 0) input.totalUsageLimit = limit;
    }

    startTransition(async () => {
      const result = await createDiscountAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      afterCreate();
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New discount"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'New discount',
            supporting: 'BOGO and bundle types land later. Conditions can be added after creation.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create discount',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Stack gap={6}>
            <Card variant="module">
              <CardContent className="py-6">
                <Stack gap={4}>
                  <Stack gap={1}>
                    <Label htmlFor="disc-name">
                      Internal name<span className="text-[var(--color-danger)]">*</span>
                    </Label>
                    <Input
                      id="disc-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Welcome 10% off"
                    />
                    <Text size="xs" variant="muted">
                      Shown in reports; never to customers.
                    </Text>
                  </Stack>
                  <Stack gap={1}>
                    <Label htmlFor="disc-description">Description</Label>
                    <Textarea
                      id="disc-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                    />
                  </Stack>
                  <Stack direction="row" align="center" gap={2}>
                    <Checkbox
                      color="module"
                      id="disc-automatic"
                      checked={isAutomatic}
                      onCheckedChange={(v) => setIsAutomatic(v === true)}
                    />
                    <Label htmlFor="disc-automatic">Automatic — apply without a code</Label>
                  </Stack>
                  {!isAutomatic && (
                    <Stack gap={1}>
                      <Label htmlFor="disc-code">
                        Code<span className="text-[var(--color-danger)]">*</span>
                      </Label>
                      <Input
                        id="disc-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="WELCOME10"
                      />
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="module">
              <CardContent className="py-6">
                <Stack gap={4}>
                  <Stack gap={1} className="max-w-[16rem]">
                    <Label htmlFor="disc-type">Type</Label>
                    <NativeSelect
                      id="disc-type"
                      value={type}
                      onChange={(e) => setType(e.target.value as typeof type)}
                    >
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                  {type === 'percent' && (
                    <Stack gap={1} className="w-[8rem]">
                      <Label htmlFor="disc-percent">% off</Label>
                      <Input
                        id="disc-percent"
                        value={valuePercent}
                        onChange={(e) => setValuePercent(e.target.value)}
                      />
                    </Stack>
                  )}
                  {type === 'fixed' && (
                    <Stack direction="row" gap={3} wrap>
                      <Stack gap={1} className="w-[8rem]">
                        <Label htmlFor="disc-amount">Amount ($)</Label>
                        <Input
                          id="disc-amount"
                          value={valueDollars}
                          onChange={(e) => setValueDollars(e.target.value)}
                        />
                      </Stack>
                      <Stack gap={1} className="w-[6rem]">
                        <Label htmlFor="disc-currency">Currency</Label>
                        <Input
                          id="disc-currency"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          maxLength={3}
                        />
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="module">
              <CardContent className="py-6">
                <Stack gap={4}>
                  <Text size="xs" variant="muted">
                    Per-customer limit defaults to 1 — set higher to allow repeat redemptions per
                    shopper. Total cap limits redemptions across all customers.
                  </Text>
                  <Stack direction="row" gap={3} wrap>
                    <Stack gap={1} className="w-[8rem]">
                      <Label htmlFor="disc-per-customer">Per customer</Label>
                      <Input
                        id="disc-per-customer"
                        value={perCustomerLimit}
                        onChange={(e) => setPerCustomerLimit(e.target.value)}
                      />
                    </Stack>
                    <Stack gap={1} className="w-[8rem]">
                      <Label htmlFor="disc-total-cap">Total cap</Label>
                      <Input
                        id="disc-total-cap"
                        value={totalUsageLimit}
                        onChange={(e) => setTotalUsageLimit(e.target.value)}
                        placeholder="unlimited"
                      />
                    </Stack>
                    <Stack gap={1} className="w-[8rem]">
                      <Label htmlFor="disc-priority">Priority</Label>
                      <Input
                        id="disc-priority"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      />
                    </Stack>
                    <Stack gap={1} className="min-w-[16rem]">
                      <Label htmlFor="disc-stacking">Stacking</Label>
                      <NativeSelect
                        id="disc-stacking"
                        value={stacking}
                        onChange={(e) => setStacking(e.target.value as typeof stacking)}
                      >
                        {STACKING.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </NativeSelect>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
