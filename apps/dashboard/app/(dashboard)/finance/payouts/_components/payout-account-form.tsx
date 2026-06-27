'use client';

// The ACH payout bank account capture (docs/106 §4.7). The server only ever
// returns the masked view (account_last4 + status) — the raw routing/account
// numbers are encrypted at rest and NEVER sent back, so the routing/account
// fields are write-only: blank on load, and re-entering them REPLACES the
// account (which resets verification to pending). A clear callout when no
// account is on file, since payouts are held until one is.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Landmark } from 'lucide-react';
import {
  Alert,
  Badge,
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
  statusLabel,
  statusTone,
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

export function PayoutAccountForm({ account }: { account: MarketPayoutAccount | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(() => emptyForm(account));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSavedAt(null);
  }

  const routingValid = form.routingNumber.length === 9;
  const accountValid = form.accountNumber.length >= 4 && form.accountNumber.length <= 17;
  const canSubmit = form.accountHolderName.trim().length > 0 && routingValid && accountValid;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSavedAt(null);
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
      // Clear the secret fields after a successful replace; keep the masked view
      // fresh via a refresh.
      setForm((prev) => ({ ...prev, routingNumber: '', accountNumber: '' }));
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <Stack gap={4}>
      {account ? (
        <Stack
          direction="row"
          align="center"
          gap={3}
          className="rounded-md border border-[var(--color-border-default)] p-3"
          wrap
        >
          <Landmark className="h-5 w-5 text-[var(--color-text-secondary)]" />
          <Stack gap={1} className="flex-1">
            <Stack direction="row" align="center" gap={2} wrap>
              <Text weight="medium">
                {account.bankName ? `${account.bankName} · ` : ''}
                {account.accountType === 'savings' ? 'Savings' : 'Checking'} ••••
                {account.accountLast4 ?? '????'}
              </Text>
              <Badge color={statusTone(account.status)} variant="soft" size="sm">
                {statusLabel(account.status)}
              </Badge>
            </Stack>
            <Text size="xs" variant="muted">
              {account.accountHolderName} · Re-enter your bank details below to replace this
              account.
            </Text>
          </Stack>
        </Stack>
      ) : (
        <Alert color="warning" variant="soft" icon={<Landmark />} title="Add a bank account">
          You need a bank account on file to receive payouts. Settlements are held until you add one
          — your earnings keep accruing in the meantime.
        </Alert>
      )}

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
                onChange={(e) =>
                  set('routingNumber', e.target.value.replace(DIGITS, '').slice(0, 9))
                }
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

          <Stack direction="row" align="center" justify="end" gap={3} wrap>
            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mr-auto">
                {error}
              </Text>
            )}
            {savedAt !== null && (
              <Stack
                direction="row"
                align="center"
                gap={1}
                className="text-[var(--color-success-text)]"
              >
                <Check className="h-4 w-4" />
                <Text size="sm" variant="success">
                  Saved
                </Text>
              </Stack>
            )}
            <Button type="submit" color="module" disabled={pending || !canSubmit} loading={pending}>
              {account ? 'Replace account' : 'Save account'}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Stack>
  );
}
