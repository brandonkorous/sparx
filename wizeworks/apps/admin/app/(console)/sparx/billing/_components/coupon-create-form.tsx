'use client';

import * as React from 'react';
import { Button, Stack, Text, toast } from '@wizeworks/ui';
import { Field, FieldControl, FieldLabel, NativeSelect } from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@wizeworks/forms';
import type { OperatorCouponInput } from '@wizeworks/operator';
import { createCouponAction } from '../actions';

// Create-a-platform-coupon form. Percent- or fixed-amount off, with a Stripe
// duration (once / forever / repeating-N-months). Posts to the billing:act server
// action; on success the coupons list revalidates.

type DiscountKind = 'percent' | 'amount';
type Duration = 'once' | 'forever' | 'repeating';

export function CouponCreateForm() {
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<DiscountKind>('percent');
  const [value, setValue] = React.useState('');
  const [duration, setDuration] = React.useState<Duration>('once');
  const [months, setMonths] = React.useState('3');
  const [pending, startTransition] = React.useTransition();

  const v = useFieldValidation(
    { name, value, kind },
    {
      name: rule.required('Give the coupon a name.'),
      // Cross-field: a percentage can’t exceed 100%, a fixed amount can.
      value: rules(
        rule.number({ gt: 0, message: 'Enter a discount greater than zero.' }),
        (val, all) =>
          all.kind === 'percent' && Number(val) > 100
            ? 'A percentage discount can’t exceed 100%.'
            : null
      ),
    }
  );

  function submit() {
    if (!v.validate()) return;
    const numeric = Number(value);

    const input: OperatorCouponInput = {
      name: name.trim(),
      duration,
      ...(duration === 'repeating' ? { durationInMonths: Math.max(1, Number(months) || 1) } : {}),
      ...(kind === 'percent'
        ? { percentOff: numeric }
        : { amountOffCents: Math.round(numeric * 100), currency: 'usd' }),
    };

    startTransition(async () => {
      const res = await createCouponAction(input);
      if (res.ok) {
        toast.success('Coupon created.');
        setName('');
        setValue('');
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Stack gap={4}>
      <Field {...v.field('name')}>
        <FieldLabel required>Name</FieldLabel>
        <FieldControl
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...v.control('name')}
          placeholder="e.g. Launch partner 20%"
          maxLength={200}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Discount type</FieldLabel>
          <FieldControl
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as DiscountKind)}
            render={
              <NativeSelect>
                <option value="percent">Percentage off</option>
                <option value="amount">Fixed amount off (USD)</option>
              </NativeSelect>
            }
          />
        </Field>
        <Field {...v.field('value')}>
          <FieldLabel required>{kind === 'percent' ? 'Percent off' : 'Amount off ($)'}</FieldLabel>
          <FieldControl
            name="value"
            type="number"
            inputMode="decimal"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            {...v.control('value')}
            placeholder={kind === 'percent' ? '20' : '50'}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Applies</FieldLabel>
          <FieldControl
            name="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value as Duration)}
            render={
              <NativeSelect>
                <option value="once">Once</option>
                <option value="repeating">For several months</option>
                <option value="forever">Forever</option>
              </NativeSelect>
            }
          />
        </Field>
        {duration === 'repeating' ? (
          <Field>
            <FieldLabel>Number of months</FieldLabel>
            <FieldControl
              name="months"
              type="number"
              min={1}
              max={60}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </Field>
        ) : null}
      </div>

      <div>
        <Button type="button" color="primary" onClick={submit} disabled={pending} loading={pending}>
          Create coupon
        </Button>
      </div>
      <Text size="xs" variant="muted">
        Coupons are created on the platform Stripe account and can be applied to a tenant’s sparx
        subscription. Creating one requires billing to be configured.
      </Text>
    </Stack>
  );
}
