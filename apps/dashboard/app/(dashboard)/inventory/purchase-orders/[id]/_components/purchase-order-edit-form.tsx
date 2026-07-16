'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardActions,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { useFieldValidation } from '@sparx/forms';

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

  const [warehouseId, setWarehouseId] = React.useState(po.warehouseId);
  const [paymentTerms, setPaymentTerms] = React.useState(po.paymentTerms ?? '');
  const [reference, setReference] = React.useState(po.reference ?? '');
  const [expectedArrival, setExpectedArrival] = React.useState(
    po.expectedArrivalAt ? po.expectedArrivalAt.slice(0, 10) : ''
  );
  const [currency, setCurrency] = React.useState(po.currency);
  const [shipping, setShipping] = React.useState((po.shippingCents / 100).toFixed(2));
  const [notes, setNotes] = React.useState(po.notes ?? '');

  const v = useFieldValidation(
    { shipping },
    {
      shipping: (val) => {
        const s = String(val).trim();
        if (s === '') return null;
        const n = Number(s);
        if (!Number.isFinite(n)) return 'Enter a shipping amount.';
        if (n < 0) return 'Shipping cannot be negative.';
        return null;
      },
    }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!v.validate()) return;

    const shippingTrim = shipping.trim();
    const input = {
      warehouseId,
      currency: (currency.trim() || 'USD').toUpperCase(),
      paymentTerms: paymentTerms.trim() || null,
      reference: reference.trim() || null,
      expectedArrivalAt: expectedArrival ? new Date(expectedArrival).toISOString() : null,
      shippingCents: shippingTrim ? Math.round(Number(shippingTrim) * 100) : 0,
      notes: notes.trim() || null,
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
              <Field className="min-w-[14rem] flex-1">
                <FieldLabel>Warehouse</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </NativeSelect>
                  }
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                />
              </Field>
              <Field className="min-w-[10rem] flex-1">
                <FieldLabel>Payment terms</FieldLabel>
                <FieldControl
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="net30"
                />
              </Field>
              <Field className="min-w-[10rem] flex-1">
                <FieldLabel>Reference</FieldLabel>
                <FieldControl
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="optional"
                />
              </Field>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[10rem] flex-1">
                <FieldLabel>Expected arrival</FieldLabel>
                <FieldControl
                  type="date"
                  value={expectedArrival}
                  onChange={(e) => setExpectedArrival(e.target.value)}
                />
              </Field>
              <Field className="min-w-[10rem] flex-1">
                <FieldLabel>Currency</FieldLabel>
                <FieldControl
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  maxLength={3}
                />
              </Field>
              <Field className="min-w-[10rem] flex-1" {...v.field('shipping')}>
                <FieldLabel>Shipping ($)</FieldLabel>
                <FieldControl
                  type="number"
                  min="0"
                  step="0.01"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                  {...v.control('shipping')}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Notes</FieldLabel>
              <FieldControl
                render={<Textarea rows={2} />}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </CardBody>
        <CardActions>
          <div className="flex w-full flex-row items-center gap-3">
            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
            {saved && !error && <p className="text-base-content text-sm">Saved.</p>}
            <Button color="module" type="submit" disabled={pending} className="ml-auto">
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </CardActions>
      </Card>
    </form>
  );
}
