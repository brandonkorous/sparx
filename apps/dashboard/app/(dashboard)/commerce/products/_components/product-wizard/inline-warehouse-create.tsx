'use client';

// Inline warehouse create for the wizard's Inventory step.
//
// A powerful platform shouldn't bounce the merchant out to Commerce →
// Warehouses just to seed stock — when there's no warehouse yet (or they want a
// new one), they create it right here. A warehouse needs a name, a SKU-prefix
// code, and a shippable address (line1 + city + country are required), so this
// is a compact form rather than a single field.

import * as React from 'react';
import { Plus } from 'lucide-react';
import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { createWarehouseAction } from '../../../../inventory/_lib/inventory-actions';

interface InlineWarehouseCreateProps {
  /** Called with the new warehouse id once it's created, so the caller can
   *  refresh its list and select it. */
  onCreated: (warehouseId: string) => void | Promise<void>;
}

export function InlineWarehouseCreate({ onCreated }: InlineWarehouseCreateProps) {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [line1, setLine1] = React.useState('');
  const [city, setCity] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [country, setCountry] = React.useState('US');

  const v = useFieldValidation(
    { name, code, line1, city, region, postalCode, country },
    {
      name: rule.required('Enter a name.'),
      code: rule.required('Enter a code.'),
      line1: rule.required('Enter an address.'),
      city: rule.required('Enter a city.'),
      country: (val) => {
        const s = String(val ?? '').trim();
        if (s.length !== 2) return 'Use a 2-letter country code.';
        return null;
      },
    }
  );

  const canSubmit =
    name.trim().length > 0 &&
    code.trim().length > 0 &&
    line1.trim().length > 0 &&
    city.trim().length > 0 &&
    country.trim().length === 2;

  async function submit() {
    setSubmitting(true);
    setError(null);
    if (!v.validate()) {
      setSubmitting(false);
      return;
    }
    try {
      const res = await createWarehouseAction({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type: 'owned',
        address: {
          line1: line1.trim(),
          city: city.trim(),
          ...(region.trim() ? { region: region.trim() } : {}),
          ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
          country: country.trim().toUpperCase(),
        },
        isActive: true,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      await onCreated(res.data.id);
      setOpen(false);
      // Reset for a possible next create.
      setName('');
      setCode('');
      setLine1('');
      setCity('');
      setRegion('');
      setPostalCode('');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconStart={<Plus className="h-3.5 w-3.5" />}
        onClick={() => setOpen(true)}
      >
        Create a warehouse
      </Button>
    );
  }

  return (
    <div className="border-base-300 flex flex-col gap-3 rounded-xl border p-4">
      <p className="text-sm font-medium">New warehouse</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field {...v.field('name')}>
          <FieldLabel required>Name</FieldLabel>
          <FieldControl
            id="iw-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Main warehouse"
            {...v.control('name')}
          />
        </Field>
        <Field {...v.field('code')}>
          <FieldLabel required>Code (SKU prefix)</FieldLabel>
          <FieldControl
            id="iw-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MAIN"
            {...v.control('code')}
          />
        </Field>
      </div>
      <Field {...v.field('line1')}>
        <FieldLabel required>Address line 1</FieldLabel>
        <FieldControl
          id="iw-line1"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="123 Market St"
          {...v.control('line1')}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field {...v.field('city')} className="sm:col-span-2">
          <FieldLabel required>City</FieldLabel>
          <FieldControl
            id="iw-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            {...v.control('city')}
          />
        </Field>
        <Field>
          <FieldLabel>Region</FieldLabel>
          <FieldControl
            id="iw-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="CA"
          />
        </Field>
        <Field>
          <FieldLabel>Postal</FieldLabel>
          <FieldControl
            id="iw-postal"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </Field>
      </div>
      <Field className="sm:w-32">
        <FieldLabel>Country</FieldLabel>
        <NativeSelect id="iw-country" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="GB">United Kingdom</option>
          <option value="AU">Australia</option>
        </NativeSelect>
      </Field>

      {error && (
        <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
          {error}
        </FieldStatus>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          color="module"
          size="sm"
          onClick={() => void submit()}
          disabled={!canSubmit || submitting}
          loading={submitting}
        >
          Create warehouse
        </Button>
      </div>
    </div>
  );
}
