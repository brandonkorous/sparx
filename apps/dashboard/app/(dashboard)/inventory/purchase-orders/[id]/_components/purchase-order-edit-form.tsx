'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { Button, Card, CardActions, CardBody, Input, Label, NativeSelect } from 'silicaui-react';

import { updatePurchaseOrderAction } from '../../../_lib/purchase-order-actions';
import type { PurchaseOrderDetail } from '../../_components/types';

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

// Draft-only header edit (docs/100 P3b). Once submitted the header locks (the
// detail renders a read-only summary instead). Blank optional fields clear
// (sent as null); the service recomputes totals when shipping changes.

export function PurchaseOrderEditForm({
  po,
  warehouses,
}: {
  po: PurchaseOrderDetail;
  warehouses: PartyOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const expected = str(form.get('expectedArrival'));
    const shipping = str(form.get('shipping'));
    const input = {
      warehouseId: str(form.get('warehouseId')),
      currency: (str(form.get('currency')) || 'USD').toUpperCase(),
      paymentTerms: str(form.get('paymentTerms')) || null,
      reference: str(form.get('reference')) || null,
      expectedArrivalAt: expected ? new Date(expected).toISOString() : null,
      shippingCents: shipping ? Math.round(Number(shipping) * 100) : 0,
      notes: str(form.get('notes')) || null,
    };

    startTransition(async () => {
      const result = await updatePurchaseOrderAction(po.id, input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Order details</h3>
            <p className="opacity-70">
              Supplier is fixed once the order exists. Everything else is editable while the order
              is a draft.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row flex-wrap gap-3">
              <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
                <Label htmlFor="warehouseId">Warehouse</Label>
                <NativeSelect id="warehouseId" name="warehouseId" defaultValue={po.warehouseId}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Field
                label="Payment terms"
                name="paymentTerms"
                defaultValue={po.paymentTerms ?? ''}
                placeholder="net30"
              />
              <Field
                label="Reference"
                name="reference"
                defaultValue={po.reference ?? ''}
                placeholder="optional"
              />
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              <Field
                label="Expected arrival"
                name="expectedArrival"
                type="date"
                defaultValue={po.expectedArrivalAt ? po.expectedArrivalAt.slice(0, 10) : ''}
              />
              <Field label="Currency" name="currency" defaultValue={po.currency} maxLength={3} />
              <Field
                label="Shipping ($)"
                name="shipping"
                type="number"
                defaultValue={(po.shippingCents / 100).toFixed(2)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={po.notes ?? ''}
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </CardBody>
        <CardActions>
          <div className="flex w-full flex-row items-center gap-3">
            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
            {saved && !error && <p className="text-base-content/70 text-sm">Saved.</p>}
            <Button color="module" type="submit" disabled={pending} className="ml-auto">
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardActions>
      </Card>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  defaultValue,
  placeholder,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  );
}

function str(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}
