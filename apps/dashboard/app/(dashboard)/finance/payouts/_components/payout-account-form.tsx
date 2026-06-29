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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
} from '@sparx/ui';

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
      <Stack gap={4}>
        <Stack gap={2}>
          <Label htmlFor="payout-holder">Account holder name</Label>
          <Input
            id="payout-holder"
            value={form.accountHolderName}
            maxLength={255}
            autoComplete="off"
            placeholder="Name on the bank account"
            onChange={(e) => set('accountHolderName', e.target.value)}
          />
        </Stack>

        <Stack direction="row" gap={4} wrap>
          <Stack gap={2} className="min-w-[14rem] flex-1">
            <Label htmlFor="payout-bank">Bank name</Label>
            <Input
              id="payout-bank"
              value={form.bankName}
              maxLength={255}
              autoComplete="off"
              placeholder="Optional"
              onChange={(e) => set('bankName', e.target.value)}
            />
          </Stack>
          <Stack gap={2} className="min-w-[14rem] flex-1">
            <Label htmlFor="payout-type">Account type</Label>
            <Select
              value={form.accountType}
              onValueChange={(v) => set('accountType', v as 'checking' | 'savings')}
            >
              <SelectTrigger id="payout-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
              </SelectContent>
            </Select>
          </Stack>
        </Stack>

        <Stack direction="row" gap={4} wrap>
          <Stack gap={2} className="min-w-[14rem] flex-1">
            <Label htmlFor="payout-routing">Routing number</Label>
            <Input
              id="payout-routing"
              value={form.routingNumber}
              inputMode="numeric"
              autoComplete="off"
              placeholder="9 digits"
              variant={form.routingNumber.length > 0 && !routingValid ? 'error' : 'default'}
              onChange={(e) => set('routingNumber', e.target.value.replace(DIGITS, '').slice(0, 9))}
            />
            <Text size="xs" variant="muted">
              The 9-digit ABA number from your bank.
            </Text>
          </Stack>
          <Stack gap={2} className="min-w-[14rem] flex-1">
            <Label htmlFor="payout-account">Account number</Label>
            <Input
              id="payout-account"
              value={form.accountNumber}
              inputMode="numeric"
              autoComplete="off"
              placeholder="4–17 digits"
              variant={form.accountNumber.length > 0 && !accountValid ? 'error' : 'default'}
              onChange={(e) =>
                set('accountNumber', e.target.value.replace(DIGITS, '').slice(0, 17))
              }
            />
            <Text size="xs" variant="muted">
              We store only the last 4 digits in the clear; the rest is encrypted.
            </Text>
          </Stack>
        </Stack>

        {error && (
          <Text size="sm" variant="danger" role="alert" aria-live="polite">
            {error}
          </Text>
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
      </Stack>
    </form>
  );
}
