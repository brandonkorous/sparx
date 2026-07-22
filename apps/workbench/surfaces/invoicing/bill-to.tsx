'use client';

// Who the invoice is for.
//
// Two things that look redundant and aren't: the CUSTOMER is the record this
// document is attached to (required by the API, drives their account history
// and AR), while the BILLING NAME is the text printed on the document. They
// start the same and are allowed to diverge — an invoice for a person's
// business, or one addressed to an accounts-payable department, is exactly that
// case. Picking a customer seeds the printed fields; editing them afterwards
// never changes who the invoice belongs to.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Textarea,
} from '@wizeworks/silicaui-react';
import { CustomerPicker, customerLabel } from './customer-picker';

export interface BillToValue {
  name: string;
  email: string;
  address: string;
}

interface BillToProps {
  customerId: string | null;
  value: BillToValue;
  readOnly?: boolean;
  onChange: (patch: { customerId?: string | null; billTo?: BillToValue }) => void;
}

export function BillTo({ customerId, value, readOnly, onChange }: BillToProps) {
  const setField = (field: keyof BillToValue, next: string) => {
    onChange({ billTo: { ...value, [field]: next } });
  };

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Customer</FieldLabel>
        <CustomerPicker
          value={customerId}
          disabled={readOnly}
          onSelect={(customer) => {
            onChange({
              customerId: customer.id,
              billTo: {
                ...value,
                // Fill what's empty, keep what was typed.
                name: value.name || customerLabel(customer),
                email: value.email || (customer.email ?? ''),
              },
            });
          }}
          onClear={() => {
            onChange({ customerId: null });
          }}
        />
        <FieldDescription>
          The customer record this invoice belongs to — it shows up in their history
        </FieldDescription>
      </Field>

      <div className="grid gap-4 @lg:grid-cols-2">
        {/* A bare <FieldControl> renders an UNSTYLED input — it wires up the
            label/ids/aria but carries none of silica's field chrome, so these two
            sat plain-bordered next to their module-tinted neighbours. Composing
            an <Input> through `render` is what puts them on the same control. */}
        <Field>
          <FieldLabel>Billing name</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={value.name}
                disabled={readOnly}
                onChange={(event) => {
                  setField('name', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>As it should be printed on the invoice</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Email</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                type="email"
                value={value.email}
                disabled={readOnly}
                onChange={(event) => {
                  setField('email', event.target.value);
                }}
              />
            }
          />
          <FieldDescription>Where the invoice gets sent</FieldDescription>
        </Field>
      </div>

      <Field>
        <FieldLabel>Billing address</FieldLabel>
        {/* A non-input control composes onto FieldControl via `render`, so Base UI
            still wires up the label, ids, and aria. */}
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={3}
              value={value.address}
              disabled={readOnly}
              placeholder={'Street\nCity, State ZIP'}
              onChange={(event) => {
                setField('address', event.target.value);
              }}
            />
          }
        />
      </Field>
    </div>
  );
}
