'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  Input,
  Label,
  ModuleProvider,
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { issueGiftCardAction } from '../../discount-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

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

    const dollars = Number(amount.trim());
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Amount must be positive');
      return;
    }

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
          <Card variant="default">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack direction="row" gap={3} wrap>
                  <Stack gap={2} className="w-[8rem]">
                    <Label htmlFor="gc-amount">Amount ($)</Label>
                    <Input
                      id="gc-amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Stack>
                  <Stack gap={2} className="w-[6rem]">
                    <Label htmlFor="gc-currency">Currency</Label>
                    <Input
                      id="gc-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      maxLength={3}
                    />
                  </Stack>
                  <Stack gap={2} className="min-w-[12rem] flex-1">
                    <Label htmlFor="gc-recipient-email">Recipient email</Label>
                    <Input
                      id="gc-recipient-email"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                  </Stack>
                  <Stack gap={2} className="min-w-[12rem] flex-1">
                    <Label htmlFor="gc-recipient-name">Recipient name</Label>
                    <Input
                      id="gc-recipient-name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </Stack>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="gc-message">Message (optional)</Label>
                  <Input
                    id="gc-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Happy birthday!"
                  />
                </Stack>
                <Stack gap={2} className="w-[16rem]">
                  <Label htmlFor="gc-custom-code">Custom code (optional)</Label>
                  <Input
                    id="gc-custom-code"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    placeholder="auto-generated when empty"
                    pattern="[A-Za-z0-9-]+"
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          {issuedCode && (
            <Text size="sm" className="mt-4 text-[var(--color-success)]" aria-live="polite">
              Issued <span className="font-mono">{issuedCode}</span>
            </Text>
          )}
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
