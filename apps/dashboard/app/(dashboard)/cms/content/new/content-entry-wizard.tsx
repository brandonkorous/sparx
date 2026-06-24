'use client';

// CMS content-entry creation wizard (docs/68 Phase B-4, docs/86 SurfaceFrame).
// The one-shot content wizard — not just the required fields: create the entry
// AND everything that usually rides with it, without leaving the flow.
// Steps:
//   1. Type     — pick a content type (skipped when a type is pre-supplied)
//   2. Fields   — fill required fields via ContentEntryForm (controlled)
//   3. Author & media — attribute to an author (pick or create on the fly) +
//                  add the type's optional images (upload or pick existing)
//   4. Publish  — status (draft / published / scheduled) + slug
//
// Presentation: the `/new` route renders the full-screen `page` variant; the
// content list opens it inside the dashboard's drawer/modal detail chrome
// (`overlay` → SurfaceFrame `inline`), picked by the user's `defaultDetailView`.
// On finish: createEntry → navigates to the new entry's detail page.

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  SchemaFieldRenderer,
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';
import type { FieldDef } from '@sparx/cms-schemas';
import { CheckCircle2, FileText } from 'lucide-react';

import { createEntry, getTypeSchema } from '../../types/actions';
import { createAuthor } from '../../authors/actions';
import { ContentEntryForm } from '../../_components/content-entry-form';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TypeSummary {
  key: string;
  name: string;
  plural_name: string;
  description: string | null;
  is_singleton: boolean;
}

interface TypeSchema {
  key: string;
  name: string;
  url_pattern: string | null;
  schema_json: { fields: FieldDef[] };
}

/** A CMS author, fetched server-side and passed in so the Author & media step
 *  can offer attribution without a client fetch. Inline-created authors are
 *  appended to this list client-side. */
export interface AuthorOption {
  id: string;
  displayName: string;
}

export interface ContentEntryWizardProps {
  types: TypeSummary[];
  /** Pre-fetched schema when the URL already has ?type=X (page surface only). */
  preselectedType?: TypeSchema;
  /** `'page'` = full-screen `/new` route; `'overlay'` = inside the dashboard
   *  drawer/modal detail chrome (the `defaultDetailView` preference picks which). */
  presentation?: 'page' | 'overlay';
  /** The tenant's CMS authors for the optional attribution. Empty is fine — the
   *  author card then offers only "create new". */
  authors?: AuthorOption[];
}

// ─── Steps & rail copy ──────────────────────────────────────────────────────────

type StepKey = 'type' | 'fields' | 'meta' | 'publish';

const STEP_DEFS: Record<StepKey, SurfaceStepDef> = {
  type: { key: 'type', label: 'Type', sublabel: 'Choose a type' },
  fields: { key: 'fields', label: 'Fields', sublabel: 'Required fields' },
  meta: { key: 'meta', label: 'Author & media', sublabel: 'Attribution & images' },
  publish: { key: 'publish', label: 'Publish', sublabel: 'Visibility' },
};

