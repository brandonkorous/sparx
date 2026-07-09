'use client';

// Reusable address form for marketplace checkout. Controlled — emits the full
// Address on every change. Mirrors apps/site's address form, using silicaui
// Input + NativeSelect.

import { Input, NativeSelect } from '@wizeworks/silicaui-react';

import { Field, FieldGrid } from '@/components/checkout/ui';
import type { Address } from '@/lib/checkout-client';

export const EMPTY_ADDRESS: Address = {
  name: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: 'US',
  phone: '',
};

const COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
];

export function AddressForm({
  value,
  onChange,
}: {
  value: Address;
  onChange: (next: Address) => void;
}) {
  function set<K extends keyof Address>(key: K, v: Address[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <FieldGrid>
      <Field label="Full name" full>
        <Input
          required
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Address" full>
        <Input
          required
          value={value.line1}
          onChange={(e) => set('line1', e.target.value)}
          autoComplete="address-line1"
        />
      </Field>
      <Field label="Apartment, suite, etc. (optional)" full>
        <Input
          value={value.line2 ?? ''}
          onChange={(e) => set('line2', e.target.value)}
          autoComplete="address-line2"
        />
      </Field>
      <Field label="City">
        <Input
          required
          value={value.city}
          onChange={(e) => set('city', e.target.value)}
          autoComplete="address-level2"
        />
      </Field>
      <Field label="State / Region">
        <Input
          value={value.region ?? ''}
          onChange={(e) => set('region', e.target.value)}
          autoComplete="address-level1"
        />
      </Field>
      <Field label="Postal code">
        <Input
          required
          value={value.postalCode}
          onChange={(e) => set('postalCode', e.target.value)}
          autoComplete="postal-code"
        />
      </Field>
      <Field label="Country">
        <NativeSelect
          value={value.country}
          onChange={(e) => set('country', e.target.value)}
          autoComplete="country"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Phone (optional)" full>
        <Input
          type="tel"
          value={value.phone ?? ''}
          onChange={(e) => set('phone', e.target.value)}
          autoComplete="tel"
        />
      </Field>
    </FieldGrid>
  );
}
