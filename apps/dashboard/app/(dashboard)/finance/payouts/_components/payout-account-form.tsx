'use client';

// The ACH payout-account capture (docs/106 §4.7) — rendered inside the payouts
// drawer, mirroring the gateway credential form on Finance → Payments. The server
// only ever returns the masked view (account_last4 + status); the raw
// routing/account numbers are encrypted at rest and NEVER sent back, so those
// fields are write-only: blank on load, and re-entering them REPLACES the account
// (which resets verification to pending). On a successful save the parent closes
// the drawer + refreshes — `onSaved` is the hook.

import * as React from 'react';
import { Button, Input, Label, Select } from 'silicaui-react';

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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="payout-holder">Account holder name</Label>
          <Input
            id="payout-holder"
            value={form.accountHolderName}
            maxLength={255}
            autoComplete="off"
            placeholder="Name on the bank account"
            onChange={(e) => set('accountHolderName', e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <Label htmlFor="payout-bank">Bank name</Label>
            <Input
              id="payout-bank"
              value={form.bankName}
              maxLength={255}
              autoComplete="off"
              placeholder="Optional"
              onChange={(e) => set('bankName', e.target.value)}
            />
          </div>
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <Label htmlFor="payout-type">Account type</Label>
            <Select
              id="payout-type"
              value={form.accountType}
              onValueChange={(v) => set('accountType', v as 'checking' | 'savings')}
              items={{ checking: 'Checking', savings: 'Savings' }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <Label htmlFor="payout-routing">Routing number</Label>
            <Input
              id="payout-routing"
              value={form.routingNumber}
              inputMode="numeric"
              autoComplete="off"
              placeholder="9 digits"
              color={form.routingNumber.length > 0 && !routingValid ? 'error' : undefined}
              onChange={(e) => set('routingNumber', e.target.value.replace(DIGITS, '').slice(0, 9))}
            />
            <p className="text-base-content/70 text-xs">The 9-digit ABA number from your bank.</p>
          </div>
          <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
            <Label htmlFor="payout-account">Account number</Label>
            <Input
              id="payout-account"
              value={form.accountNumber}
              inputMode="numeric"
              autoComplete="off"
              placeholder="4–17 digits"
              color={form.accountNumber.length > 0 && !accountValid ? 'error' : undefined}
              onChange={(e) =>
                set('accountNumber', e.target.value.replace(DIGITS, '').slice(0, 17))
              }
            />
            <p className="text-base-content/70 text-xs">
              We store only the last 4 digits in the clear; the rest is encrypted.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-danger text-sm" role="alert" aria-live="polite">
            {error}
          </p>
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
