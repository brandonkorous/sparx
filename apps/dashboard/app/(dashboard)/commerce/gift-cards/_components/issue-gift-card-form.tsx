'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { useFieldValidation } from '@sparx/forms';

import { issueGiftCardAction } from '../../discount-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../_components/detail-panel';

// Issue-gift-card form, on the standard create surface (docs/86 F layout). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Gift cards have NO detail view, so create does NOT flow into a record: on
// success we keep the overlay/page open, surface the issued code inline, reset
// the fields to their defaults, and refresh the list behind.

interface IssueGiftCardFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

export function IssueGiftCardForm({ surface }: IssueGiftCardFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [issuedCode, setIssuedCode] = React.useState<string | null>(null);

  const [amount, setAmount] = React.useState('25');
  const [currency, setCurrency] = React.useState('USD');
  const [recipientEmail, setRecipientEmail] = React.useState('');
  const [recipientName, setRecipientName] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [customCode, setCustomCode] = React.useState('');

  // Field validation. Amount is money → must be a positive number; recipient
  // email is optional but must be well-formed when provided.
  const values = { amount, recipientEmail };
  const v = useFieldValidation(values, {
    amount: (val) => {
      const n = Number(String(val).trim());
      if (!Number.isFinite(n)) return 'Enter an amount.';
      if (n <= 0) return 'Amount must be greater than 0.';
      return null;
    },
    // Optional — only enforce shape when the merchant actually enters an address.
    recipientEmail: (val) => {
      const s = String(val).trim();
      return s === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
        ? null
        : 'Enter a valid email address.';
    },
  });

  // Unsaved-changes guard. A create form starts empty (bar default amount/currency),
  // so "dirty" is "the user has changed anything" — guard a Cancel / Close / Switch
  // / backdrop so typed work isn't silently dropped.
  const dirty =
    amount !== '25' ||
    currency !== 'USD' ||
    recipientEmail.trim() !== '' ||
    recipientName.trim() !== '' ||
    message.trim() !== '' ||
    customCode.trim() !== '';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'gift card' });

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
      router.push('/commerce/gift-cards');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function submit() {
    setError(null);
    setIssuedCode(null);
    if (!v.validate()) return;

    const dollars = Number(amount.trim());
    const input: Record<string, unknown> = {
      initialBalanceCents: Math.round(dollars * 100),
      currency: (currency.trim() || 'USD').toUpperCase(),
    };
    const email = recipientEmail.trim();
    const name = recipientName.trim();
    const note = message.trim();
    const custom = customCode.trim();
    if (email) input.recipientEmail = email;
    if (name) input.recipientName = name;
    if (note) input.message = note;
    if (custom) input.customCode = custom.toUpperCase();

    startTransition(async () => {
      const result = await issueGiftCardAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // No detail view — stay open: show the code, reset, refresh the list.
      setIssuedCode(result.data.code);
      setAmount('25');
      setCurrency('USD');
      setRecipientEmail('');
      setRecipientName('');
      setMessage('');
      setCustomCode('');
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="Issue a gift card"
        backLabel="Gift cards"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="gift-card" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Gift card details',
            supporting:
              'Codes are auto-generated (16 alphanumeric, hyphen-grouped). Use a custom code only when migrating from a legacy system.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Issue gift card',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-row flex-wrap gap-3">
                  <Field {...v.field('amount')} className="w-[8rem]">
                    <FieldLabel required>Amount ($)</FieldLabel>
                    <FieldControl
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      {...v.control('amount')}
                    />
                  </Field>
                  <Field className="w-[6rem]">
                    <FieldLabel>Currency</FieldLabel>
                    <FieldControl
                      name="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      maxLength={3}
                    />
                  </Field>
                  <Field {...v.field('recipientEmail')} className="min-w-[12rem] flex-1">
                    <FieldLabel>Recipient email</FieldLabel>
                    <FieldControl
                      name="recipientEmail"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      {...v.control('recipientEmail')}
                    />
                  </Field>
                  <Field className="min-w-[12rem] flex-1">
                    <FieldLabel>Recipient name</FieldLabel>
                    <FieldControl
                      name="recipientName"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Message (optional)</FieldLabel>
                  <FieldControl
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Happy birthday!"
                  />
                </Field>
                <Field className="w-[16rem]">
                  <FieldLabel>Custom code (optional)</FieldLabel>
                  <FieldControl
                    name="customCode"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    placeholder="auto-generated when empty"
                    pattern="[A-Za-z0-9-]+"
                  />
                </Field>
              </div>
            </CardBody>
          </Card>
          {issuedCode && (
            <FieldStatus status="success" attached={false} aria-live="polite" className="mt-4">
              Issued <span className="font-mono">{issuedCode}</span>
            </FieldStatus>
          )}
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-4"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
