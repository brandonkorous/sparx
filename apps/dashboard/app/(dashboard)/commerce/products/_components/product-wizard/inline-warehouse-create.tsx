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
import { Button, Input, Label, NativeSelect } from 'silicaui-react';

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

  const canSubmit =
    name.trim().length > 0 &&
    code.trim().length > 0 &&
    line1.trim().length > 0 &&
    city.trim().length > 0 &&
    country.trim().length === 2;

  async function submit() {
    setSubmitting(true);
    setError(null);
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
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border-default)] p-4">
      <p className="text-sm font-medium">New warehouse</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="iw-name">Name</Label>
          <Input
            id="iw-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Main warehouse"
          />
        </div>
        <div>
          <Label htmlFor="iw-code">Code (SKU prefix)</Label>
          <Input
            id="iw-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MAIN"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="iw-line1">Address line 1</Label>
        <Input
          id="iw-line1"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="123 Market St"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="iw-city">City</Label>
          <Input id="iw-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="iw-region">Region</Label>
          <Input
            id="iw-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="CA"
          />
        </div>
        <div>
          <Label htmlFor="iw-postal">Postal</Label>
          <Input
            id="iw-postal"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
        </div>
      </div>
      <div className="sm:w-32">
        <Label htmlFor="iw-country">Country</Label>
        <NativeSelect id="iw-country" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="GB">United Kingdom</option>
          <option value="AU">Australia</option>
        </NativeSelect>
      </div>

      {error && (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
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
