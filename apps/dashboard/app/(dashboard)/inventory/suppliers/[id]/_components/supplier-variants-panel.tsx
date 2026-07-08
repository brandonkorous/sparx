'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Badge, Button, Card, CardBody, Checkbox, Input, Label } from 'silicaui-react';

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
      <CardBody>
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold">Purchasing catalog</h3>
          <p className="opacity-70">
            The variants you buy from this supplier — their part number, your cost, and MOQ. Cost
            seeds purchase-order lines and the moving-average basis when stock is received.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {links.length === 0 ? (
            <p className="text-base-content/70 text-sm">
              No variants linked yet. Add one below by its SKU.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {links.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-row flex-wrap items-center gap-3 rounded border border-[var(--color-border-default)] px-3 py-2"
                >
                  <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
                    <div className="flex flex-row items-center gap-2">
                      <p className="text-sm font-medium">
                        {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
                      </p>
                      {l.isPreferred && <Badge color="module">preferred</Badge>}
                    </div>
                    <p className="text-base-content/70 font-mono text-xs">
                      {l.variantSku ?? l.variantId}
                      {l.supplierSku ? ` · their #${l.supplierSku}` : ''}
                    </p>
                  </div>
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
                </div>
              ))}
            </div>
          )}

          <form ref={formRef} onSubmit={onAdd}>
            <div className="flex flex-row flex-wrap items-end gap-3 rounded border border-dashed border-[var(--color-border-default)] p-3">
              <AddField label="Variant SKU" name="sku" required placeholder="e.g. FUEL-FILTER-1" />
              <AddField label="Their part #" name="supplierSku" placeholder="optional" />
              <AddField label="Cost ($)" name="unitCost" type="number" placeholder="0.00" />
              <AddField label="MOQ" name="minOrderQty" type="number" placeholder="1" />
              <label className="flex items-center gap-2 pb-2">
                <Checkbox color="module" name="isPreferred" />
                <p className="text-sm">Preferred</p>
              </label>
              <Button color="module" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Add'}
              </Button>
            </div>
          </form>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[5rem] flex-col gap-0">
      <p className="text-base-content/70 text-xs">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
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
    <div className="flex min-w-[8rem] flex-1 flex-col gap-1">
      <Label htmlFor={`add-${name}`}>{label}</Label>
      <Input
        id={`add-${name}`}
        name={name}
        required={required}
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
