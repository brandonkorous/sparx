'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Heading,
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
import { Plus } from 'lucide-react';

import { createRedirect } from '../actions';

// New-redirect form, surface-aware (§13.1). The SAME component renders:
//   - `surface="page"`    inside the /new route's Container + PageHeader
//   - `surface="overlay"` inside the `@detail` drawer/modal chrome
//
// Only the framing (internal heading, secondary button target) differs by
// surface; the fields are identical. Redirects have NO detail view, so on
// success the form stays open: it shows an inline success Text, resets the
// fields + status Select, and refreshes the underlying list — there is no
// URL token switch into a record.

interface RedirectCreateFormProps {
  surface: 'page' | 'overlay';
}

export function RedirectCreateForm({ surface }: RedirectCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [statusCode, setStatusCode] = React.useState('301');

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
    setMessage(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    // The <Select> writes to React state, not native FormData — inject it.
    data.set('status_code', statusCode);
    startTransition(async () => {
      const result = await createRedirect(data);
      if (!result.ok) {
        setError(result.error ?? 'Could not create redirect.');
        return;
      }
      setMessage('Redirect added.');
      form.reset();
      setStatusCode('301');
      router.refresh();
    });
  }

  return (
    <Stack gap={6}>
      {surface === 'overlay' && (
        <Stack gap={1}>
          <Heading level={2}>Add redirect</Heading>
          <Text size="sm" variant="muted">
            Paths must begin with a slash. Same-path or loop targets are rejected.
          </Text>
        </Stack>
      )}

      <form onSubmit={onSubmit}>
        <Card>
          <CardContent>
            <Stack gap={4}>
              <Stack direction="row" gap={3} align="end">
                <Stack gap={1} className="flex-1">
                  <Label htmlFor="from_path">From</Label>
                  <Input id="from_path" name="from_path" placeholder="/old-path" required />
                </Stack>
                <Stack gap={1} className="flex-1">
                  <Label htmlFor="to_path">To</Label>
                  <Input id="to_path" name="to_path" placeholder="/new-path" required />
                </Stack>
                <Stack gap={1}>
                  <Label htmlFor="status_code">Status</Label>
                  <Select value={statusCode} onValueChange={setStatusCode}>
                    <SelectTrigger id="status_code" aria-label="HTTP status code">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="301">301 Permanent</SelectItem>
                      <SelectItem value="302">302 Found</SelectItem>
                      <SelectItem value="307">307 Temporary</SelectItem>
                      <SelectItem value="308">308 Permanent (keep method)</SelectItem>
                    </SelectContent>
                  </Select>
                </Stack>
              </Stack>
              {error && (
                <Text size="sm" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}
              {message && (
                <Text size="sm" variant="success" aria-live="polite">
                  {message}
                </Text>
              )}
            </Stack>
          </CardContent>
          <CardFooter>
            {surface === 'overlay' ? (
              <Button type="button" variant="ghost" onClick={closeOverlay}>
                Close
              </Button>
            ) : (
              <Button type="button" variant="ghost" asChild>
                <Link href="/cms/redirects">Back</Link>
              </Button>
            )}
            <Button
              type="submit"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
              disabled={pending}
              loading={pending}
            >
              Add redirect
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Stack>
  );
}
