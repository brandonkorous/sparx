'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import {
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Label,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import { ContentBlockEditor, EMPTY_DOC, type CmsDoc } from '@sparx/cms-editor';

import { createPage } from '../actions';
import { useUnsavedGuard } from '../../_components/unsaved-guard';

// New-page form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /cms/new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
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

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function PageCreateForm({ surface }: PageCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [doc, setDoc] = React.useState<CmsDoc>(EMPTY_DOC);

  const v = useFieldValidation({ title }, { title: rule.required('Title is required.') });

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped. `doc` starts at the `EMPTY_DOC`
  // reference, so an identity change means body content was entered.
  const dirty = title.trim() !== '' || slug.trim() !== '' || doc !== EMPTY_DOC;

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'page' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the content list. Used by the success path and, through `cancel`, by the
  // guarded Cancel.
  const close = React.useCallback(() => {
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

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

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
    if (!v.validate()) return;
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
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New page"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
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
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <Field {...v.field('title')}>
                  <FieldLabel required>Title</FieldLabel>
                  <FieldControl
                    name="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    {...v.control('title')}
                  />
                </Field>
                <Field>
                  <FieldLabel>Slug (optional)</FieldLabel>
                  <FieldControl
                    name="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto-derived from title"
                  />
                  <FieldDescription>Lowercase letters, numbers, and dashes only.</FieldDescription>
                </Field>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-body-editor">Content (optional)</Label>
                  <ContentBlockEditor
                    id="page-body-editor"
                    value={doc}
                    onChange={setDoc}
                    placeholder="Write the initial body. You can always edit after creation."
                    ariaLabel="Page body editor"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              className="mt-4"
              role="alert"
              aria-live="polite"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
