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
  Textarea,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createAuthor } from './actions';

// New-author form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
// On success the overlay swaps to the new record's detail view (create flows
// into view); the page pushes to the record.

interface AuthorCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

export function AuthorCreateForm({ surface }: AuthorCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);

  const [displayName, setDisplayName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [bio, setBio] = React.useState('');

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list.
  const cancel = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/cms/authors');
    }
  }, [surface, pathname, searchParams, router]);

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

  function submit() {
    setError(null);
    setErrorField(null);
    if (!displayName.trim()) {
      setError('Display name is required.');
      setErrorField('display_name');
      return;
    }
    const data = new FormData();
    data.append('display_name', displayName.trim());
    data.append('slug', slug.trim());
    data.append('bio', bio);
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
  const generalError = errorField === 'slug' ? null : error;

  return (
    <ModuleProvider module="cms" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New author"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Author details',
            supporting:
              'Slug auto-derives from the display name when omitted; must be unique within the tenant.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Add author',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack direction="row" gap={3} wrap>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="display_name" required>
                      Display name
                    </Label>
                    <Input
                      id="display_name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </Stack>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="slug">Slug (optional)</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="jane-doe"
                      aria-invalid={slugError ? true : undefined}
                      aria-describedby={slugError ? 'slug-error' : undefined}
                    />
                    {slugError && (
                      <Text
                        id="slug-error"
                        size="xs"
                        variant="danger"
                        role="alert"
                        aria-live="polite"
                      >
                        {slugError}
                      </Text>
                    )}
                  </Stack>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Short author blurb…"
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          {generalError && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {generalError}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
