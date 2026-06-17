'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Button,
  Heading,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  Textarea,
  toast,
} from '@sparx/ui';

import { addSuppressionAction, importSuppressionsAction } from '../actions';

// Surface-aware suppression create form (§13.1). The SAME component renders:
//   - `surface="page"`    inside the /new route's Container + PageHeader
//   - `surface="overlay"` inside the `@detail` drawer/modal chrome
//
// Suppression has NO detail view, so there's no "create flows into view" hop:
// on success we keep the form open, clear the field, and `router.refresh()` so
// the list behind updates. Only the framing (internal heading, secondary
// button target) differs by surface; the fields are identical.

interface AddSuppressionFormProps {
  surface: 'page' | 'overlay';
}

export function AddSuppressionForm({ surface }: AddSuppressionFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState('');
  const [scope, setScope] = useState('all');

  function parseEmails(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  function closeOverlay() {
    const next = new URLSearchParams(searchParams ?? '');
    next.delete('drawer');
    next.delete('modal');
    const qs = next.toString();
    router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emails = parseEmails(value);
    if (emails.length === 0) {
      toast.error('Enter at least one email address.');
      return;
    }

    startTransition(async () => {
      if (emails.length === 1) {
        const result = await addSuppressionAction({ email: emails[0], scope, reason: 'manual' });
        if (result.ok) {
          toast.success(`${emails[0]} suppressed.`);
          setValue('');
          router.refresh();
        } else {
          toast.error(result.error.message);
        }
      } else {
        const result = await importSuppressionsAction({ emails, scope, reason: 'manual' });
        if (result.ok) {
          toast.success(
            `${result.data.added} address${result.data.added === 1 ? '' : 'es'} suppressed.`
          );
          setValue('');
          router.refresh();
        } else {
          toast.error(result.error.message);
        }
      }
    });
  }

  return (
    <Stack gap={6}>
      {surface === 'overlay' && (
        <Stack gap={1}>
          <Heading level={2}>Suppress an address</Heading>
          <Text size="sm" variant="muted">
            Add one or many addresses to the do-not-send list. Choose whether to block all email or
            just marketing.
          </Text>
        </Stack>
      )}

      <form onSubmit={onSubmit}>
        <Stack gap={3} className="max-w-2xl">
          <Stack gap={2}>
            <Label htmlFor="emails">Email addresses</Label>
            <Textarea
              id="emails"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="one@example.com, two@example.com — or one per line"
              rows={3}
              disabled={pending}
            />
            <Text size="sm" variant="muted">
              Paste one or many addresses (comma, space, or newline separated).
            </Text>
          </Stack>
          <Stack direction="row" align="end" gap={3}>
            <Stack gap={2}>
              <Label htmlFor="scope">Scope</Label>
              <Select value={scope} onValueChange={setScope} disabled={pending}>
                <SelectTrigger id="scope" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All email</SelectItem>
                  <SelectItem value="marketing">Marketing only</SelectItem>
                  <SelectItem value="transactional">Transactional only</SelectItem>
                </SelectContent>
              </Select>
            </Stack>
            {surface === 'overlay' ? (
              <Button type="button" variant="ghost" onClick={closeOverlay}>
                Close
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/email/suppressions">Back</Link>
              </Button>
            )}
            <Button type="submit" color="module" loading={pending} disabled={pending}>
              <Plus className="h-4 w-4" />
              Suppress
            </Button>
          </Stack>
        </Stack>
      </form>
    </Stack>
  );
}
