'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Heading,
  Input,
  Label,
  NativeSelect,
  Stack,
  Text,
} from '@sparx/ui';

import { createInventoryCountAction } from '../../../_lib/count-actions';
import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

interface PickedVariant {
  variantId: string;
  sku: string;
  title: string | null;
}

// New-count form. Pick the warehouse + type (cycle covers chosen SKUs, full
// snapshots every level), set the approval threshold, and — for a cycle — add the
// variants by SKU. Submits and navigates to the count detail to enter quantities.

export function CountCreateForm({ warehouses }: { warehouses: PartyOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [type, setType] = React.useState<'cycle' | 'full'>('cycle');
  const [variants, setVariants] = React.useState<PickedVariant[]>([]);

  function addVariant(v: PickedVariant) {
    setVariants((prev) => (prev.some((p) => p.variantId === v.variantId) ? prev : [...prev, v]));
  }
  function removeVariant(variantId: string) {
    setVariants((prev) => prev.filter((p) => p.variantId !== variantId));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const warehouseId = str(form.get('warehouseId'));
    if (!warehouseId) {
      setError('Choose a warehouse.');
      return;
    }
    const threshold = str(form.get('threshold'));
    const input = {
      warehouseId,
      type,
      ...(threshold ? { approvalThresholdCents: Math.round(Number(threshold) * 100) } : {}),
      ...nonEmpty('note', form),
      ...(type === 'cycle' ? { variantIds: variants.map((v) => v.variantId) } : {}),
    };

    startTransition(async () => {
      const result = await createInventoryCountAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/inventory/counts/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Count details</Heading>
            <CardDescription>
              A count is scoped to one warehouse. Choose how much to count and the variance value
              above which a manager must approve before it posts.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={3} wrap>
              <Stack gap={1} className="min-w-[14rem] flex-1">
                <Label htmlFor="warehouseId">Warehouse</Label>
                <NativeSelect id="warehouseId" name="warehouseId" defaultValue={warehouses[0]?.id}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </NativeSelect>
              </Stack>
              <Stack gap={1} className="min-w-[12rem] flex-1">
                <Label htmlFor="type">Type</Label>
                <NativeSelect
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value === 'full' ? 'full' : 'cycle')}
                >
                  <option value="cycle">Cycle — chosen SKUs</option>
                  <option value="full">Full — every level in the warehouse</option>
                </NativeSelect>
              </Stack>
              <Stack gap={1} className="min-w-[10rem]">
                <Label htmlFor="threshold">Approval over ($)</Label>
                <Input id="threshold" name="threshold" type="number" placeholder="50.00" />
              </Stack>
            </Stack>
            <Stack gap={1}>
              <Label htmlFor="note">Note</Label>
              <textarea
                id="note"
                name="note"
                rows={2}
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {type === 'cycle' && (
        <CyclePicker
          variants={variants}
          onAdd={addVariant}
          onRemove={removeVariant}
          busy={pending}
        />
      )}
      {type === 'full' && (
        <Card className="mt-6">
          <CardContent>
            <Text size="sm" variant="muted" className="py-2">
              A full count snapshots every active level in the warehouse — you&apos;ll enter a
              counted quantity for each on the next screen.
            </Text>
          </CardContent>
        </Card>
      )}

      <Stack direction="row" gap={2} align="center" justify="between" className="mt-6 w-full">
        {error && (
          <Text size="sm" className="text-[var(--color-danger)]">
            {error}
          </Text>
        )}
        <Stack direction="row" gap={2} className="ml-auto">
          <Button type="button" variant="ghost" asChild>
            <Link href="/inventory/counts">Cancel</Link>
          </Button>
          <Button color="module" type="submit" disabled={pending}>
            {pending ? 'Starting…' : 'Start count'}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

function CyclePicker({
  variants,
  onAdd,
  onRemove,
  busy,
}: {
  variants: PickedVariant[];
  onAdd: (v: PickedVariant) => void;
  onRemove: (variantId: string) => void;
  busy: boolean;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <Stack gap={1}>
          <Heading level={3}>Items to count</Heading>
          <CardDescription>
            Add the variants to count by SKU. You can also add more once the count is open.
          </CardDescription>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          {variants.length === 0 ? (
            <Text size="sm" variant="muted">
              No items yet — add a SKU below, or start empty and add them on the next screen.
            </Text>
          ) : (
            <Stack gap={2}>
              {variants.map((v) => (
                <Stack
                  key={v.variantId}
                  direction="row"
                  align="center"
                  gap={3}
                  wrap
                  className="rounded border border-[var(--color-border-default)] px-3 py-2"
                >
                  <Stack gap={0} className="min-w-[12rem] flex-1">
                    <Text size="sm" className="font-medium">
                      {v.title ?? v.sku}
                    </Text>
                    <Text size="xs" variant="muted" className="font-mono">
                      {v.sku}
                    </Text>
                  </Stack>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => onRemove(v.variantId)}
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
          <SkuAddRow onAdd={onAdd} disabled={busy} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function SkuAddRow({ onAdd, disabled }: { onAdd: (v: PickedVariant) => void; disabled?: boolean }) {
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function add() {
    const sku = value.trim();
    if (!sku) {
      setError('Enter a variant SKU.');
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      const lookup = await lookupVariantBySkuAction(sku);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${sku}".`);
        setBusy(false);
        return;
      }
      onAdd({
        variantId: lookup.data.variantId,
        sku: lookup.data.sku,
        title: lookup.data.productTitle,
      });
      setValue('');
      setBusy(false);
    })();
  }

  return (
    <Stack gap={2}>
      <Stack
        direction="row"
        gap={3}
        align="end"
        wrap
        className="rounded border border-dashed border-[var(--color-border-default)] p-3"
      >
        <Stack gap={1} className="min-w-[12rem] flex-1">
          <Label htmlFor="count-add-sku">Variant SKU</Label>
          <Input
            id="count-add-sku"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. FUEL-FILTER-1"
          />
        </Stack>
        <Button color="module" type="button" onClick={add} disabled={busy || disabled}>
          {busy ? 'Adding…' : 'Add item'}
        </Button>
      </Stack>
      {error && (
        <Text size="sm" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}

function nonEmpty(name: string, form: FormData): Record<string, string> {
  const value = str(form.get(name));
  return value ? { [name]: value } : {};
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
