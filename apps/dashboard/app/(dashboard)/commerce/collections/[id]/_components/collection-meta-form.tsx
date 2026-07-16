'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Label,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { SeoMetaFields } from '@/components/seo/seo-meta-fields';

import { updateCollectionAction } from '../../../collection-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

interface Props {
  collectionId: string;
  name: string;
  handle: string;
  description: string | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface MetaState {
  name: string;
  handle: string;
  description: string;
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
}

// Metadata tab for a collection — name, handle, description, featured flag, SEO.
// This is ONE tab/panel of the tabbed collection detail view, so it is NOT a
// nested SurfaceFrame (docs/86 edit surface-type rule): it's the panel brought
// onto the design system — fields in a module-tinted card, a real <Checkbox>,
// and a consistent Save that disables until something actually changes. Type is
// intentionally not editable here (the service refuses type flips because they
// destroy opposite-mode data).

export function CollectionMetaForm(props: Props) {
  const { collectionId } = props;
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const initial = React.useMemo<MetaState>(
    () => ({
      name: props.name,
      handle: props.handle,
      description: props.description ?? '',
      featured: props.featured,
      seoTitle: props.seoTitle ?? '',
      seoDescription: props.seoDescription ?? '',
    }),
    [
      props.name,
      props.handle,
      props.description,
      props.featured,
      props.seoTitle,
      props.seoDescription,
    ]
  );

  const [form, setForm] = React.useState<MetaState>(initial);
  const [baseline, setBaseline] = React.useState<MetaState>(initial);

  // Field validation. `handle` carries no client rule but is validated-tracked so
  // a server-side handle error maps onto its field.
  const values = { name: form.name, handle: form.handle };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
  });

  const dirty = React.useMemo(
    () => (Object.keys(form) as (keyof MetaState)[]).some((k) => form[k] !== baseline[k]),
    [form, baseline]
  );

  // Register the dirty state so switching tabs / the back-link / the presentation
  // switch all confirm before discarding unsaved metadata (docs/105 — the guard
  // extends to tabbed details via GuardedTabs, which consults this).
  useUnsavedGuard(dirty, { kind: 'edit', noun: 'collection' });

  function set<K extends keyof MetaState>(key: K, value: MetaState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;
    startTransition(async () => {
      const result = await updateCollectionAction(collectionId, {
        name: form.name.trim(),
        handle: form.handle.trim(),
        description: form.description.trim() || null,
        featured: form.featured,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
      });
      if (!result.ok) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.length) {
          v.setServerErrors(
            Object.fromEntries(result.error.details.map((d) => [d.field, d.message]))
          );
        } else {
          setError(result.error.message);
        }
        return;
      }
      setBaseline(form);
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Metadata</h3>
            <p className="opacity-70">
              Name, slug, description, and SEO. Type changes aren&apos;t supported — delete and
              recreate if you need to switch between manual and rules-driven.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-4">
              <Field {...v.field('name')} className="flex-1">
                <FieldLabel required>Name</FieldLabel>
                <FieldControl
                  name="name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  {...v.control('name')}
                />
              </Field>
              <Field {...v.field('handle')} className="flex-1">
                <FieldLabel>Handle</FieldLabel>
                <FieldControl
                  name="handle"
                  value={form.handle}
                  onChange={(e) => set('handle', e.target.value)}
                  {...v.control('handle')}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <FieldControl
                name="description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                render={<Textarea rows={4} />}
              />
            </Field>
            <div className="flex flex-col gap-1">
              <div className="flex flex-row items-center gap-2">
                <Checkbox
                  id="featured"
                  color="module"
                  checked={form.featured}
                  onChange={(e) => set('featured', e.target.checked)}
                />
                <Label htmlFor="featured">Featured</Label>
              </div>
              <p className="text-base-content text-xs">
                Featured collections surface in curated storefront slots (hero rails, nav promos).
              </p>
            </div>

            <SeoMetaFields
              type="collection"
              id={collectionId}
              nameSource={form.name}
              descriptionSource={form.description}
              seoTitle={form.seoTitle}
              seoDescription={form.seoDescription}
              onSeoTitleChange={(val) => set('seoTitle', val)}
              onSeoDescriptionChange={(val) => set('seoDescription', val)}
              className="border-base-300 border-t pt-4"
            />

            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}

            <div className="flex flex-row items-center justify-end gap-2">
              {savedAt !== null && !dirty && (
                <div className="text-success flex flex-row items-center gap-1">
                  <Check className="h-4 w-4" />
                  <p className="text-success text-sm">Saved</p>
                </div>
              )}
              <Button type="submit" color="module" disabled={pending || !dirty} loading={pending}>
                Save changes
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
