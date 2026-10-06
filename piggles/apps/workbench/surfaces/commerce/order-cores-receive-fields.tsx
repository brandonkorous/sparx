'use client';

// The fields of the "old part came back" dialog: how many are usable, how many
// are not and why, and where the deposit already paid goes.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { plural, type CoreRefundRoute } from './cores-data';
import type { ReceiveForm } from './order-cores-receive';

function CountField({
  label,
  hint,
  aria,
  value,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  aria: string;
  value: string;
  error: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <Field className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
      <FieldControl
        render={
          <Input
            color={error ? 'error' : 'module'}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            className="tabular-nums"
            value={value}
            aria-label={aria}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  );
}

function ReasonField({ form }: { form: ReceiveForm }) {
  return (
    <Field>
      <FieldLabel required>Why it cannot be used</FieldLabel>
      <FieldControl
        render={
          <Textarea
            color={form.needsReason ? 'error' : 'module'}
            rows={2}
            value={form.values.note}
            placeholder="For example: cracked nozzle body"
            onChange={(event) => {
              form.set.setNote(event.target.value);
            }}
          />
        }
      />
      <FieldDescription>The customer will ask. This is kept with the order.</FieldDescription>
    </Field>
  );
}

function RefundRouteField({ form }: { form: ReceiveForm }) {
  return (
    <Field>
      <FieldLabel>Deposit already paid goes</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            value={form.values.refundTo}
            onChange={(event) => {
              form.set.setRefundTo(event.target.value as CoreRefundRoute);
            }}
          >
            <option value="original_payment">Back the way they paid</option>
            <option value="account_credit">As credit on their account</option>
          </NativeSelect>
        }
      />
    </Field>
  );
}

export function ReceiveCoresFields({ form, owed }: { form: ReceiveForm; owed: number }) {
  return (
    <>
      <div className="flex flex-col gap-3 @md:flex-row">
        <CountField
          label="Usable"
          hint="Fit to rebuild. Their deposits go back."
          aria="Cores that can be rebuilt"
          value={form.values.usable}
          error={form.tooMany}
          onChange={form.set.setUsable}
        />
        <CountField
          label="Not usable"
          hint="Cracked, missing parts, or the wrong part. You keep their deposits."
          aria="Cores that cannot be used"
          value={form.values.unusable}
          error={form.tooMany}
          onChange={form.set.setUnusable}
        />
      </div>
      {form.tooMany ? (
        <p className="text-error text-sm" role="alert">
          Only {plural(owed, 'core is', 'cores are')} still owed on this line.
        </p>
      ) : null}
      {form.bad > 0 ? <ReasonField form={form} /> : null}
      {form.good > 0 ? <RefundRouteField form={form} /> : null}
    </>
  );
}
