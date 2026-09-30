'use client';

// Who the document is for.
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
  FieldStatus,
  Input,
  Textarea,
} from '@wizeworks/silicaui-react';
import { billingName, CustomerPicker } from './customer-picker';
import { useCustomerOnRecord } from './customer-picker-data';
import {
  clearedFromCustomer,
  fillFromCustomer,
  misdirectedEmail,
  type BilledParty,
} from './bill-to-fill';
import { DayInput } from '../../components/day-input';

export interface BillToValue {
  name: string;
  email: string;
  address: string;
}

interface BillToProps {
  customerId: string | null;
  value: BillToValue;
  /** `YYYY-MM-DD`, or '' for none. */
  dueAt: string;
  /** What this document is called in a sentence: "invoice", "quote", "estimate".
   *  Passed in rather than assumed, because this same form is the one screen
   *  that makes all three (issue 762). */
  noun: string;
  /** True when the document offers a price rather than demands money. The date
   *  then means "this offer runs out", not "pay by", and the two are stored in
   *  different columns — see `./save`. */
  priceOffer: boolean;
  readOnly?: boolean;
  onChange: (patch: { customerId?: string | null; billTo?: BillToValue; dueAt?: string }) => void;
  /**
   * Make a customer who is not in the book yet, with what was typed.
   *
   * Passed down rather than done here because opening a screen belongs to the
   * pane, not to a field. Without it the picker says "Add them in Customers
   * first", which sends somebody off to find that screen and type the name a
   * second time (issue 745) — and a document must reference a real customer, so
   * this is the one picker that cannot be skipped.
   */
  onAddCustomer?: (typed: string) => void;
}

export function BillTo({
  customerId,
  value,
  dueAt,
  noun,
  priceOffer,
  readOnly,
  onChange,
  onAddCustomer,
}: BillToProps) {
  const setField = (field: keyof BillToValue, next: string) => {
    onChange({ billTo: { ...value, [field]: next } });
  };

  // Who the document is on right now. The same cached read the picker itself
  // makes, so this costs nothing, and it is what lets the printed fields tell
  // "she typed this" from "we filled it from the last customer".
  const onRecord = useCustomerOnRecord(customerId);
  const attached: BilledParty | null = onRecord.data
    ? { name: billingName(onRecord.data), email: onRecord.data.email ?? '' }
    : null;
  const wrongAddress = misdirectedEmail(value.email, attached);

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Customer</FieldLabel>
        <CustomerPicker
          value={customerId}
          disabled={readOnly}
          {...(onAddCustomer ? { onAddNew: onAddCustomer } : {})}
          onSelect={(customer) => {
            onChange({
              customerId: customer.id,
              billTo: {
                ...value,
                // A printed field follows the customer while it still agrees
                // with the one it belongs to, and stays once it has been made
                // different on purpose. `attached` is still the PREVIOUS
                // customer here, which is exactly the comparison needed.
                ...fillFromCustomer(value, attached, {
                  name: billingName(customer),
                  email: customer.email ?? '',
                }),
              },
            });
          }}
          onClear={() => {
            // Their details leave with them. Otherwise the next pick meets full
            // boxes with nothing attached to compare against, and the departing
            // customer's name and address survive the swap — which is the whole
            // bug, one step later.
            onChange({
              customerId: null,
              billTo: { ...value, ...clearedFromCustomer(value, attached) },
            });
          }}
        />
        <FieldDescription>
          {`The customer record this ${noun} belongs to. It shows up in their history`}
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
          <FieldDescription>{`As it should be printed on the ${noun}`}</FieldDescription>
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
          {/* Every document that reached the broken state still has it, and no
              fix to the picker repairs one — so the screen says so. The name is
              allowed to differ (billing a person's business, or their accounts
              department); the ADDRESS is where the bill physically goes. */}
          {wrongAddress ? (
            <FieldStatus status="warning">{wrongAddress}</FieldStatus>
          ) : (
            <FieldDescription>{`Where the ${noun} gets sent`}</FieldDescription>
          )}
        </Field>
      </div>

      {/* The receivables list has always had a Due column, an overdue tone and
          day-counting phrasing, and nothing could set the date they all read.
          It arrived only when a document was ADVANCED into a payable stage, so
          an invoice raised straight into one never got a date and could never
          be chased (issue 512). */}
      <Field className="@lg:max-w-64">
        <FieldLabel>{priceOffer ? 'Good until' : 'When it should be paid'}</FieldLabel>
        <FieldControl
          render={
            <DayInput
              color="module"
              value={dueAt}
              disabled={readOnly}
              onValueChange={(value) => {
                onChange({ dueAt: value });
              }}
            />
          }
        />
        <FieldDescription>
          {priceOffer
            ? dueAt
              ? `After this date the ${noun} is marked as run out, so you can see at a glance which prices you no longer stand behind.`
              : `Leave it empty and this ${noun} stands forever. Put a date on it and the price you quoted is only promised until then.`
            : dueAt
              ? `After this, the ${noun} starts counting how many days late it is.`
              : `Leave it empty if there is no deadline. Without one this ${noun} never counts as late, so it will not show up when you look for who owes you.`}
        </FieldDescription>
      </Field>

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
