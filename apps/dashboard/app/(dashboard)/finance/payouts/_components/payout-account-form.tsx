'use client';

// The ACH payout-account capture (docs/106 §4.7) — rendered inside the payouts
// drawer, mirroring the gateway credential form on Finance → Payments. The server
// only ever returns the masked view (account_last4 + status); the raw
// routing/account numbers are encrypted at rest and NEVER sent back, so those
// fields are write-only: blank on load, and re-entering them REPLACES the account
// (which resets verification to pending). On a successful save the parent closes
// the drawer + refreshes — `onSaved` is the hook.

import * as React from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Select,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { updatePayoutAccountAction } from '../actions';
import type { MarketPayoutAccount } from '../_types';

interface FormState {
  accountHolderName: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
}

function emptyForm(account: MarketPayoutAccount | null): FormState {
  return {
    // Holder name + bank name are not secret, so seed them from the masked view
    // to make a replace edit less work. The numbers are always blank.
    accountHolderName: account?.accountHolderName ?? '',
    bankName: account?.bankName ?? '',
    routingNumber: '',
    accountNumber: '',
    accountType: (account?.accountType as 'checking' | 'savings') ?? 'checking',
  };
}

const DIGITS = /\D/g;

export function PayoutAccountForm({
  account,
  onSaved,
}: {
  account: MarketPayoutAccount | null;
  /** Called after a successful save so the parent can close the drawer + refresh. */
  onSaved?: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(() => emptyForm(account));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  const routingValid = form.routingNumber.length === 9;
  const accountValid = form.accountNumber.length >= 4 && form.accountNumber.length <= 17;
  const canSubmit = form.accountHolderName.trim().length > 0 && routingValid && accountValid;

  const v = useFieldValidation(
    {
      accountHolderName: form.accountHolderName,
      routingNumber: form.routingNumber,
      accountNumber: form.accountNumber,
    },
    {
      accountHolderName: rule.required('Enter the account holder name.'),
      routingNumber: (val) =>
        String(val).length === 9 ? null : 'Enter the 9-digit routing number.',
      accountNumber: (val) => {
        const len = String(val).length;
        return len >= 4 && len <= 17 ? null : 'Enter the account number (4–17 digits).';
      },
    }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!v.validate()) return;
    setError(null);
    startTransition(async () => {
      const res = await updatePayoutAccountAction({
        accountHolderName: form.accountHolderName.trim(),
        ...(form.bankName.trim() ? { bankName: form.bankName.trim() } : {}),
        routingNumber: form.routingNumber,
        accountNumber: form.accountNumber,
        accountType: form.accountType,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      // Clear the secret fields after a successful replace, then hand off to the
      // parent (close the drawer + refresh the masked view).
      setForm((prev) => ({ ...prev, routingNumber: '', accountNumber: '' }));
      onSaved?.();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <Field {...v.field('accountHolderName')}>
          <FieldLabel required>Account holder name</FieldLabel>
          <FieldControl
            name="payout-holder"
            value={form.accountHolderName}
            maxLength={255}
            autoComplete="off"
            placeholder="Name on the bank account"
            onChange={(e) => set('accountHolderName', e.target.value)}
            {...v.control('accountHolderName')}
          />
        </Field>

        <div className="flex flex-wrap gap-4">
          <Field className="min-w-[14rem] flex-1">
            <FieldLabel>Bank name</FieldLabel>
            <FieldControl
              name="payout-bank"
              value={form.bankName}
              maxLength={255}
              autoComplete="off"
              placeholder="Optional"
              onChange={(e) => set('bankName', e.target.value)}
            />
          </Field>
          <Field className="min-w-[14rem] flex-1">
            <FieldLabel>Account type</FieldLabel>
            <Select
              value={form.accountType}
              onValueChange={(val) => set('accountType', val as 'checking' | 'savings')}
              items={{ checking: 'Checking', savings: 'Savings' }}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <Field {...v.field('routingNumber')} className="min-w-[14rem] flex-1">
            <FieldLabel required>Routing number</FieldLabel>
            <FieldControl
              name="payout-routing"
              value={form.routingNumber}
              inputMode="numeric"
              autoComplete="off"
              placeholder="9 digits"
              onChange={(e) => set('routingNumber', e.target.value.replace(DIGITS, '').slice(0, 9))}
              {...v.control('routingNumber')}
            />
            <FieldDescription>The 9-digit ABA number from your bank.</FieldDescription>
          </Field>
          <Field {...v.field('accountNumber')} className="min-w-[14rem] flex-1">
            <FieldLabel required>Account number</FieldLabel>
            <FieldControl
              name="payout-account"
              value={form.accountNumber}
              inputMode="numeric"
              autoComplete="off"
              placeholder="4–17 digits"
              onChange={(e) =>
                set('accountNumber', e.target.value.replace(DIGITS, '').slice(0, 17))
              }
              {...v.control('accountNumber')}
            />
            <FieldDescription>
              We store only the last 4 digits in the clear; the rest is encrypted.
            </FieldDescription>
          </Field>
        </div>

        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}

        <Button
          type="submit"
          color="module"
          className="w-full"
          disabled={pending || !canSubmit}
          loading={pending}
        >
          {account ? 'Replace account' : 'Save account'}
        </Button>
      </div>
    </form>
  );
}
