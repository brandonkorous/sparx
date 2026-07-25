'use client';

import * as React from 'react';
import { Button, Stack, Text, toast } from '@sparx/ui';
import { Field, FieldControl, FieldLabel, NativeSelect } from '@wizeworks/silicaui-react';
import { rule, rules, useFieldValidation } from '@sparx/forms';
import type { OperatorPromotionCodeInput } from '@sparx/operator';
import { createPromotionCodeAction } from '../actions';
import { TenantPicker, type TenantChoice } from './tenant-picker';

// Create a promotion code — the string a tenant types in the Checkout discount box,
// layered on an existing coupon. Public (any tenant) or locked to one tenant chosen
// with the typeahead picker. Posts to the billing:act server action; on success the
// codes list revalidates.

type Scope = 'public' | 'tenant';

export function PromotionCodeCreateForm({
  coupons,
}: {
  coupons: { id: string; name: string | null }[];
}) {
  const [couponId, setCouponId] = React.useState(coupons[0]?.id ?? '');
  const [code, setCode] = React.useState('');
  const [scope, setScope] = React.useState<Scope>('public');
  const [tenant, setTenant] = React.useState<TenantChoice | null>(null);
  const [tenantError, setTenantError] = React.useState<string | null>(null);
  const [maxRedemptions, setMaxRedemptions] = React.useState('');
  const [expiresOn, setExpiresOn] = React.useState('');
  const [firstTimeOnly, setFirstTimeOnly] = React.useState<'no' | 'yes'>('no');
  const [pending, startTransition] = React.useTransition();

  const v = useFieldValidation(
    { couponId, code },
    {
      couponId: rule.required('Pick a coupon this code applies to.'),
      code: rules((val) =>
        val && !/^[A-Za-z0-9]+$/.test(String(val))
          ? 'Use letters and numbers only (no spaces or symbols).'
          : null
      ),
    }
  );

  function submit() {
    const fieldsOk = v.validate();
    const needsTenant = scope === 'tenant' && !tenant;
    setTenantError(needsTenant ? 'Pick a tenant, or make the code public.' : null);
    if (!fieldsOk || needsTenant) return;

    const input: OperatorPromotionCodeInput = {
      couponId,
      ...(code.trim() ? { code: code.trim() } : {}),
      ...(scope === 'tenant' && tenant ? { tenantId: tenant.id } : {}),
      ...(maxRedemptions ? { maxRedemptions: Math.max(1, Number(maxRedemptions) || 0) } : {}),
      ...(expiresOn ? { expiresAt: `${expiresOn}T23:59:59.000Z` } : {}),
      ...(firstTimeOnly === 'yes' ? { firstTimeOnly: true } : {}),
    };

    startTransition(async () => {
      const res = await createPromotionCodeAction(input);
      if (res.ok) {
        toast.success('Promotion code created.');
        setCode('');
        setTenant(null);
        setScope('public');
        setMaxRedemptions('');
        setExpiresOn('');
        setFirstTimeOnly('no');
      } else {
        toast.error(res.error);
      }
    });
  }

  if (coupons.length === 0) {
    return (
      <Text size="sm" variant="muted">
        Create a coupon first — a promotion code is the typeable string layered on top of one.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field {...v.field('couponId')}>
          <FieldLabel required>Coupon</FieldLabel>
          <FieldControl
            name="couponId"
            value={couponId}
            onChange={(e) => setCouponId(e.target.value)}
            {...v.control('couponId')}
            render={
              <NativeSelect>
                {coupons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.id}
                  </option>
                ))}
              </NativeSelect>
            }
          />
        </Field>
        <Field {...v.field('code')}>
          <FieldLabel>Code</FieldLabel>
          <FieldControl
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            {...v.control('code')}
            placeholder="LAUNCH50 (leave blank to auto-generate)"
            maxLength={40}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Who can use it</FieldLabel>
          <FieldControl
            name="scope"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as Scope);
              setTenantError(null);
              if (e.target.value === 'public') setTenant(null);
            }}
            render={
              <NativeSelect>
                <option value="public">Any tenant (public)</option>
                <option value="tenant">One specific tenant</option>
              </NativeSelect>
            }
          />
        </Field>
        {scope === 'tenant' ? (
          <div>
            <TenantPicker
              value={tenant}
              onChange={(choice) => {
                setTenant(choice);
                if (choice) setTenantError(null);
              }}
            />
            {tenantError ? (
              <Text size="xs" className="text-danger mt-1">
                {tenantError}
              </Text>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel>Max redemptions</FieldLabel>
          <FieldControl
            name="maxRedemptions"
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Unlimited"
          />
        </Field>
        <Field>
          <FieldLabel>Expires</FieldLabel>
          <FieldControl
            name="expiresOn"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>New tenants only</FieldLabel>
          <FieldControl
            name="firstTimeOnly"
            value={firstTimeOnly}
            onChange={(e) => setFirstTimeOnly(e.target.value as 'no' | 'yes')}
            render={
              <NativeSelect>
                <option value="no">Any tenant</option>
                <option value="yes">First-time only</option>
              </NativeSelect>
            }
          />
        </Field>
      </div>

      <div>
        <Button type="button" color="primary" onClick={submit} disabled={pending} loading={pending}>
          Create code
        </Button>
      </div>
      <Text size="xs" variant="muted">
        The code is what a tenant types on the Stripe payment page when they set up billing. It only
        applies where the coupon does; restrictions are enforced by Stripe at redemption.
      </Text>
    </Stack>
  );
}
