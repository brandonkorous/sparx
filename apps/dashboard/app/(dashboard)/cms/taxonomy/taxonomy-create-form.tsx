'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Checkbox,
  Heading,
  Input,
  Label,
  Stack,
  Text,
} from '@sparx/ui';
import { Plus } from 'lucide-react';
import { createTaxonomy } from './actions';

// New-taxonomy form, surface-aware (§13.1). The SAME component renders:
//   - `surface="page"`    inside the /new route's Container + PageHeader
//   - `surface="overlay"` inside the `@detail` drawer/modal chrome
//
// Only the framing (internal heading, Cancel target) and the post-create
// transition differ by surface; the fields are identical. `createTaxonomy`
// returns no id, but the submitted `key` IS the stable identifier and the
// detail view is keyed by it — so on success the overlay swaps to
// `taxonomy:<key>` (create flows into view) and the page pushes to the record.

interface TaxonomyCreateFormProps {
  surface: 'page' | 'overlay';
}

export function TaxonomyCreateForm({ surface }: TaxonomyCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [hierarchical, setHierarchical] = React.useState(false);

  // After create: in an overlay, transition the token to the new record's
  // detail (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(key: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `taxonomy:${key}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/cms/taxonomy/${encodeURIComponent(key)}`);
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
    const form = e.currentTarget;
    // <Checkbox> writes to React state, not native FormData. Inject the value
    // before the server action reads it.
    const data = new FormData(form);
    if (hierarchical) data.set('hierarchical', 'on');
    else data.delete('hierarchical');
    // `createTaxonomy` returns no id; capture the submitted key up front so we
    // can flow into the new record's detail view on success.
    const keyValue = data.get('key');
    const key = typeof keyValue === 'string' ? keyValue : '';
    startTransition(async () => {
      const result = await createTaxonomy(data);
      if (!result.ok) {
        setError(result.error ?? 'Could not create taxonomy.');
        return;
      }
      onCreated(key);
    });
  }

  return (
    <Stack gap={6}>
      {surface === 'overlay' && (
        <Stack gap={1}>
          <Heading level={2}>New taxonomy</Heading>
          <Text size="sm" variant="muted">
            The <code>key</code> is the stable identifier the API uses (e.g.{' '}
            <code>blog_category</code>).
          </Text>
        </Stack>
      )}

      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <Heading level={3}>Basics</Heading>
            <CardDescription>Key, name, plural, and nesting.</CardDescription>
          </CardHeader>
          <CardContent>
            <Stack gap={4}>
              <Stack direction="row" gap={3}>
                <Stack gap={1} className="flex-1">
                  <Label htmlFor="key" required>
                    Key
                  </Label>
                  <Input id="key" name="key" placeholder="blog_category" required aria-required />
                </Stack>
                <Stack gap={1} className="flex-1">
                  <Label htmlFor="name" required>
                    Name
                  </Label>
                  <Input id="name" name="name" placeholder="Category" required aria-required />
                </Stack>
                <Stack gap={1} className="flex-1">
                  <Label htmlFor="plural_name" required>
                    Plural
                  </Label>
                  <Input
                    id="plural_name"
                    name="plural_name"
                    placeholder="Categories"
                    required
                    aria-required
                  />
                </Stack>
              </Stack>
              <Stack direction="row" align="center" gap={2}>
                <Checkbox
                  id="hierarchical"
                  checked={hierarchical}
                  onCheckedChange={(next) => setHierarchical(next === true)}
                />
                <Label htmlFor="hierarchical">Allow parent / child term nesting</Label>
              </Stack>
            </Stack>
          </CardContent>
          {error && (
            <CardContent>
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            </CardContent>
          )}
          <CardFooter>
            {surface === 'overlay' ? (
              <Button type="button" variant="ghost" onClick={closeOverlay}>
                Cancel
              </Button>
            ) : (
              <Button type="button" variant="ghost" asChild>
                <Link href="/cms/taxonomy">Cancel</Link>
              </Button>
            )}
            <Button
              type="submit"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
              disabled={pending}
              loading={pending}
            >
              Add taxonomy
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Stack>
  );
}
