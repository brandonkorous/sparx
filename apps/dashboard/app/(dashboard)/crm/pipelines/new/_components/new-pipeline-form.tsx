'use client';

// New-pipeline form on the standard create surface (docs/86 F layout, WS2). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// Single-step form. A pipeline has no detail-view drawer (its detail is a
// full-width Kanban board), and a freshly created pipeline has no stages yet — so
// on success we continue to the edit screen where stages are configured, which is
// the natural next step rather than returning to the list. The frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module primary).

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  ModuleProvider,
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createPipelineAction } from '../../../pipeline-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

interface NewPipelineFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

// Derives a kebab-case slug from the pipeline name. Mirrors the API's expected
// `^[a-z][a-z0-9-]*$` shape so the live suggestion is always valid to submit.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function NewPipelineForm({ surface }: NewPipelineFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [isDefault, setIsDefault] = React.useState(false);

  // Until the user edits the slug by hand, keep it in lockstep with the name so
  // they rarely have to type the identifier twice.
  const effectiveSlug = slugTouched ? slug : slugify(name);

  const dirty = name.trim() !== '' || slugTouched || isDefault;
  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'pipeline' });

  // Leave WITHOUT the guard (the guarded Cancel routes here once confirmed).
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/crm/pipelines');
    }
  }, [surface, pathname, searchParams, router]);

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!effectiveSlug) {
      setError('Slug is required.');
      return;
    }
    const input = {
      name: name.trim(),
      slug: effectiveSlug,
      isDefault,
      sortOrder: 0,
    };
    startTransition(async () => {
      const result = await createPipelineAction(input);
      if (result.ok) {
        // No detail drawer; a new pipeline has no stages yet, so continue to the
        // edit screen where stages are configured. The push clears the overlay token.
        router.push(`/crm/pipelines/${result.data.id}/edit`);
        router.refresh();
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <ModuleProvider module="crm" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New pipeline"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Pipeline details',
            supporting:
              'Create the pipeline shell now; you’ll add and order its stages on the next screen.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create pipeline',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="default">
            <CardHeader>
              <CardTitle>Pipeline details</CardTitle>
            </CardHeader>
            <CardContent>
              <Stack gap={4}>
                <Stack gap={2}>
                  <Label htmlFor="pipeline-name">Name</Label>
                  <Input
                    id="pipeline-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Fleet contract renewals"
                  />
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="pipeline-slug">Slug</Label>
                  <Input
                    id="pipeline-slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="fleet-contract-renewals"
                  />
                  <Text size="xs" variant="muted">
                    Lowercase kebab-case. Used as the URL identifier.
                  </Text>
                </Stack>
                <Stack direction="row" align="center" gap={2}>
                  <Checkbox
                    color="module"
                    id="pipeline-default"
                    checked={isDefault}
                    onCheckedChange={(v) => setIsDefault(v === true)}
                  />
                  <Label htmlFor="pipeline-default">Make this the default pipeline</Label>
                </Stack>

                {error && (
                  <Text size="sm" variant="danger" role="alert" aria-live="polite">
                    {error}
                  </Text>
                )}
              </Stack>
            </CardContent>
          </Card>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
