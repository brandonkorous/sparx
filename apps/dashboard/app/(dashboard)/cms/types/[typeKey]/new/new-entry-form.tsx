'use client';

// Type-scoped new-entry form on the standard create surface (docs/86 F layout, WS2).
// The content type is already known from the URL, so — unlike the generic
// content-entry wizard (which picks the type) — this renders the type's schema
// fields directly. It uses the SHARED `ContentEntryForm` in CONTROLLED mode
// (fields only); THIS component owns the SurfaceFrame chrome, the floor toolbar,
// the required-field guard, submit, and the unsaved-changes guard. On success it
// navigates to the new entry's detail.
//
// The drawer/modal create-with-type-picker is the generic `content-entry` overlay
// (ContentEntryWizard) — this type-scoped form stays a page surface, reached from a
// specific type's entry list.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FieldDef } from '@sparx/cms-schemas';

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { Card, CardBody, FieldStatus } from '@wizeworks/silicaui-react';

import { ContentEntryForm, missingRequiredFields } from '../../../_components/content-entry-form';
import { createEntry } from '../../actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

interface Props {
  surface: 'page' | 'overlay';
  typeKey: string;
  typeName: string;
  urlPattern: string | null;
  schema: { fields: FieldDef[] };
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

export function NewEntryForm({ surface, typeKey, typeName, urlPattern, schema }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [body, setBody] = React.useState<Record<string, unknown>>({});

  const dirty = Object.keys(body).length > 0;
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: typeName.toLowerCase() });

  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push(`/cms/types/${typeKey}`);
    }
  }, [surface, pathname, searchParams, router, typeKey]);

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function submit() {
    setError(null);
    const missing = missingRequiredFields(schema, body);
    if (missing.length) {
      setError(`Required: ${missing.join(', ')}.`);
      return;
    }
    // If the type is routable, pull `slug` straight out of the body (the schema
    // declares a `slug` field); non-routable types skip the slug arg entirely.
    const slug =
      urlPattern && typeof body.slug === 'string' && body.slug.length > 0 ? body.slug : undefined;

    startTransition(async () => {
      const res = await createEntry(typeKey, body, slug);
      if (res.ok && res.data?.id) {
        router.push(`/cms/types/${typeKey}/${res.data.id}`);
        router.refresh();
        return;
      }
      setError(res.error ?? 'Could not create the draft.');
    });
  }

  return (
    <ModuleProvider module="cms" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title={`New ${typeName.toLowerCase()}`}
        backLabel={typeName}
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: `${typeName} details`,
            supporting:
              'Fill the fields below to create a draft. You can refine and publish it next.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create draft',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody>
              <div className="flex flex-col gap-5">
                <ContentEntryForm
                  schema={schema}
                  body={body}
                  onBodyChange={setBody}
                  disabled={pending}
                />

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
