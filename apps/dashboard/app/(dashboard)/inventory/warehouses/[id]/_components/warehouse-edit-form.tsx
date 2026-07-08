'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardBody, CardActions, Checkbox, Input, Label } from 'silicaui-react';

import { updateWarehouseAction } from '../../../_lib/inventory-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

const CHANNELS = ['storefront', 'b2b_portal', 'admin', 'subscription'] as const;

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
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  // The fields are an uncontrolled native form (read via FormData on submit), so
  // dirtiness is derived from the live form on every input — true when any field
  // differs from the passed-in warehouse baseline (the same values seeded into the
  // inputs' defaultValue / defaultChecked).
  const formRef = React.useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = React.useState(false);
  const recomputeDirty = React.useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const str = (k: string) => {
      const v = data.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };
    const next =
      str('name') !== warehouse.name ||
      str('line1') !== (warehouse.line1 ?? '') ||
      str('line2') !== (warehouse.line2 ?? '') ||
      str('city') !== (warehouse.city ?? '') ||
      str('region') !== (warehouse.region ?? '') ||
      str('postalCode') !== (warehouse.postalCode ?? '') ||
      str('country') !== (warehouse.country ?? '') ||
      CHANNELS.some(
        (c) => (data.get(`channel:${c}`) === 'on') !== warehouse.defaultForChannel.includes(c)
      ) ||
      (data.get('isActive') === 'on') !== warehouse.isActive;
    setDirty(next);
  }, [warehouse]);

  useUnsavedGuard(dirty, { kind: 'edit', noun: 'warehouse' });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    const form = new FormData(e.currentTarget);
    const checked = (key: string) => form.get(key) === 'on';
    const input = {
      name: stringField(form.get('name'), warehouse.name),
      address: {
        line1: stringField(form.get('line1'), warehouse.line1 ?? ''),
        line2: nonEmpty(form.get('line2')),
        city: stringField(form.get('city'), warehouse.city ?? ''),
        region: nonEmpty(form.get('region')),
        postalCode: nonEmpty(form.get('postalCode')),
        country: stringField(form.get('country'), warehouse.country ?? '').toUpperCase(),
      },
      defaultForChannel: CHANNELS.filter((c) => checked(`channel:${c}`)),
      isActive: checked('isActive'),
    };

    startTransition(async () => {
      const result = await updateWarehouseAction(warehouse.id, input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={recomputeDirty} onChange={recomputeDirty}>
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={warehouse.name} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="line1">Address line 1</Label>
              <Input id="line1" name="line1" defaultValue={warehouse.line1 ?? ''} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="line2">Address line 2</Label>
              <Input id="line2" name="line2" defaultValue={warehouse.line2 ?? ''} />
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={warehouse.city ?? ''} required />
              </div>
              <div className="flex min-w-[8rem] flex-col gap-1">
                <Label htmlFor="region">Region</Label>
                <Input id="region" name="region" defaultValue={warehouse.region ?? ''} />
              </div>
              <div className="flex min-w-[8rem] flex-col gap-1">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  defaultValue={warehouse.postalCode ?? ''}
                />
              </div>
              <div className="flex w-[6rem] flex-col gap-1">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  defaultValue={warehouse.country ?? ''}
                  maxLength={2}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-sm">Default for channel</p>
              <div className="flex flex-row flex-wrap gap-4">
                {CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <Checkbox
                      color="module"
                      name={`channel:${c}`}
                      defaultChecked={warehouse.defaultForChannel.includes(c)}
                    />
                    <p className="text-sm">{c}</p>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 pt-2">
                <Checkbox color="module" name="isActive" defaultChecked={warehouse.isActive} />
                <p className="text-sm">Active</p>
              </label>
            </div>
          </div>
        </CardBody>
        <CardActions>
          <div className="flex w-full flex-row items-center justify-between gap-2">
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            {savedAt && !error && <p className="text-base-content/70 text-xs">Saved {savedAt}</p>}
            <Button color="module" type="submit" disabled={pending} className="ml-auto">
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardActions>
      </Card>
    </form>
  );
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function stringField(value: FormDataEntryValue | null, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}
