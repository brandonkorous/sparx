'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button, Heading, Input, Label, Stack, Text } from '@sparx/ui';

import { issueGiftCardAction } from '../../discount-actions';

// Issue-gift-card form, surface-aware (§13.1). The SAME component renders:
//   - `surface="page"`    inside the /new route's Container + PageHeader
//   - `surface="overlay"` inside the `@detail` drawer/modal chrome
//
// Gift cards have NO detail view, so create does NOT flow into a record: on
// success we keep the overlay/page open, surface the issued code inline, reset
// the form, and refresh the list behind. Only the framing (internal heading,
// secondary button target) differs by surface; the fields are identical.

interface IssueGiftCardFormProps {
  surface: 'page' | 'overlay';
}

export function IssueGiftCardForm({ surface }: IssueGiftCardFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [issuedCode, setIssuedCode] = React.useState<string | null>(null);

  function closeOverlay() {
    const next = new URLSearchParams(searchParams ?? '');
    next.delete('drawer');
    next.delete('modal');
    const qs = next.toString();
    router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIssuedCode(null);

    const form = new FormData(e.currentTarget);
    const dollars = Number(stringOr(form.get('amount'), '0'));
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Amount must be positive');
      return;
    }

    const input: Record<string, unknown> = {
      initialBalanceCents: Math.round(dollars * 100),
      currency: stringOr(form.get('currency'), 'USD').toUpperCase(),
    };

    const email = nonEmpty(form.get('recipientEmail'));
    const name = nonEmpty(form.get('recipientName'));
    const message = nonEmpty(form.get('message'));
    const custom = nonEmpty(form.get('customCode'));
    if (email) input.recipientEmail = email;
    if (name) input.recipientName = name;
    if (message) input.message = message;
    if (custom) input.customCode = custom.toUpperCase();

    const formEl = e.currentTarget;
    startTransition(async () => {
      const result = await issueGiftCardAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // No detail view — stay open: show the code, reset, refresh the list.
      setIssuedCode(result.data.code);
      formEl.reset();
      router.refresh();
    });
  }

  return (
    <Stack gap={6}>
      {surface === 'overlay' && (
        <Stack gap={1}>
          <Heading level={2}>Issue a gift card</Heading>
          <Text size="sm" variant="muted">
            Codes are auto-generated (16 alphanumeric, hyphen-grouped). Use a custom code only when
            migrating from a legacy system.
          </Text>
        </Stack>
      )}

      <form onSubmit={onSubmit}>
        <Stack gap={4}>
          <Stack direction="row" gap={3} wrap>
            <Stack gap={1} className="w-[8rem]">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input id="amount" name="amount" defaultValue="25" />
            </Stack>
            <Stack gap={1} className="w-[6rem]">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" maxLength={3} />
            </Stack>
            <Stack gap={1} className="min-w-[12rem] flex-1">
              <Label htmlFor="recipientEmail">Recipient email</Label>
              <Input id="recipientEmail" name="recipientEmail" type="email" />
            </Stack>
            <Stack gap={1} className="min-w-[12rem] flex-1">
              <Label htmlFor="recipientName">Recipient name</Label>
              <Input id="recipientName" name="recipientName" />
            </Stack>
          </Stack>
          <Stack gap={1}>
            <Label htmlFor="message">Message (optional)</Label>
            <Input id="message" name="message" placeholder="Happy birthday!" />
          </Stack>
          <Stack gap={1} className="w-[16rem]">
            <Label htmlFor="customCode">Custom code (optional)</Label>
            <Input
              id="customCode"
              name="customCode"
              placeholder="auto-generated when empty"
              pattern="[A-Za-z0-9-]+"
            />
          </Stack>
          <Stack direction="row" gap={2} align="center" className="pt-2">
            <Button color="module" type="submit" disabled={pending}>
              {pending ? 'Issuing…' : 'Issue gift card'}
            </Button>
            {surface === 'overlay' ? (
              <Button type="button" variant="ghost" onClick={closeOverlay}>
                Close
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/commerce/gift-cards">Back</Link>
              </Button>
            )}
            {error && (
              <Text size="sm" className="text-[var(--color-danger)]">
                {error}
              </Text>
            )}
            {issuedCode && (
              <Text size="sm" className="text-[var(--color-success)]">
                Issued <span className="font-mono">{issuedCode}</span>
              </Text>
            )}
          </Stack>
        </Stack>
      </form>
    </Stack>
  );
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function stringOr(value: FormDataEntryValue | null, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}
