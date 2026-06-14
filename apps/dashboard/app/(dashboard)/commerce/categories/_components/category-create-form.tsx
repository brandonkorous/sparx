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
  Heading,
  Input,
  Label,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from '@sparx/ui';

import { createCategoryAction } from '../../category-actions';

// New-category form, surface-aware (§13.1). The SAME component renders:
//   - `surface="page"`    inside the /new route's Container + PageHeader
//   - `surface="overlay"` inside the `@detail` drawer/modal chrome
//
// Categories form a tree, so the parent picker is seeded from the existing
// nodes (flattened, indented by depth — see `loadCategoryParents`). Unlike
// collections/warehouses, categories have no standalone detail view: the tree
// editor on the list page owns rename / reparent / reorder / delete. So on
// success we close the overlay (or return to the list) and refresh the tree
// rather than flowing into a record detail.

export interface CategoryParentOption {
  id: string;
  name: string;
  depth: number;
}

interface CategoryCreateFormProps {
  surface: 'page' | 'overlay';
  parents: CategoryParentOption[];
}

export function CategoryCreateForm({ surface, parents }: CategoryCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // After create: categories have no detail view, so close the overlay (or
  // leave the /new page) and refresh — the tree on the list page is the record
  // surface and will pick up the new node.
  function afterCreate() {
    if (surface === 'overlay') {
      closeOverlay();
      router.refresh();
      return;
    }
    router.push('/commerce/categories');
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
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const name = stringField(form.get('name')).trim();
    const handle = stringField(form.get('handle')).trim();
    const description = stringField(form.get('description')).trim();
    const parentId = stringField(form.get('parentId'));
    const featured = form.get('featured') === 'on';

    if (!name) {
      setFieldErrors({ name: 'Name is required.' });
      return;
    }

    const payload = {
      name,
      ...(handle ? { handle } : {}),
      ...(description ? { description } : {}),
      ...(parentId ? { parentId } : {}),
      featured,
    };

    startTransition(async () => {
      const result = await createCategoryAction(payload);
      if (!result.ok) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.length) {
          const fe: Record<string, string> = {};
          for (const d of result.error.details) fe[d.field] = d.message;
          setFieldErrors(fe);
        }
        setError(result.error.message);
        return;
      }
      afterCreate();
    });
  }

  return (
    <Stack gap={6}>
      {surface === 'overlay' && (
        <Stack gap={1}>
          <Heading level={2}>New category</Heading>
          <Text size="sm" variant="muted">
            Categories are the organizational tree shoppers browse. Pick a parent to nest, or leave
            it top-level. Position and reparenting can be changed later from the tree.
          </Text>
        </Stack>
      )}

      <form onSubmit={onSubmit} noValidate>
        <Card>
          <CardHeader>
            <Heading level={3}>Basics</Heading>
            <CardDescription>
              Storefront URLs follow the category&apos;s path (
              <code>/category/&lt;handle&gt;</code>).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Stack gap={4}>
              <Stack direction="row" gap={3} wrap>
                <Stack gap={2} className="flex-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required placeholder="Engine parts" />
                  {fieldErrors.name && (
                    <Text size="xs" variant="danger">
                      {fieldErrors.name}
                    </Text>
                  )}
                </Stack>
                <Stack gap={2} className="flex-1">
                  <Label htmlFor="handle">Handle (optional)</Label>
                  <Input id="handle" name="handle" placeholder="auto-derived from name" />
                  {fieldErrors.handle && (
                    <Text size="xs" variant="danger">
                      {fieldErrors.handle}
                    </Text>
                  )}
                </Stack>
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="parentId">Parent</Label>
                <NativeSelect id="parentId" name="parentId" defaultValue="">
                  <option value="">— Top level —</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {indent(p.depth)}
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
                <Text size="xs" variant="muted">
                  Leave top-level for a root category, or nest it under an existing one.
                </Text>
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </Stack>
              <Stack direction="row" align="center" gap={2}>
                <input type="checkbox" id="featured" name="featured" className="h-4 w-4" />
                <Label htmlFor="featured">Featured</Label>
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
                <Link href="/commerce/categories">Cancel</Link>
              </Button>
            )}
            <Button type="submit" color="module" disabled={pending} loading={pending}>
              Create category
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Stack>
  );
}

function indent(depth: number): string {
  return depth === 0 ? '' : `${'  '.repeat(depth)}↳ `;
}

function stringField(value: FormDataEntryValue | null, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
