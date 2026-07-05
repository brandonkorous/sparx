'use client';

import * as React from 'react';
import { Button, Input, Label, NativeSelect, Stack, Text, toast } from '@sparx/ui';
import type { OperatorCouponInput } from '@sparx/operator';
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

  function submit() {
    const trimmedName = name.trim();
    const numeric = Number(value);
    if (!trimmedName) {
      toast.error('Give the coupon a name.');
      return;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.error('Enter a discount greater than zero.');
      return;
    }
    if (kind === 'percent' && numeric > 100) {
      toast.error('A percentage discount can’t exceed 100%.');
      return;
    }

    const input: OperatorCouponInput = {
      name: trimmedName,
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
      <Stack gap={2}>
        <Label htmlFor="coupon-name">Name</Label>
        <Input
          id="coupon-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Launch partner 20%"
          maxLength={200}
        />
      </Stack>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stack gap={2}>
          <Label htmlFor="coupon-kind">Discount type</Label>
          <NativeSelect
            id="coupon-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as DiscountKind)}
          >
            <option value="percent">Percentage off</option>
            <option value="amount">Fixed amount off (USD)</option>
          </NativeSelect>
        </Stack>
        <Stack gap={2}>
          <Label htmlFor="coupon-value">
            {kind === 'percent' ? 'Percent off' : 'Amount off ($)'}
          </Label>
          <Input
            id="coupon-value"
            type="number"
            inputMode="decimal"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={kind === 'percent' ? '20' : '50'}
          />
        </Stack>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stack gap={2}>
          <Label htmlFor="coupon-duration">Applies</Label>
          <NativeSelect
            id="coupon-duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value as Duration)}
          >
            <option value="once">Once</option>
            <option value="repeating">For several months</option>
            <option value="forever">Forever</option>
          </NativeSelect>
        </Stack>
        {duration === 'repeating' ? (
          <Stack gap={2}>
            <Label htmlFor="coupon-months">Number of months</Label>
            <Input
              id="coupon-months"
              type="number"
              min={1}
              max={60}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
            />
          </Stack>
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
