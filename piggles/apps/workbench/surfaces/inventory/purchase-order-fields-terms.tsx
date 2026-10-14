// Order details, continued: when it is expected, how it is paid for, and the
// freight to get it here.

import {
  DateInput,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
} from '@wizeworks/silicaui-react';
// `MoneyInput`, not `MoneyTextInput`: the amount lives in the draft as CENTS, so
// text rebuilt from them each render rewrote every keystroke (issue 484).
import { MoneyInput } from '../../components/money-input';
import { dayFromStored, pickedDayUtc } from '../../lib/today';
import { formatCents } from './data';
import { formatDay } from './purchase-orders-data';
import { expectedDateHelp } from './expected-date-words';
import type { PurchaseOrderPane } from './use-purchase-order-detail';
import { SettledField } from './purchase-order-settled-field';

export function ExpectedField({ pane }: { pane: PurchaseOrderPane }) {
  const { draft, setHeader } = pane;
  if (!pane.editable) {
    return (
      <SettledField
        label="Expected"
        value={draft.header.expectedArrivalAt ? formatDay(draft.header.expectedArrivalAt) : null}
        empty="No date"
        /* Points at the live control below rather than a dead second lever. */
        description="Change it under When it is expected, below, if the supplier gives you a new date."
      />
    );
  }
  return (
    <Field>
      <FieldLabel>Expected</FieldLabel>
      <DateInput
        color="module"
        // A DAY both ways, in UTC, so this box and the card below agree on the date.
        value={dayFromStored(draft.header.expectedArrivalAt)}
        aria-label="Expected arrival date"
        onValueChange={(date) => {
          setHeader('expectedArrivalAt', pickedDayUtc(date));
        }}
      />
      <FieldDescription>{expectedDateHelp(pane.chosenSupplier)}</FieldDescription>
    </Field>
  );
}

export function PaymentTermsField({ pane }: { pane: PurchaseOrderPane }) {
  const { draft, setHeader } = pane;
  if (!pane.editable) {
    return (
      <SettledField label="How you pay" value={draft.header.paymentTerms} empty="Not agreed" />
    );
  }
  return (
    <Field>
      <FieldLabel>How you pay</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={draft.header.paymentTerms ?? ''}
            placeholder="net 30"
            onChange={(event) => {
              setHeader('paymentTerms', event.target.value === '' ? null : event.target.value);
            }}
          />
        }
      />
    </Field>
  );
}

export function FreightField({ pane }: { pane: PurchaseOrderPane }) {
  const { draft, setHeader, freight, currency } = pane;
  if (!pane.editable) {
    return (
      <SettledField
        label="Freight"
        value={formatCents(freight.cents, currency)}
        empty="None"
        description={freight.detail}
      />
    );
  }
  return (
    <Field>
      <FieldLabel>Freight</FieldLabel>
      <FieldControl
        render={
          <MoneyInput
            color="module"
            size="md"
            aria-label="Freight"
            value={draft.header.freightCents / 100}
            onValueChange={(value) => {
              setHeader('freightCents', Math.round(value * 100));
            }}
          />
        }
      />
      <FieldDescription>
        What it costs to get these goods to you. It is spread across the items as they arrive, so
        what you hold is valued at what it really cost.
      </FieldDescription>
    </Field>
  );
}
