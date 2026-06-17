'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button, Heading, Input, Label, Stack, Text, Textarea } from '@sparx/ui';
import { UserPlus } from 'lucide-react';
import { createAuthor } from './actions';

// New-author form, surface-aware. The SAME component renders:
//   - `surface="page"`   inside the /new route's Container + PageHeader
//   - `surface="overlay"` inside the `@detail` drawer/modal chrome
//
// Only the framing (internal heading, Cancel target) and the post-create
// transition differ by surface; the fields are identical. On success the
// overlay swaps to the new record's detail view (create flows into view); the
// page pushes to the record.

interface AuthorCreateFormProps {
  surface: 'page' | 'overlay';
}

export function AuthorCreateForm({ surface }: AuthorCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);

  // After create: in an overlay, transition the token to the new record's
  // detail (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `author:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/cms/authors/${id}`);
    router.refresh();
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
    setError(null);
    setErrorField(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createAuthor(data);
      if (!result.ok || !result.data) {
        setError(result.error ?? 'Could not create author.');
        setErrorField(result.field ?? null);
        return;
      }
      onCreated(result.data.id);
    });
  }

  const slugError = errorField === 'slug' ? error : null;
  const generalError = errorField ? null : error;

  return (
    <Stack gap={6}>
      {surface === 'overlay' && (
        <Stack gap={1}>
          <Heading level={2}>New author</Heading>
          <Text size="sm" variant="muted">
            Slug auto-derives from the display name when omitted; must be unique within the tenant.
          </Text>
        </Stack>
      )}

      <form onSubmit={onSubmit}>
        <Stack gap={4}>
          <Stack direction="row" gap={3}>
            <Stack gap={1} className="flex-1">
              <Label htmlFor="display_name" required>
                Display name
              </Label>
              <Input
                id="display_name"
                name="display_name"
                placeholder="Jane Doe"
                required
                aria-required
              />
            </Stack>
            <Stack gap={1} className="flex-1">
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="jane-doe"
                aria-invalid={slugError ? true : undefined}
                aria-describedby={slugError ? 'slug-error' : undefined}
              />
              {slugError && (
                <Text id="slug-error" size="xs" variant="danger" role="alert" aria-live="polite">
                  {slugError}
                </Text>
              )}
            </Stack>
          </Stack>
          <Stack gap={1}>
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" rows={3} placeholder="Short author blurb…" />
          </Stack>

          {generalError && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite">
              {generalError}
            </Text>
          )}

          <Stack direction="row" align="center" gap={3}>
            <Button
              type="submit"
              color="module"
              leftIcon={<UserPlus className="h-4 w-4" />}
              disabled={pending}
              loading={pending}
            >
              Add author
            </Button>
            {surface === 'overlay' ? (
              <Button type="button" variant="ghost" onClick={closeOverlay}>
                Cancel
              </Button>
            ) : (
              <Button type="button" variant="ghost" asChild>
                <Link href="/cms/authors">Cancel</Link>
              </Button>
            )}
          </Stack>
        </Stack>
      </form>
    </Stack>
  );
}
