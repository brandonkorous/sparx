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
  WizardFrame,
  WizardStep,
  type WizardStepDef,
} from '@sparx/ui';
import { ContentBlockEditor, EMPTY_DOC, type CmsDoc } from '@sparx/cms-editor';

import { createPage } from '../actions';

// New-page form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → WizardFrame `embedded` at the /cms/new route (contained sheet)
//   - `surface="overlay"` → WizardFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
// No bespoke card-footer toolbar, no repeated page title — that drift is what
// docs/86 standardizes away.
//
// A page flows INTO its detail view on success: the overlay swaps its token to
// the new record's detail (preserving drawer vs modal); the page navigates to it.

interface PageCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: WizardStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function PageCreateForm({ surface }: PageCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [doc, setDoc] = React.useState<CmsDoc>(EMPTY_DOC);

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the content list.
  const cancel = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/cms/content');
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
      next.set(mode, `page:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/cms/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    const formData = new FormData();
    formData.set('title', title);
    formData.set('slug', slug);
    formData.set('content', JSON.stringify(doc));

    startTransition(async () => {
      const result = await createPage(formData);
      if (!result.ok || !result.data) {
        setError(result.error ?? 'Could not create page.');
        return;
      }
      onCreated(result.data.id);
    });
  }

  return (
    <ModuleProvider module="cms" className="h-full">
      <WizardFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New page"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <WizardStep
          header={{
            title: 'Page basics',
            supporting:
              'Saves as a draft. Publish from the editor once the content is ready — nothing goes live until you say so.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create draft',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack gap={2}>
                  <Label htmlFor="title" required>
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    aria-required
                  />
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="slug">Slug (optional)</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto-derived from title"
                  />
                  <Text size="xs" variant="muted">
                    Lowercase letters, numbers, and dashes only.
                  </Text>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="page-body-editor">Content (optional)</Label>
                  <ContentBlockEditor
                    id="page-body-editor"
                    value={doc}
                    onChange={setDoc}
                    placeholder="Write the initial body. You can always edit after creation."
                    ariaLabel="Page body editor"
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
        </WizardStep>
      </WizardFrame>
    </ModuleProvider>
  );
}
