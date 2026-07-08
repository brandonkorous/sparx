'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Label, ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { Card, CardBody, Checkbox, Input, Textarea } from 'silicaui-react';

import { createContentType } from '../actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// Surface-aware create form for a content TYPE definition (§13.1), on the
// standard create surface (docs/86 F layout). The SAME component renders in both
// presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /cms/types/new route
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the two module-tinted Cards (Identity,
// Schema) sit in the step body. No bespoke card-footer toolbar, no repeated page
// title — that drift is what docs/86 standardizes away.
//
// On success the overlay swaps to the new type's detail (create flows into the
// editor); the page navigates to the type.

const SAMPLE_SCHEMA = JSON.stringify(
  {
    fields: [
      { key: 'title', type: 'text', label: 'Title', required: true, max: 200 },
      { key: 'slug', type: 'slug', label: 'Slug', sourceField: 'title' },
      { key: 'summary', type: 'long_text', label: 'Summary', max: 480 },
      { key: 'body', type: 'rich_text', label: 'Body', required: true },
      { key: 'heroImage', type: 'asset', label: 'Hero image', accept: ['image/*'] },
    ],
  },
  null,
  2
);

interface ContentTypeInitial {
  key?: string;
  name?: string;
  pluralName?: string;
  description?: string;
  urlPattern?: string;
  isSingleton?: boolean;
  /** JSON string seeded into the schema textarea. */
  schema?: string;
}

interface ContentTypeCreateFormProps {
  surface: 'page' | 'overlay';
  /** Prefill values — e.g. duplicating an existing type into a new custom one. */
  initial?: ContentTypeInitial;
}

const STEPS: SurfaceStepDef[] = [{ key: 'definition', label: 'Definition' }];

export function ContentTypeCreateForm({ surface, initial }: ContentTypeCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [key, setKey] = React.useState(initial?.key ?? '');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [pluralName, setPluralName] = React.useState(initial?.pluralName ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [urlPattern, setUrlPattern] = React.useState(initial?.urlPattern ?? '');
  const [schemaText, setSchemaText] = React.useState(initial?.schema ?? SAMPLE_SCHEMA);
  const [isSingleton, setIsSingleton] = React.useState(initial?.isSingleton ?? false);
  const [validationHint, setValidationHint] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(schemaText);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !Array.isArray((parsed as { fields?: unknown }).fields)
      ) {
        setValidationHint('Schema must be a JSON object with a `fields` array.');
        return;
      }
      const count = (parsed as { fields: unknown[] }).fields.length;
      setValidationHint(`Looks good — ${count} field${count === 1 ? '' : 's'}.`);
    } catch {
      setValidationHint('JSON is malformed — fix syntax before saving.');
    }
  }, [schemaText]);

  function onCreated(createdKey: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `content-type:${createdKey}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/cms/types/${createdKey}`);
    router.refresh();
  }

  // Unsaved-changes guard. "Dirty" is "the user changed anything from the seeded
  // initial values" (the form may be prefilled when duplicating a type) — guard a
  // Cancel / Close / Switch / backdrop so typed work isn't silently dropped.
  const dirty =
    key.trim() !== (initial?.key ?? '') ||
    name.trim() !== (initial?.name ?? '') ||
    pluralName.trim() !== (initial?.pluralName ?? '') ||
    description.trim() !== (initial?.description ?? '') ||
    urlPattern.trim() !== (initial?.urlPattern ?? '') ||
    schemaText !== (initial?.schema ?? SAMPLE_SCHEMA) ||
    isSingleton !== (initial?.isSingleton ?? false);

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'content type' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path and, through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/cms/types');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function submit() {
    setError(null);
    if (!key.trim() || !name.trim() || !pluralName.trim()) {
      setError('Key, name, and plural name are required.');
      return;
    }
    const data = new FormData();
    data.append('key', key.trim());
    data.append('name', name.trim());
    data.append('plural_name', pluralName.trim());
    data.append('description', description);
    data.append('url_pattern', urlPattern);
    data.append('schema', schemaText);
    if (isSingleton) data.append('is_singleton', 'on');
    startTransition(async () => {
      const result = await createContentType(data);
      if (!result.ok) {
        setError(result.error ?? 'Could not create content type.');
        return;
      }
      onCreated(result.data!.key);
    });
  }

  return (
    <ModuleProvider module="cms" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New content type"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Content type',
            supporting:
              'Define a tenant-specific authoring shape — testimonials, case studies, events, anything. The schema validates against the same FieldDef union the platform uses for built-ins.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create content type',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <div className="flex flex-col gap-5">
            <Card>
              <CardBody>
                <h3 className="text-xl font-semibold">Identity</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-row gap-3">
                    <div className="flex flex-1 flex-col gap-1">
                      <Label htmlFor="key" required>
                        Key
                      </Label>
                      <Input
                        id="key"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="case_study"
                        required
                        aria-required
                      />
                      <p className="text-base-content/70 text-xs">
                        Immutable URL-safe identifier (lowercase, underscores).
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label htmlFor="name" required>
                        Name
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Case study"
                        required
                        aria-required
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <Label htmlFor="plural_name" required>
                        Plural
                      </Label>
                      <Input
                        id="plural_name"
                        value={pluralName}
                        onChange={(e) => setPluralName(e.target.value)}
                        placeholder="Case studies"
                        required
                        aria-required
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Optional short note shown in the dashboard listing."
                    />
                  </div>
                  <div className="flex flex-row gap-3">
                    <div className="flex flex-1 flex-col gap-1">
                      <Label htmlFor="url_pattern">URL pattern (optional)</Label>
                      <Input
                        id="url_pattern"
                        value={urlPattern}
                        onChange={(e) => setUrlPattern(e.target.value)}
                        placeholder="/case-studies/{slug}"
                      />
                      <p className="text-base-content/70 text-xs">
                        Leave blank for non-routable types (referenced from other entries).
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="is_singleton">Singleton?</Label>
                      <div className="flex flex-row items-center gap-2">
                        <Checkbox
                          id="is_singleton"
                          checked={isSingleton}
                          onChange={(e) => setIsSingleton(e.target.checked)}
                        />
                        <p className="text-base-content/70 text-xs">
                          Only one entry of this type can ever exist.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="text-xl font-semibold">Schema</h3>
                <p className="opacity-70">
                  JSON object with a <code>fields</code> array. Each field is one of:{' '}
                  <code>text</code>, <code>long_text</code>, <code>rich_text</code>,{' '}
                  <code>slug</code>, <code>number</code>, <code>boolean</code>, <code>date</code>,{' '}
                  <code>datetime</code>, <code>enum</code>, <code>url</code>, <code>email</code>,{' '}
                  <code>reference</code>, <code>asset</code>, <code>object</code>,{' '}
                  <code>repeater</code>.
                </p>
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={schemaText}
                    onChange={(e) => setSchemaText(e.target.value)}
                    rows={20}
                    className="font-mono text-xs"
                    aria-label="Schema JSON"
                  />
                  {validationHint && (
                    <p
                      className={`text-xs ${
                        validationHint.startsWith('Looks good')
                          ? 'text-base-content/70'
                          : 'text-danger'
                      }`}
                      aria-live="polite"
                    >
                      {validationHint}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
            {error && (
              <p className="text-danger text-sm" role="alert" aria-live="polite">
                {error}
              </p>
            )}
          </div>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
