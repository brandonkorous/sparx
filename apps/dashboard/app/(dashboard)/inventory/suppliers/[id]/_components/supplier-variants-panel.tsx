'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Checkbox,
  Heading,
  Input,
  Label,
  Stack,
  Text,
} from '@sparx/ui';

import {
  lookupVariantBySkuAction,
  removeSupplierVariantAction,
  upsertSupplierVariantAction,
} from '../../../_lib/supplier-actions';

export interface SupplierVariantRow {
  id: string;
  variantId: string;
  supplierSku: string | null;
  unitCostCents: number | null;
  minOrderQty: number | null;
  leadTimeDays: number | null;
  isPreferred: boolean;
  variantSku: string | null;
  productTitle: string | null;
}

// Per-variant purchasing links for a supplier (docs/100 P3a). The add form
// resolves a variant by SKU (the natural key) then upserts the link. These feed
// PO line defaults + the moving-average basis on receipt. Mutations revalidate
// the detail server-side, then refresh.

export function SupplierVariantsPanel({
  supplierId,
  links,
}: {
  supplierId: string;
  links: SupplierVariantRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const sku = str(form.get('sku'));
    if (!sku) {
      setError('Enter a variant SKU.');
      return;
    }
    const cost = str(form.get('unitCost'));
    const moq = str(form.get('minOrderQty'));
    const supplierSku = str(form.get('supplierSku'));
    const isPreferred = form.get('isPreferred') === 'on';

    startTransition(async () => {
      const lookup = await lookupVariantBySkuAction(sku);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${sku}".`);
        return;
      }
      const result = await upsertSupplierVariantAction(supplierId, {
        variantId: lookup.data.variantId,
        ...(supplierSku ? { supplierSku } : {}),
        ...(cost ? { unitCostCents: Math.round(Number(cost) * 100) } : {}),
        ...(moq ? { minOrderQty: Number(moq) } : {}),
        isPreferred,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  function onRemove(variantId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeSupplierVariantAction(supplierId, variantId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <Stack gap={1}>
          <Heading level={3}>Purchasing catalog</Heading>
          <CardDescription>
            The variants you buy from this supplier — their part number, your cost, and MOQ. Cost
            seeds purchase-order lines and the moving-average basis when stock is received.
          </CardDescription>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={4}>
          {links.length === 0 ? (
            <Text size="sm" variant="muted">
              No variants linked yet. Add one below by its SKU.
            </Text>
          ) : (
            <Stack gap={2}>
              {links.map((l) => (
                <Stack
                  key={l.id}
                  direction="row"
                  align="center"
                  gap={3}
                  wrap
                  className="rounded border border-[var(--color-border-default)] px-3 py-2"
                >
                  <Stack gap={0} className="min-w-[12rem] flex-1">
                    <Stack direction="row" align="center" gap={2}>
                      <Text size="sm" className="font-medium">
                        {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
                      </Text>
                      {l.isPreferred && <Badge color="module">preferred</Badge>}
                    </Stack>
                    <Text size="xs" variant="muted" className="font-mono">
                      {l.variantSku ?? l.variantId}
                      {l.supplierSku ? ` · their #${l.supplierSku}` : ''}
                    </Text>
                  </Stack>
                  <Detail
                    label="Cost"
                    value={l.unitCostCents !== null ? money(l.unitCostCents) : '—'}
                  />
                  <Detail
                    label="MOQ"
                    value={l.minOrderQty !== null ? String(l.minOrderQty) : '—'}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(l.variantId)}
                    disabled={pending}
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}

          <form ref={formRef} onSubmit={onAdd}>
            <Stack
              direction="row"
              gap={3}
              align="end"
              wrap
              className="rounded border border-dashed border-[var(--color-border-default)] p-3"
            >
              <AddField label="Variant SKU" name="sku" required placeholder="e.g. FUEL-FILTER-1" />
              <AddField label="Their part #" name="supplierSku" placeholder="optional" />
              <AddField label="Cost ($)" name="unitCost" type="number" placeholder="0.00" />
              <AddField label="MOQ" name="minOrderQty" type="number" placeholder="1" />
              <label className="flex items-center gap-2 pb-2">
                <Checkbox color="module" name="isPreferred" />
                <Text size="sm">Preferred</Text>
              </label>
              <Button color="module" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Add'}
              </Button>
            </Stack>
          </form>

          {error && (
            <Text size="sm" className="text-[var(--color-danger)]">
              {error}
            </Text>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0} className="w-[5rem]">
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Stack>
  );
}

function AddField({
  label,
  name,
  required,
  placeholder,
  type,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Stack gap={1} className="min-w-[8rem] flex-1">
      <Label htmlFor={`add-${name}`}>{label}</Label>
      <Input
        id={`add-${name}`}
        name={name}
        required={required}
        placeholder={placeholder}
        type={type}
      />
    </Stack>
  );
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