const RAIL: Record<StepKey, { title: string; blurb: string; context?: string }> = {
  type: {
    title: 'What are you creating?',
    blurb: 'Pick a content type. Types define the schema — fields, validation, and URL patterns.',
    context: 'Choose a type to begin.',
  },
  fields: {
    title: 'Fill the essentials',
    blurb: 'Just the required fields for now — everything else is editable after creation.',
    context: 'Only required fields are shown here.',
  },
  meta: {
    title: 'Author & media',
    blurb:
      'Attribute the content to an author and add its imagery — create an author or upload media right here.',
    context: 'All optional — pick, create, or skip.',
  },
  publish: {
    title: 'Publish settings',
    blurb: 'Choose when this entry goes live, and its URL slug if the type has one.',
    context: 'Draft saves without going live.',
  },
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft — save but not visible on the site' },
  { value: 'published', label: 'Published — live immediately' },
  { value: 'scheduled', label: 'Scheduled — go live on a specific date' },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContentEntryWizard(props: ContentEntryWizardProps) {
  return (
    <ModuleProvider module="cms" className="h-full">
      <ContentEntryWizardInner {...props} />
    </ModuleProvider>
  );
}

function ContentEntryWizardInner({
  types,
  preselectedType,
  presentation = 'page',
  authors = [],
}: ContentEntryWizardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // If a type was pre-selected, skip the Type step.
  const hasTypeStep = !preselectedType;
  const stepOrder: StepKey[] = hasTypeStep
    ? ['type', 'fields', 'meta', 'publish']
    : ['fields', 'meta', 'publish'];
  const steps: SurfaceStepDef[] = stepOrder.map((k) => STEP_DEFS[k]);

  const [stepKey, setStepKey] = React.useState<StepKey>(stepOrder[0] ?? 'fields');
  const current = Math.max(
    0,
    steps.findIndex((s) => s.key === stepKey)
  );

  const [selectedTypeKey, setSelectedTypeKey] = React.useState<string | null>(
    preselectedType?.key ?? null
  );
  const [typeSchema, setTypeSchema] = React.useState<TypeSchema | null>(preselectedType ?? null);
  const [loadingSchema, setLoadingSchema] = React.useState(false);

  const [body, setBody] = React.useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [status, setStatus] = React.useState<'draft' | 'published' | 'scheduled'>('draft');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);

  // Author & media step — author attribution (sets content_entries.author_id)
  // with inline create; the type's optional asset fields ride the same `body`.
  const [authorsList, setAuthorsList] = React.useState<AuthorOption[]>(authors);
  const [authorId, setAuthorId] = React.useState<string>('');
  const [creatingAuthor, setCreatingAuthor] = React.useState(false);
  const [newAuthorName, setNewAuthorName] = React.useState('');
  const [authorBusy, setAuthorBusy] = React.useState(false);
  const [authorError, setAuthorError] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function goToStep(key: StepKey) {
    setError(null);
    setStepKey(key);
  }

  const close = React.useCallback(() => {
    if (presentation === 'overlay') {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/cms/content');
    }
  }, [presentation, pathname, searchParams, router]);

  // Sync slug from body `title`/`name` when not manually touched.
  React.useEffect(() => {
    if (slugTouched) return;
    const titleLike =
      typeof body.title === 'string' ? body.title : typeof body.name === 'string' ? body.name : '';
    if (titleLike) setSlug(slugify(titleLike));
  }, [body, slugTouched]);

  // ── Step 1: select type ───────────────────────────────────────────────────────

  async function selectType(typeKey: string) {
    setSelectedTypeKey(typeKey);
    setLoadingSchema(true);
    setError(null);
    try {
      const result = await getTypeSchema(typeKey);
      if (!result.ok || !result.data) throw new Error(result.error ?? 'Failed to load schema');
      setTypeSchema(result.data as TypeSchema);
      setStepKey('fields');
    } catch {
      setError('Could not load the content type. Please try again.');
    } finally {
      setLoadingSchema(false);
    }
  }

  // ── Author & media step: create an author inline ───────────────────────────────

  async function createAuthorInline() {
    const name = newAuthorName.trim();
    if (!name) {
      setAuthorError('Enter a display name.');
      return;
    }
    setAuthorBusy(true);
    setAuthorError(null);
    try {
      const fd = new FormData();
      fd.set('display_name', name);
      const res = await createAuthor(fd);
      if (res.ok && res.data?.id) {
        const created: AuthorOption = { id: res.data.id, displayName: name };
        setAuthorsList((prev) =>
          [...prev, created].sort((a, b) => a.displayName.localeCompare(b.displayName))
        );
        setAuthorId(created.id);
        setCreatingAuthor(false);
        setNewAuthorName('');
      } else {
        setAuthorError(res.error ?? 'Could not create the author.');
      }
    } catch {
      setAuthorError('Could not create the author.');
    } finally {
      setAuthorBusy(false);
    }
  }

  // ── Step 2: validate required fields ───────────────────────────────────────────

  function validateFields(): boolean {
    if (!typeSchema) return false;
    const errs: Record<string, string> = {};
    for (const field of typeSchema.schema_json.fields) {
      if (!field.required) continue;
      const val = body[field.key];
      if (
        val === undefined ||
        val === null ||
        val === '' ||
        (typeof val === 'object' &&
          val !== null &&
          (val as { type?: string }).type === 'doc' &&
          !(val as { content?: unknown[] }).content?.length)
      ) {
        errs[field.key] = `${field.label} is required.`;
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function commitFields() {
    if (!validateFields()) return;
    setFieldErrors({});
    goToStep('meta');
  }

  // ── Step 3: submit ─────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!typeSchema || !selectedTypeKey) return;
    setError(null);
    setSubmitting(true);
    try {
      const hasUrlPattern = !!typeSchema.url_pattern;
      const submitSlug = hasUrlPattern && slug.trim() ? slug.trim() : undefined;
      const finalBody: Record<string, unknown> = { ...body };
      if (status === 'scheduled' && scheduledAt) {
        finalBody.__scheduled_at = scheduledAt;
      }
      const result = await createEntry(
        selectedTypeKey,
        finalBody,
        submitSlug,
        authorId || undefined
      );
      if (result.ok && result.data?.id) {
        router.push(`/cms/types/${selectedTypeKey}/${result.data.id}`);
        router.refresh();
        return;
      }
      setError(typeof result.error === 'string' ? result.error : 'Could not create entry.');
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step bodies ──────────────────────────────────────────────────────────────

  const typeStep = (
    <SurfaceStep
      header={{
        title: 'Choose a content type',
        supporting: 'Types define the schema — fields, validation, and URL patterns.',
      }}
    >
      <div className="flex flex-col gap-4">
        {loadingSchema && (
          <Text size="sm" variant="muted">
            Loading schema…
          </Text>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {types
            .filter((t) => !t.is_singleton)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={loadingSchema}
                onClick={() => void selectType(t.key)}
                className="group rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-left transition-colors hover:border-[var(--module-active)] hover:bg-[var(--module-active-tint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--module-active)] disabled:opacity-50"
              >
                <Stack gap={2}>
                  <Stack direction="row" align="center" gap={2}>
                    <FileText className="h-4 w-4 text-[var(--module-active)]" />
                    <Text className="font-medium">{t.name}</Text>
                  </Stack>
                  {t.description && (
                    <Text size="xs" variant="muted" className="line-clamp-2">
                      {t.description}
                    </Text>
                  )}
                </Stack>
              </button>
            ))}
        </div>
        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </SurfaceStep>
  );

  const fieldsStep = typeSchema && (
    <SurfaceStep
      header={{
        title: `${typeSchema.name} details`,
        supporting:
          'Fill in the required fields. You can add or edit every field after the entry exists.',
      }}
      actions={{
        onBack: hasTypeStep ? () => goToStep('type') : undefined,
        onNext: commitFields,
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-4">
        {typeSchema.schema_json.fields.filter((f) => f.required).length === 0 && (
          <Stack
            direction="row"
            align="center"
            gap={2}
            className="rounded-md bg-[var(--color-success-subtle)] px-3 py-2"
          >
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
            <Text size="sm">
              This content type has no required fields — continue to publish settings.
            </Text>
          </Stack>
        )}

        <ContentEntryForm
          schema={{ fields: typeSchema.schema_json.fields.filter((f) => f.required) }}
          body={body}
          onBodyChange={(next) => setBody(next)}
          autoDeriveSlugs
        />

        {Object.keys(fieldErrors).length > 0 && (
          <Text size="sm" variant="danger" role="alert">
            Please fix the errors above before continuing.
          </Text>
        )}
      </div>
    </SurfaceStep>
  );

  // The type's optional asset fields (images/files) — surfaced in the Author &
  // media step so a one-shot create can attach media without re-opening the
  // entry. Required assets stay in the Fields step's essentials.
  const assetFields = (typeSchema?.schema_json.fields ?? []).filter(
    (f): f is Extract<FieldDef, { type: 'asset' }> => f.type === 'asset' && !f.required
  );

  const metaStep = typeSchema && (
    <SurfaceStep
      header={{
        title: 'Author & media',
        supporting:
          'Attribute this content to an author and add its imagery — all optional, all editable later.',
      }}
      actions={{
        onBack: () => goToStep('fields'),
        onNext: () => goToStep('publish'),
        nextLabel: 'Continue',
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Author</Heading>
          </CardHeader>
          <CardContent>
            {creatingAuthor ? (
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="cw-author-name">Display name</Label>
                  <Input
                    id="cw-author-name"
                    value={newAuthorName}
                    onChange={(e) => setNewAuthorName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                  />
                </div>
                <Stack direction="row" align="center" gap={2}>
                  <Button
                    type="button"
                    color="module"
                    size="sm"
                    onClick={() => void createAuthorInline()}
                    loading={authorBusy}
                    disabled={authorBusy || !newAuthorName.trim()}
                  >
                    Create author
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    onClick={() => {
                      setCreatingAuthor(false);
                      setNewAuthorName('');
                      setAuthorError(null);
                    }}
                    disabled={authorBusy}
                  >
                    Cancel
                  </Button>
                </Stack>
                {authorError && (
                  <Text size="sm" variant="danger" role="alert">
                    {authorError}
                  </Text>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Text size="sm" variant="muted">
                  Attribute this content to an author, or create one on the fly. Optional.
                </Text>
                <div>
                  <Label htmlFor="cw-author">Author</Label>
                  <NativeSelect
                    id="cw-author"
                    value={authorId}
                    onChange={(e) => setAuthorId(e.target.value)}
                  >
                    <option value="">No author</option>
                    {authorsList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.displayName}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <button
                  type="button"
                  className="self-start text-sm text-[var(--module-active)] underline-offset-4 hover:underline"
                  onClick={() => {
                    setCreatingAuthor(true);
                    setAuthorError(null);
                  }}
                >
                  + New author
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {assetFields.length > 0 && (
          <Card variant="module">
            <CardHeader>
              <Heading level={3}>Media</Heading>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Text size="sm" variant="muted">
                  Add images and files — upload new or pick from your library.
                </Text>
                <ContentEntryForm
                  schema={{ fields: assetFields }}
                  body={body}
                  onBodyChange={(next) => setBody(next)}
                  autoDeriveSlugs={false}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </SurfaceStep>
  );

  const publishStep = typeSchema && (
    <SurfaceStep
      header={{
        title: 'Publish settings',
        supporting: `Choose when this ${typeSchema.name.toLowerCase()} goes live.`,
      }}
      actions={{
        onBack: () => goToStep('meta'),
        onNext: () => void handleSubmit(),
        nextLabel:
          status === 'published' ? 'Publish' : status === 'scheduled' ? 'Schedule' : 'Create draft',
        nextLoading: submitting,
        nextDisabled: submitting,
      }}
    >
      <div className="flex flex-col gap-5">
        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Visibility</Heading>
          </CardHeader>
          <CardContent>
            <SchemaFieldRenderer
              fields={[
                {
                  key: 'status',
                  label: 'Status',
                  type: 'select',
                  required: true,
                  options: STATUS_OPTIONS,
                },
              ]}
              values={{ status }}
              onChange={(_k, v) => setStatus(v as 'draft' | 'published' | 'scheduled')}
            />
            {status === 'scheduled' && (
              <Stack gap={1} className="mt-4">
                <Label htmlFor="wizard-scheduled-at">Publish on</Label>
                <Input
                  id="wizard-scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </Stack>
            )}
          </CardContent>
        </Card>

        {typeSchema.url_pattern && (
          <Card variant="module">
            <CardHeader>
              <Heading level={3}>URL</Heading>
            </CardHeader>
            <CardContent>
              <Stack gap={1}>
                <Label htmlFor="wizard-slug">
                  Slug
                  <Badge variant="soft" color="neutral" className="ml-2 font-mono text-xs">
                    {typeSchema.url_pattern.replace('{slug}', slug || '…')}
                  </Badge>
                </Label>
                <Input
                  id="wizard-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugTouched(true);
                  }}
                  placeholder="my-entry-slug"
                />
                <Text size="xs" variant="muted">
                  Auto-derived from the title. Edit to customise.
                </Text>
              </Stack>
            </CardContent>
          </Card>
        )}

        {error && (
          <Text size="sm" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </div>
    </SurfaceStep>
  );

  let body_: React.ReactNode;
  if (stepKey === 'type') body_ = typeStep;
  else if (stepKey === 'fields') body_ = fieldsStep;
  else if (stepKey === 'meta') body_ = metaStep;
  else body_ = publishStep;

  // ── Frame ──────────────────────────────────────────────────────────────────

  const onStepSelect = (key: string) => {
    const target = steps.findIndex((s) => s.key === key);
    if (target >= 0 && target <= current) goToStep(key as StepKey);
  };
  const canSelectStep = (_key: string, index: number) => index <= current;

  // One top-stepper frame for both presentations: `embedded` fills the dashboard
  // content area at `/new` (sidebar + header stay); `inline` fills the drawer/
  // modal detail panel, which supplies its own chrome.
  return (
    <SurfaceFrame
      variant={presentation === 'overlay' ? 'inline' : 'embedded'}
      title="New content"
      steps={steps}
      current={current}
      context={RAIL[stepKey].context}
      onStepSelect={onStepSelect}
      canSelectStep={canSelectStep}
      onCancel={close}
    >
      {body_}
    </SurfaceFrame>
  );
}
