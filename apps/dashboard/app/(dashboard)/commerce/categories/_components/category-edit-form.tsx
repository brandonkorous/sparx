'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

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

import { reparentCategoryAction, updateCategoryAction } from '../../category-actions';
import type { CategoryParentOption } from './category-create-form';

// Category edit form — the body of the category detail view (§13.1). Rendered
// the same in the `@detail` drawer/modal overlay and the full-page
// /commerce/categories/[id] route, so editing is uniform with every other
// entity instead of inline on the tree.
//
// Name / handle / description / featured go through `updateCategoryAction`;
// parent + position changes route through `reparentCategoryAction` (its own
// endpoint because path rewriting is non-trivial) and only fire when something
// actually changed.

export interface CategoryEditData {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parentId: string | null;
  path: string;
  position: number;
  featured: boolean;
}

interface CategoryEditFormProps {
  category: CategoryEditData;
  parents: CategoryParentOption[];
}

export function CategoryEditForm({ category, parents }: CategoryEditFormProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  // Exclude self + descendants so a merchant can't reparent a node under its
  // own subtree (the server enforces cycle prevention too — this just keeps the
  // picker honest).
  const parentOptions = parents.filter(
    (p) => p.id !== category.id && !p.path.startsWith(`${category.path}.`)
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSavedAt(null);

    const form = new FormData(e.currentTarget);
    const name = stringField(form.get('name')).trim();
    const handle = stringField(form.get('handle')).trim();
    const description = stringField(form.get('description')).trim();
    const positionRaw = stringField(form.get('position')).trim();
    const newParentId = stringField(form.get('parentId'));
    const featured = form.get('featured') === 'on';

    if (!name) {
      setFieldErrors({ name: 'Name is required.' });
      return;
    }
    const position = Number.parseInt(positionRaw, 10);
    if (!Number.isFinite(position) || position < 0) {
      setFieldErrors({ position: 'Position must be a non-negative integer.' });
      return;
    }

    startTransition(async () => {
      const updatePayload: Record<string, unknown> = {
        name,
        featured,
        ...(handle && handle !== category.handle ? { handle } : {}),
        description: description.length > 0 ? description : null,
      };
      const updateResult = await updateCategoryAction(category.id, updatePayload);
      if (!updateResult.ok) {
        if (updateResult.error.code === 'VALIDATION_ERROR' && updateResult.error.details?.length) {
          const fe: Record<string, string> = {};
          for (const d of updateResult.error.details) fe[d.field] = d.message;
          setFieldErrors(fe);
        }
        setError(updateResult.error.message);
        return;
      }

      const parentChanged = (newParentId || null) !== category.parentId;
      const positionChanged = position !== category.position;
      if (parentChanged || positionChanged) {
        const reparentResult = await reparentCategoryAction({
          categoryId: category.id,
          newParentId: newParentId.length > 0 ? newParentId : null,
          newPosition: position,
        });
        if (!reparentResult.ok) {
          setError(reparentResult.error.message);
          return;
        }
      }

      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Details</Heading>
            <CardDescription>
              Rename, reslug, reparent, or reorder. Storefront URLs follow the category&apos;s path.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={3} wrap>
              <Stack gap={1} className="min-w-[12rem] flex-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={category.name} required />
                {fieldErrors.name && (
                  <Text size="xs" variant="danger">
                    {fieldErrors.name}
                  </Text>
                )}
              </Stack>
              <Stack gap={1} className="min-w-[12rem] flex-1">
                <Label htmlFor="handle">Handle</Label>
                <Input id="handle" name="handle" defaultValue={category.handle} />
                {fieldErrors.handle && (
                  <Text size="xs" variant="danger">
                    {fieldErrors.handle}
                  </Text>
                )}
              </Stack>
              <Stack gap={1} className="w-24">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  name="position"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={category.position}
                />
                {fieldErrors.position && (
                  <Text size="xs" variant="danger">
                    {fieldErrors.position}
                  </Text>
                )}
              </Stack>
            </Stack>
            <Stack gap={1}>
              <Label htmlFor="parentId">Parent</Label>
              <NativeSelect id="parentId" name="parentId" defaultValue={category.parentId ?? ''}>
                <option value="">— Top level —</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {indent(p.depth)}
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Stack>
            <Stack gap={1}>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={category.description ?? ''}
              />
            </Stack>
            <Stack direction="row" align="center" gap={2}>
              <input
                type="checkbox"
                id="featured"
                name="featured"
                defaultChecked={category.featured}
                className="h-4 w-4"
              />
              <Label htmlFor="featured">Featured</Label>
            </Stack>
          </Stack>
        </CardContent>
        <CardFooter>
          <Stack direction="row" gap={2} justify="between" align="center" className="w-full">
            {error && (
              <Text size="sm" variant="danger" role="alert" aria-live="polite">
                {error}
              </Text>
            )}
            {savedAt && !error && (
              <Text size="xs" variant="muted">
                Saved {savedAt}
              </Text>
            )}
            <Button
              color="module"
              type="submit"
              disabled={pending}
              loading={pending}
              className="ml-auto"
            >
              Save
            </Button>
          </Stack>
        </CardFooter>
      </Card>
    </form>
  );
}

function indent(depth: number): string {
  return depth === 0 ? '' : `${'  '.repeat(depth)}↳ `;
}

function stringField(value: FormDataEntryValue | null, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
