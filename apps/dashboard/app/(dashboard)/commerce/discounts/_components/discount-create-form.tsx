'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import {
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Label,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { createDiscountAction } from '../../discount-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { useDetailFooterNode } from '../../../_components/detail-header-slot';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../_components/detail-panel';

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
  // The overlay host (drawer/modal) already renders a footer-slot row for
  // Cancel/Save; handing it to SurfaceFrame merges the frame's own toolbar
  // into THAT row instead of stacking a second one underneath it — null
  // until the host mounts.
  const overlayActionsTarget = useDetailFooterNode();
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

  // Field validation. `code` is required only for a non-automatic discount;
  // `valuePercent` / `valueDollars` only matter for their respective type.
  const values = { name, code, valuePercent, valueDollars, isAutomatic, type };
  const v = useFieldValidation(values, {
    name: rule.required('Internal name is required.'),
    code: (val, all) =>
      !all.isAutomatic && String(val).trim().length === 0
        ? 'Code is required for a non-automatic discount.'
        : null,
    valuePercent: (val, all) => {
      if (all.type !== 'percent') return null;
      const n = Number(String(val).trim());
      return Number.isFinite(n) && n > 0 && n <= 100 ? null : 'Percent must be between 1 and 100.';
    },
    valueDollars: (val, all) => {
      if (all.type !== 'fixed') return null;
      const n = Number(String(val).trim());
      return Number.isFinite(n) && n > 0 ? null : 'Amount must be greater than 0.';
    },
  });

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
    if (!v.validate()) return;

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
      input.valuePercent = Number(valuePercent);
    } else if (type === 'fixed') {
      input.valueCents = Math.round(Number(valueDollars) * 100);
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
        backLabel="Discounts"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="discount" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        actionsTarget={surface === 'overlay' ? overlayActionsTarget : undefined}
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
          <div className="flex flex-col gap-6">
            <Card>
              <CardBody className="py-6">
                <div className="flex flex-col gap-4">
                  <Field {...v.field('name')}>
                    <FieldLabel required>Internal name</FieldLabel>
                    <FieldControl
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Welcome 10% off"
                      {...v.control('name')}
                    />
                    <FieldDescription>Shown in reports; never to customers.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Description</FieldLabel>
                    <FieldControl
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      render={<Textarea rows={2} />}
                    />
                  </Field>
                  <div className="flex flex-row items-center gap-2">
                    <Checkbox
                      color="module"
                      id="disc-automatic"
                      checked={isAutomatic}
                      onChange={(e) => setIsAutomatic(e.target.checked)}
                    />
                    <Label htmlFor="disc-automatic">Automatic — apply without a code</Label>
                  </div>
                  {!isAutomatic && (
                    <Field {...v.field('code')}>
                      <FieldLabel required>Code</FieldLabel>
                      <FieldControl
                        name="code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="WELCOME10"
                        {...v.control('code')}
                      />
                    </Field>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="py-6">
                <div className="flex flex-col gap-4">
                  <Field className="max-w-[16rem]">
                    <FieldLabel>Type</FieldLabel>
                    <FieldControl
                      name="type"
                      value={type}
                      onChange={(e) => setType(e.target.value as typeof type)}
                      render={
                        <NativeSelect>
                          {TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </NativeSelect>
                      }
                    />
                  </Field>
                  {type === 'percent' && (
                    <Field {...v.field('valuePercent')} className="w-[8rem]">
                      <FieldLabel>% off</FieldLabel>
                      <FieldControl
                        name="valuePercent"
                        type="number"
                        min="0"
                        step="1"
                        value={valuePercent}
                        onChange={(e) => setValuePercent(e.target.value)}
                        {...v.control('valuePercent')}
                      />
                    </Field>
                  )}
                  {type === 'fixed' && (
                    <div className="flex flex-row flex-wrap gap-3">
                      <Field {...v.field('valueDollars')} className="w-[8rem]">
                        <FieldLabel>Amount ($)</FieldLabel>
                        <FieldControl
                          name="valueDollars"
                          type="number"
                          min="0"
                          step="0.01"
                          value={valueDollars}
                          onChange={(e) => setValueDollars(e.target.value)}
                          {...v.control('valueDollars')}
                        />
                      </Field>
                      <Field className="w-[6rem]">
                        <FieldLabel>Currency</FieldLabel>
                        <FieldControl
                          name="currency"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          maxLength={3}
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="py-6">
                <div className="flex flex-col gap-4">
                  <p className="text-base-content text-xs">
                    Per-customer limit defaults to 1 — set higher to allow repeat redemptions per
                    shopper. Total cap limits redemptions across all customers.
                  </p>
                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="w-[8rem]">
                      <FieldLabel>Per customer</FieldLabel>
                      <FieldControl
                        name="perCustomerLimit"
                        type="number"
                        min="1"
                        step="1"
                        value={perCustomerLimit}
                        onChange={(e) => setPerCustomerLimit(e.target.value)}
                      />
                    </Field>
                    <Field className="w-[8rem]">
                      <FieldLabel>Total cap</FieldLabel>
                      <FieldControl
                        name="totalUsageLimit"
                        type="number"
                        min="0"
                        step="1"
                        value={totalUsageLimit}
                        onChange={(e) => setTotalUsageLimit(e.target.value)}
                        placeholder="unlimited"
                      />
                    </Field>
                    <Field className="w-[8rem]">
                      <FieldLabel>Priority</FieldLabel>
                      <FieldControl
                        name="priority"
                        type="number"
                        step="1"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      />
                    </Field>
                    <Field className="min-w-[16rem]">
                      <FieldLabel>Stacking</FieldLabel>
                      <FieldControl
                        name="stacking"
                        value={stacking}
                        onChange={(e) => setStacking(e.target.value as typeof stacking)}
                        render={
                          <NativeSelect>
                            {STACKING.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </NativeSelect>
                        }
                      />
                    </Field>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-4"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
