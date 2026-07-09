'use client';

// New-workflow form on the standard create surface (docs/86 F layout, WS2). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// Single-step form. A workflow has no detail-view drawer (its detail is a
// full-page stage editor), and a fresh workflow has no stages yet — so on success
// we continue to the edit screen where stages are configured, the natural next
// step rather than returning to the list. Mirrors the CRM new-pipeline form.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import {
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Label,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { createWorkflowAction } from '../../../workflow-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

interface NewWorkflowFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

// Derives a kebab-case slug from the workflow name. Mirrors the API's expected
// `^[a-z][a-z0-9-]*$` shape so the live suggestion is always valid to submit.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewWorkflowForm({ surface }: NewWorkflowFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [isDefault, setIsDefault] = React.useState(false);

  // Until the user edits the slug by hand, keep it in lockstep with the name.
  const effectiveSlug = slugTouched ? slug : slugify(name);

  const v = useFieldValidation(
    { name, slug: effectiveSlug },
    {
      name: rule.required('Name is required.'),
      slug: rule.required('Slug is required.'),
    }
  );

  const dirty = name.trim() !== '' || slugTouched || isDefault;
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'workflow' });

  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/invoicing/workflows');
    }
  }, [surface, pathname, searchParams, router]);

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function submit() {
    setError(null);
    if (!v.validate()) return;
    const input = {
      name: name.trim(),
      slug: effectiveSlug,
      isDefault,
      sortOrder: 0,
    };
    startTransition(async () => {
      const result = await createWorkflowAction(input);
      if (result.ok) {
        // No detail drawer; a new workflow has no stages yet, so continue to the
        // edit screen where stages are configured. The push clears the overlay token.
        router.push(`/invoicing/workflows/${result.data.id}/edit`);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <ModuleProvider module="invoicing" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New workflow"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Workflow details',
            supporting:
              'A workflow is a document’s lifecycle. Create the shell now; you’ll add and order its stages on the next screen.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create workflow',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody>
              <CardTitle>Workflow details</CardTitle>
              <div className="flex flex-col gap-4">
                <Field {...v.field('name')}>
                  <FieldLabel required>Name</FieldLabel>
                  <FieldControl
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Repair order"
                    {...v.control('name')}
                  />
                  <FieldDescription>
                    The internal name for this lifecycle (e.g. Repair Order, Quick Invoice, Tattoo
                    Booking).
                  </FieldDescription>
                </Field>
                <Field {...v.field('slug')}>
                  <FieldLabel required>Slug</FieldLabel>
                  <FieldControl
                    name="slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="repair-order"
                    {...v.control('slug')}
                  />
                  <FieldDescription>
                    Lowercase kebab-case. Used as the stable identifier.
                  </FieldDescription>
                </Field>
                <div className="flex flex-row items-center gap-2">
                  <Checkbox
                    color="module"
                    id="workflow-default"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  <Label htmlFor="workflow-default">Make this the default workflow</Label>
                </div>

                {error && (
                  <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                    {error}
                  </FieldStatus>
                )}
              </div>
            </CardBody>
          </Card>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
