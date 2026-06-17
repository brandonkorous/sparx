'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Heading,
  Input,
  Label,
  NativeSelect,
  Stack,
  Text,
} from '@sparx/ui';

import { createPurchaseOrderAction } from '../../../_lib/purchase-order-actions';
import { LineAddRow, type ResolvedLine } from '../../_components/line-add-row';
import { formatMoney } from '../../_components/types';

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

// New-PO form. Header (supplier, warehouse, terms, expected arrival, shipping)
// plus lines accumulated in memory — line cost left blank defaults server-side
// from the supplier link / variant cost. Submits the whole PO as a draft, then
// navigates to its detail. Re-adding a variant replaces that line.

export function PurchaseOrderCreateForm({
  suppliers,
  warehouses,
}: {
  suppliers: PartyOption[];
  warehouses: PartyOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [lines, setLines] = React.useState<ResolvedLine[]>([]);
  const [currency, setCurrency] = React.useState('USD');

  const headerRef = React.useRef<HTMLFormElement>(null);

  function addLine(line: ResolvedLine) {
    setLines((prev) => {
      const rest = prev.filter((l) => l.variantId !== line.variantId);
      return [...rest, line];
    });
  }

  function removeLine(variantId: string) {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }

  const knownSubtotal = lines.reduce(
    (s, l) => s + (l.unitCostCents !== undefined ? l.unitCostCents * l.quantity : 0),
    0
  );
  const hasDefaults = lines.some((l) => l.unitCostCents === undefined);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const supplierId = str(form.get('supplierId'));
    const warehouseId = str(form.get('warehouseId'));
    if (!supplierId || !warehouseId) {
      setError('Choose a supplier and a warehouse.');
      return;
    }
    const expected = str(form.get('expectedArrival'));
    const shipping = str(form.get('shipping'));
    const input = {
      supplierId,
      warehouseId,
      currency: (str(form.get('currency')) || 'USD').toUpperCase(),
      ...nonEmpty('paymentTerms', form),
      ...nonEmpty('reference', form),
      ...(expected ? { expectedArrivalAt: new Date(expected).toISOString() } : {}),
      shippingCents: shipping ? Math.round(Number(shipping) * 100) : 0,
      ...nonEmpty('notes', form),
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        ...(l.unitCostCents !== undefined ? { unitCostCents: l.unitCostCents } : {}),
      })),
    };

    startTransition(async () => {
      const result = await createPurchaseOrderAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/inventory/purchase-orders/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form ref={headerRef} onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Order details</Heading>
            <CardDescription>
              Who you&apos;re buying from and where it lands. Terms default onto the order and can
              be overridden per line later.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={3} wrap>
              <SelectField label="Supplier" name="supplierId" options={suppliers} />
              <SelectField label="Warehouse" name="warehouseId" options={warehouses} />
            </Stack>
            <Stack direction="row" gap={3} wrap>
              <Field label="Payment terms" name="paymentTerms" placeholder="net30" />
              <Field label="Reference" name="reference" placeholder="optional" />
              <Field label="Expected arrival" name="expectedArrival" type="date" />
            </Stack>
            <Stack direction="row" gap={3} wrap>
              <Stack gap={1} className="min-w-[6rem]">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  name="currency"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
              </Stack>
              <Field label="Shipping ($)" name="shipping" type="number" placeholder="0.00" />
            </Stack>
            <Stack gap={1}>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Lines</Heading>
            <CardDescription>
              Add the variants to order by SKU. Leave the cost blank to use the supplier&apos;s
              agreed cost (falls back to the variant cost).
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            {lines.length === 0 ? (
              <Text size="sm" variant="muted">
                No lines yet — you can still save an empty draft and add them later.
              </Text>
            ) : (
              <Stack gap={2}>
                {lines.map((l) => (
                  <Stack
                    key={l.variantId}
                    direction="row"
                    align="center"
                    gap={3}
                    wrap
                    className="rounded border border-[var(--color-border-default)] px-3 py-2"
                  >
                    <Stack gap={0} className="min-w-[12rem] flex-1">
                      <Text size="sm" className="font-medium">
                        {l.title ?? l.sku}
                      </Text>
                      <Text size="xs" variant="muted" className="font-mono">
                        {l.sku}
                      </Text>
                    </Stack>
                    <Text size="sm">×{l.quantity}</Text>
                    <Text size="sm" variant="muted">
                      {l.unitCostCents !== undefined
                        ? formatMoney(l.unitCostCents, currency)
                        : 'default'}
                    </Text>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => removeLine(l.variantId)}
                    >
                      Remove
                    </Button>
                  </Stack>
                ))}
                <Stack direction="row" justify="end" gap={2}>
                  <Text size="sm" variant="muted">
                    Subtotal {formatMoney(knownSubtotal, currency)}
                    {hasDefaults ? ' + default-priced lines' : ''}
                  </Text>
                </Stack>
              </Stack>
            )}

            <LineAddRow onAdd={addLine} disabled={pending} />
          </Stack>
        </CardContent>
        <CardFooter>
          <Stack direction="row" gap={2} align="center" justify="between" className="w-full">
            {error && (
              <Text size="sm" className="text-[var(--color-danger)]">
                {error}
              </Text>
            )}
            <Stack direction="row" gap={2} className="ml-auto">
              <Button type="button" variant="ghost" asChild>
                <Link href="/inventory/purchase-orders">Cancel</Link>
              </Button>
              <Button color="module" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Create draft'}
              </Button>
            </Stack>
          </Stack>
        </CardFooter>
      </Card>
    </form>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: PartyOption[];
}) {
  return (
    <Stack gap={1} className="min-w-[14rem] flex-1">
      <Label htmlFor={name}>{label}</Label>
      <NativeSelect id={name} name={name} defaultValue={options[0]?.id}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.code})
          </option>
        ))}
      </NativeSelect>
    </Stack>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Stack gap={1} className="min-w-[10rem] flex-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} />
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
