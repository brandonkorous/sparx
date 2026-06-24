'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { grantAccountCreditAction } from '../../discount-actions';

// Grant-account-credit form, on the standard create surface (docs/86 F layout).
// The SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Account credit has NO detail view to flow into — a grant adds to a running
// balance, not a new record. So on success we STAY OPEN: show the inline
// success line (new balance), reset the fields, and refresh the list rather
// than switching any URL token.

export interface CustomerOption {
  id: string;
  name: string;
  email: string | null;
}

interface GrantAccountCreditFormProps {
  surface: 'page' | 'overlay';
  customers: CustomerOption[];
}

const STEPS: SurfaceStepDef[] = [{ key: 'grant', label: 'Grant' }];

export function GrantAccountCreditForm({ surface, customers }: GrantAccountCreditFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const [customerId, setCustomerId] = React.useState('');
  const [amount, setAmount] = React.useState('25');
  const [currency, setCurrency] = React.useState('USD');
  const [note, setNote] = React.useState('');

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list.
  const cancel = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/account-credit');
    }
  }, [surface, pathname, searchParams, router]);

  function submit() {
    setError(null);
    setDone(null);
    if (!customerId) {
      setError('Pick a customer');
      return;
    }
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Amount must be positive');
      return;
    }
    const trimmedNote = note.trim();
    const input: Record<string, unknown> = {
      customerId,
      amountCents: Math.round(dollars * 100),
      currency: currency.toUpperCase(),
      reason: 'grant',
    };
    if (trimmedNote) input.note = trimmedNote;

    startTransition(async () => {
      const result = await grantAccountCreditAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setDone(`new balance ${(result.data.newBalanceCents / 100).toFixed(2)}`);
      setCustomerId('');
      setAmount('25');
      setCurrency('USD');
      setNote('');
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="Grant account credit"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Grant account credit',
            supporting:
              'Adds to a customer’s balance for the named currency. New customer + new currency creates a fresh balance row.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Grant credit',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack direction="row" gap={3} wrap align="end">
                  <Stack gap={2} className="min-w-[18rem] flex-1">
                    <Label htmlFor="customerId">Customer</Label>
                    <NativeSelect
                      id="customerId"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                    >
                      <option value="">— pick —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.email && c.email !== c.name ? ` · ${c.email}` : ''}
                        </option>
                      ))}
                    </NativeSelect>
                  </Stack>
                  <Stack gap={2} className="w-[8rem]">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Stack>
                  <Stack gap={2} className="w-[6rem]">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      maxLength={3}
                    />
                  </Stack>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="note">Note (shows in the customer&apos;s ledger)</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Goodwill credit after shipping delay"
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          {error && (
            <Text
              size="sm"
              role="alert"
              aria-live="polite"
              className="mt-4 text-[var(--color-danger)]"
            >
              {error}
            </Text>
          )}
          {done && (
            <Text size="sm" aria-live="polite" className="mt-4 text-[var(--color-success)]">
              Granted — {done}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
