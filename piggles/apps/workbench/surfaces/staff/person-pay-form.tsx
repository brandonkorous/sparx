'use client';

// A NEW PAY RATE — never an edit of the last one.
//
// Editing yesterday's rate would rewrite the cost of every job this person has
// ever worked, and last quarter's profit would move for a reason nothing on any
// screen could explain. So this only ever adds; the previous rate closes the day
// before this one starts.

import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  useToast,
} from '@wizeworks/silicaui-react';

import { afterPaneChange } from '../../lib/defer';
import { staffErrorMessage, useSetRate } from './data';
import { toDateInput } from './format';

type Basis = 'hourly' | 'salary' | 'commission' | 'none';

export function NewRateForm({
  staffMemberId,
  onCancel,
}: {
  staffMemberId: string;
  onCancel: () => void;
}) {
  const toast = useToast();
  const setRate = useSetRate(staffMemberId);
  const [basis, setBasis] = useState<Basis>('hourly');
  const [amount, setAmount] = useState('');
  const [burden, setBurden] = useState('0');
  const [commission, setCommission] = useState('');
  const [from, setFrom] = useState(toDateInput(new Date()));
  const [note, setNote] = useState('');

  const needsAmount = basis === 'hourly' || basis === 'salary';
  const amountCents = Math.round(Number(amount.replace(/[,\s$]/g, '')) * 100);
  const amountOk = !needsAmount || (Number.isFinite(amountCents) && amountCents > 0);

  // A commission basis needs its percentage, and nothing else can carry one.
  // Without this the basis was selectable and undescribable — which is exactly
  // why nothing ever calculated a commission.
  const commissionPercent = Number(commission.replace(/[,\s%]/g, ''));
  const commissionOk =
    basis !== 'commission' ||
    (Number.isFinite(commissionPercent) && commissionPercent > 0 && commissionPercent <= 100);

  const submit = () => {
    setRate.mutate(
      {
        basis,
        amountCents: needsAmount ? amountCents : 0,
        burdenPercent: Number(burden) || 0,
        commissionPercent: basis === 'commission' ? commissionPercent : 0,
        effectiveFrom: from,
        effectiveTo: null,
        note: note.trim() === '' ? null : note.trim(),
      },
      {
        onSuccess: () => {
          onCancel();
          afterPaneChange(() => {
            toast.add({
              title: 'Pay rate recorded',
              description:
                'Hours worked from this date on will be costed at the new rate. Everything before it keeps the old one.',
              type: 'success',
            });
          });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not save that rate',
            description: staffErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  return (
    <div className="border-base-300 rounded-box flex flex-col gap-3 border p-3">
      <div className="grid gap-3 @lg:grid-cols-2">
        <Field>
          <FieldLabel>How they’re paid</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                value={basis}
                onChange={(event) => {
                  setBasis(event.target.value as typeof basis);
                }}
              >
                <option value="hourly">Per hour</option>
                <option value="salary">Yearly salary</option>
                <option value="commission">Commission only</option>
                <option value="none">Unpaid</option>
              </NativeSelect>
            }
          />
        </Field>

        {basis === 'commission' ? (
          <Field>
            <FieldLabel>Share of each sale</FieldLabel>
            <FieldControl
              render={
                <Input
                  inputMode="decimal"
                  placeholder="7.5"
                  value={commission}
                  onChange={(event) => {
                    setCommission(event.target.value);
                  }}
                />
              }
            />
            <FieldDescription>
              A percentage of what they sell, before tax and delivery. Worked out once the order is
              paid, and reduced if any of it is refunded.
            </FieldDescription>
          </Field>
        ) : null}

        {needsAmount ? (
          <Field>
            <FieldLabel>{basis === 'salary' ? 'Salary a year' : 'Rate an hour'}</FieldLabel>
            <FieldControl
              render={
                <Input
                  inputMode="decimal"
                  placeholder={basis === 'salary' ? '48000.00' : '32.50'}
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                  }}
                />
              }
            />
          </Field>
        ) : null}

        <Field>
          <FieldLabel>Starting from</FieldLabel>
          <FieldControl
            render={
              <Input
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            Hours worked before this date keep whatever rate was in force then.
          </FieldDescription>
        </Field>

        {needsAmount ? (
          <Field>
            <FieldLabel>Employer costs on top</FieldLabel>
            <FieldControl
              render={
                <Input
                  inputMode="decimal"
                  value={burden}
                  onChange={(event) => {
                    setBurden(event.target.value);
                  }}
                />
              }
            />
            <FieldDescription>
              A percentage — your share of payroll taxes, insurance, workers’ comp. Leaving it at
              zero makes your labour costs read about 15–30% light.
            </FieldDescription>
          </Field>
        ) : null}
      </div>

      <Field>
        <FieldLabel>Note</FieldLabel>
        <FieldControl
          render={
            <Input
              placeholder="Annual review, promotion to lead tech…"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          }
        />
      </Field>

      <div className="flex gap-2">
        <Button
          size="sm"
          color="module"
          disabled={!amountOk || !commissionOk}
          loading={setRate.isPending}
          onClick={submit}
        >
          Save this rate
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
