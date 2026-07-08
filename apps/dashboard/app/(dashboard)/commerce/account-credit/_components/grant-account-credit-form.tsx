'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Card, CardBody, Input, Label, NativeSelect } from 'silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';

import { grantAccountCreditAction } from '../../discount-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

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

  // Unsaved-changes guard. A create form starts empty (bar default amount/currency),
  // so "dirty" is "the user has changed anything" — guard a Cancel / Close / Switch
  // / backdrop so typed work isn't silently dropped.
  const dirty = customerId !== '' || amount !== '25' || currency !== 'USD' || note.trim() !== '';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'account credit' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used through `cancel` by the guarded Cancel.
  const close = React.useCallback(() => {
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

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

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
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-row flex-wrap items-end gap-3">
                  <div className="flex min-w-[18rem] flex-1 flex-col gap-2">
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
                  </div>
                  <div className="flex w-[8rem] flex-col gap-2">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="flex w-[6rem] flex-col gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      maxLength={3}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="note">Note (shows in the customer&apos;s ledger)</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Goodwill credit after shipping delay"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
          {error && (
            <p className="mt-4 text-sm text-[var(--color-danger)]" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          {done && (
            <p className="mt-4 text-sm text-[var(--color-success)]" aria-live="polite">
              Granted — {done}
            </p>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
