'use client';

// Reusable address form. Controlled — emits the full Address on every change.

import { Input, NativeSelect } from '@wizeworks/silicaui-react';

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

// A small, common subset; extend as international support grows.
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
    <div className="st-addr">
      <label className="st-field st-field--full">
        <span>Full name</span>
        <Input
          required
          value={value.name}
          onChange={(e) => set('name', e.target.value)}
          autoComplete="name"
        />
      </label>
      <label className="st-field st-field--full">
        <span>Address</span>
        <Input
          required
          value={value.line1}
          onChange={(e) => set('line1', e.target.value)}
          autoComplete="address-line1"
        />
      </label>
      <label className="st-field st-field--full">
        <span>Apartment, suite, etc. (optional)</span>
        <Input
          value={value.line2 ?? ''}
          onChange={(e) => set('line2', e.target.value)}
          autoComplete="address-line2"
        />
      </label>
      <label className="st-field">
        <span>City</span>
        <Input
          required
          value={value.city}
          onChange={(e) => set('city', e.target.value)}
          autoComplete="address-level2"
        />
      </label>
      <label className="st-field">
        <span>State / Region</span>
        <Input
          value={value.region ?? ''}
          onChange={(e) => set('region', e.target.value)}
          autoComplete="address-level1"
        />
      </label>
      <label className="st-field">
        <span>Postal code</span>
        <Input
          required
          value={value.postalCode}
          onChange={(e) => set('postalCode', e.target.value)}
          autoComplete="postal-code"
        />
      </label>
      <label className="st-field">
        <span>Country</span>
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
      </label>
      <label className="st-field st-field--full">
        <span>Phone (optional)</span>
        <Input
          type="tel"
          value={value.phone ?? ''}
          onChange={(e) => set('phone', e.target.value)}
          autoComplete="tel"
        />
      </label>
    </div>
  );
}
