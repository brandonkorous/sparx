'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
} from '@wizeworks/silicaui-react';
import { AdaptiveLabel, toast } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { updateWarehouseAction } from '../../../_lib/inventory-actions';
import { DetailFooterSlot } from '../../../../_components/detail-header-slot';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

const FORM_ID = 'warehouse-edit-form';

const CHANNELS = ['storefront', 'b2b_portal', 'admin', 'subscription'] as const;

// Server validation errors arrive keyed by the API's dotted path (address.line1);
// map them onto the flat client state keys the Fields are bound to.
const SERVER_FIELD_MAP: Record<string, 'name' | 'line1' | 'city' | 'country'> = {
  name: 'name',
  'address.line1': 'line1',
  'address.city': 'city',
  'address.country': 'country',
};

interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  type: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  defaultForChannel: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function WarehouseEditForm({ warehouse }: { warehouse: WarehouseRow }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const [name, setName] = React.useState(warehouse.name);
  const [line1, setLine1] = React.useState(warehouse.line1 ?? '');
  const [line2, setLine2] = React.useState(warehouse.line2 ?? '');
  const [city, setCity] = React.useState(warehouse.city ?? '');
  const [region, setRegion] = React.useState(warehouse.region ?? '');
  const [postalCode, setPostalCode] = React.useState(warehouse.postalCode ?? '');
  const [country, setCountry] = React.useState(warehouse.country ?? '');
  const [phone, setPhone] = React.useState(warehouse.phone ?? '');
  const [channels, setChannels] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHANNELS.map((c) => [c, warehouse.defaultForChannel.includes(c)]))
  );
  const [isActive, setIsActive] = React.useState(warehouse.isActive);

  const values = { name, line1, city, country };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    line1: rule.required('Address line 1 is required.'),
    city: rule.required('City is required.'),
    country: rule.required('Country is required.'),
  });

  // Dirtiness compares the live state to the passed-in warehouse baseline.
  const dirty =
    name.trim() !== warehouse.name ||
    line1.trim() !== (warehouse.line1 ?? '') ||
    line2.trim() !== (warehouse.line2 ?? '') ||
    city.trim() !== (warehouse.city ?? '') ||
    region.trim() !== (warehouse.region ?? '') ||
    postalCode.trim() !== (warehouse.postalCode ?? '') ||
    country.trim() !== (warehouse.country ?? '') ||
    phone.trim() !== (warehouse.phone ?? '') ||
    CHANNELS.some((c) => !!channels[c] !== warehouse.defaultForChannel.includes(c)) ||
    isActive !== warehouse.isActive;

  useUnsavedGuard(dirty, { kind: 'edit', noun: 'warehouse' });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavedAt(null);
    if (!v.validate()) return;

    const optional = (val: string) => (val.trim() ? val.trim() : undefined);
    const input = {
      name: name.trim(),
      address: {
        line1: line1.trim(),
        line2: optional(line2),
        city: city.trim(),
        region: optional(region),
        postalCode: optional(postalCode),
        country: country.trim().toUpperCase(),
        phone: optional(phone),
      },
      defaultForChannel: CHANNELS.filter((c) => channels[c]),
      isActive,
    };

    startTransition(async () => {
      const result = await updateWarehouseAction(warehouse.id, input);
      if (!result.ok) {
        toast.error(result.error.message);
        const map: Partial<Record<keyof typeof values, string>> = {};
        for (const d of result.error.details ?? []) {
          const key = SERVER_FIELD_MAP[d.field];
          if (key) map[key] = d.message;
        }
        v.setServerErrors(map);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form id={FORM_ID} onSubmit={onSubmit}>
      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Address + defaults</h3>
            <p className="opacity-70">
              Code + type are fixed at creation. Need a different code? Archive this warehouse and
              create a fresh one.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Field {...v.field('name')}>
              <FieldLabel required>Name</FieldLabel>
              <FieldControl
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                {...v.control('name')}
              />
            </Field>
            <Field {...v.field('line1')}>
              <FieldLabel required>Address line 1</FieldLabel>
              <FieldControl
                name="line1"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                {...v.control('line1')}
              />
            </Field>
            <Field>
              <FieldLabel>Address line 2</FieldLabel>
              <FieldControl name="line2" value={line2} onChange={(e) => setLine2(e.target.value)} />
            </Field>
            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[12rem] flex-1" {...v.field('city')}>
                <FieldLabel required>City</FieldLabel>
                <FieldControl
                  name="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  {...v.control('city')}
                />
              </Field>
              <Field className="min-w-[8rem]">
                <FieldLabel>Region</FieldLabel>
                <FieldControl
                  name="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </Field>
              <Field className="min-w-[8rem]">
                <FieldLabel>Postal code</FieldLabel>
                <FieldControl
                  name="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </Field>
              <Field className="w-[6rem]" {...v.field('country')}>
                <FieldLabel required>Country</FieldLabel>
                <FieldControl
                  name="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={2}
                  {...v.control('country')}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Phone</FieldLabel>
              <FieldControl name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="text-base-content/70 text-xs">
                Some carriers (e.g. USPS via Shippo) require a phone number on file for this address
                before you can buy a real shipping label.
              </p>
            </Field>
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-sm">Default for channel</p>
              <div className="flex flex-row flex-wrap gap-4">
                {CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <Checkbox
                      color="module"
                      checked={!!channels[c]}
                      onChange={(e) => setChannels((prev) => ({ ...prev, [c]: e.target.checked }))}
                    />
                    <p className="text-sm">{c}</p>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 pt-2">
                <Checkbox
                  color="module"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <p className="text-sm">Active</p>
              </label>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* The primary action teleports up into the shared detail chrome's header
          (next to Archive), not floored at the bottom — a failed save surfaces
          as a toast since there's no room for a persistent error line there. */}
      <DetailFooterSlot>
        <div className="flex items-center gap-2">
          {savedAt !== null && !dirty && (
            <span className="text-success flex items-center gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button
            type="submit"
            form={FORM_ID}
            size="sm"
            color="module"
            disabled={pending || !dirty}
            loading={pending}
          >
            <AdaptiveLabel label={{ full: 'Save changes', short: 'Save' }} />
          </Button>
        </div>
      </DetailFooterSlot>
    </form>
  );
}
