'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';

import type { CreateShippingRateInput } from '@sparx/commerce-schemas';
import { rule, useFieldValidation } from '@sparx/forms';

import { createShippingRateAction } from '../../../../shipping-actions';

interface ProfileOption {
  id: string;
  name: string;
}

const TYPES: CreateShippingRateInput['type'][] = [
  'flat',
  'by_weight',
  'by_price',
  'by_item_count',
  'free_above_threshold',
];

// Money/qty rule: reject empty, non-numeric, and negative. `allowEmpty` relaxes the
// required check for optional numeric fields (ETA); `max` caps where a ceiling applies.
function numberRule(opts: { allowEmpty?: boolean; max?: number } = {}) {
  return (val: unknown): string | null => {
    const raw = String(val).trim();
    if (raw === '') return opts.allowEmpty ? null : 'Enter a number.';
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'Enter a number.';
    if (n < 0) return 'Cannot be negative.';
    if (opts.max != null && n > opts.max) return `Cannot exceed ${opts.max}.`;
    return null;
  };
}

export function NewRateForm({ zoneId, profiles }: { zoneId: string; profiles: ProfileOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [profileId, setProfileId] = React.useState(profiles[0]?.id ?? '');
  const [type, setType] = React.useState<CreateShippingRateInput['type']>('flat');
  const [amount, setAmount] = React.useState('');
  const [freeAbove, setFreeAbove] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');
  const [carrier, setCarrier] = React.useState('');
  const [etaDays, setEtaDays] = React.useState('');

  const values = { name, profileId, amount, freeAbove, etaDays };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    profileId: rule.required('Select a profile.'),
    amount: numberRule(),
    freeAbove: (val) => (type === 'free_above_threshold' ? numberRule()(val) : null),
    etaDays: numberRule({ allowEmpty: true, max: 60 }),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (profiles.length === 0) {
      setError('Create a shipping profile first.');
      return;
    }
    if (!v.validate()) return;

    const currencyValue = currency.trim().toUpperCase() || 'USD';
    const amountValue = Number(amount.trim());
    const freeAboveValue = Number(freeAbove.trim());
    const etaValue = etaDays.trim() === '' ? 0 : Number(etaDays.trim());
    const trimmedCarrier = carrier.trim();

    const input: CreateShippingRateInput = {
      zoneId,
      profileId,
      name: name.trim(),
      type,
      currency: currencyValue,
      ...(trimmedCarrier ? { carrier: trimmedCarrier } : {}),
      ...(etaValue > 0 ? { estimatedDeliveryDays: etaValue } : {}),
    };
    if (type === 'flat') {
      input.amountCents = Math.round(amountValue * 100);
    } else if (type === 'free_above_threshold') {
      input.amountCents = Math.round(amountValue * 100);
      input.freeAboveCents = Math.round(freeAboveValue * 100);
    } else {
      // by_weight | by_price | by_item_count → single starter band; the
      // detail page lets merchants add more later.
      input.bands = [{ min: 0, amountCents: Math.round(amountValue * 100) }];
    }

    startTransition(async () => {
      const result = await createShippingRateAction(input);
      if (!result.ok) {
        const known = (result.error.details ?? []).filter((d) => d.field in values);
        if (known.length) {
          v.setServerErrors(Object.fromEntries(known.map((d) => [d.field, d.message])));
        } else {
          setError(result.error.message);
        }
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-3">
        <div className="flex flex-row flex-wrap gap-3">
          <Field {...v.field('name')} className="min-w-[12rem]">
            <FieldLabel required>Name</FieldLabel>
            <FieldControl
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ground"
              {...v.control('name')}
            />
          </Field>
          <Field {...v.field('profileId')} className="min-w-[12rem]">
            <FieldLabel required>Profile</FieldLabel>
            <NativeSelect
              id="profileId"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              onBlur={() => v.touch('profileId')}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field className="min-w-[8rem]">
            <FieldLabel required>Type</FieldLabel>
            <NativeSelect
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as CreateShippingRateInput['type'])}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="flex flex-row flex-wrap gap-3">
          <Field {...v.field('amount')} className="min-w-[8rem]">
            <FieldLabel required>
              {type === 'flat' || type === 'free_above_threshold'
                ? 'Amount (dollars)'
                : 'First-band amount'}
            </FieldLabel>
            <FieldControl
              name="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              {...v.control('amount')}
            />
          </Field>
          {type === 'free_above_threshold' && (
            <Field {...v.field('freeAbove')} className="min-w-[8rem]">
              <FieldLabel required>Free above (dollars)</FieldLabel>
              <FieldControl
                name="freeAbove"
                type="number"
                step="0.01"
                min="0"
                value={freeAbove}
                onChange={(e) => setFreeAbove(e.target.value)}
                {...v.control('freeAbove')}
              />
            </Field>
          )}
          <Field className="w-24">
            <FieldLabel>Currency</FieldLabel>
            <FieldControl
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
            />
          </Field>
          <Field className="min-w-[8rem]">
            <FieldLabel>Carrier label</FieldLabel>
            <FieldControl
              name="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="USPS Priority"
            />
          </Field>
          <Field {...v.field('etaDays')} className="w-24">
            <FieldLabel>ETA (days)</FieldLabel>
            <FieldControl
              name="etaDays"
              type="number"
              min="0"
              max="60"
              value={etaDays}
              onChange={(e) => setEtaDays(e.target.value)}
              {...v.control('etaDays')}
            />
          </Field>
        </div>
        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}
        <div className="flex flex-row justify-end gap-2">
          <Button color="module" type="submit" disabled={pending}>
            {pending ? 'Adding…' : 'Add rate'}
          </Button>
        </div>
      </div>
    </form>
  );
}
