'use client';

// CMS content-entry creation wizard (docs/68 Phase B-4).
// 3 steps:
//   1. Type     — pick a content type (skipped if typeKey is pre-supplied)
//   2. Fields   — fill in required fields via ContentEntryForm (controlled)
//   3. Publish  — set status (draft / published / scheduled) + slug
//
// On finish: calls createEntry → navigates to the new entry's detail page.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Input,
  Label,
  SchemaFieldRenderer,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Stepper,
  Text,
} from '@sparx/ui';
import type { FieldDef } from '@sparx/cms-schemas';
import { CheckCircle2, FileText } from 'lucide-react';

import { api } from '@/lib/api-rest-client';
import { createEntry } from '../../types/actions';
import { ContentEntryForm, applyFieldChange } from '../../_components/content-entry-form';

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

interface ContentEntryWizardProps {
  types: TypeSummary[];
  /** Pre-fetched schema when the URL already has ?type=X. */
  preselectedType?: TypeSchema;
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS_WITH_TYPE = [{ label: 'Type' }, { label: 'Fields' }, { label: 'Publish' }];
const STEPS_WITHOUT_TYPE = [{ label: 'Fields' }, { label: 'Publish' }];

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

export function ContentEntryWizard({ types, preselectedType }: ContentEntryWizardProps) {
  const router = useRouter();

  // If a type was pre-selected, skip the Type step.
  const hasTypeStep = !preselectedType;
  const steps = hasTypeStep ? STEPS_WITH_TYPE : STEPS_WITHOUT_TYPE;

  const [step, setStep] = React.useState(0);
  const [selectedTypeKey, setSelectedTypeKey] = React.useState<string | null>(
    preselectedType?.key ?? null
  );
  const [typeSchema, setTypeSchema] = React.useState<TypeSchema | null>(preselectedType ?? null);
  const [loadingSchema, setLoadingSchema] = React.useState(false);

  // Step 2 — body keyed by field.key
  const [body, setBody] = React.useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Step 3 — publish settings
  const [status, setStatus] = React.useState<'draft' | 'published' | 'scheduled'>('draft');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Map step index to logical name
  type StepName = 'type' | 'fields' | 'publish';
  const stepName: StepName = (() => {
    if (hasTypeStep) {
      if (step === 0) return 'type';
      if (step === 1) return 'fields';
      return 'publish';
    }
    if (step === 0) return 'fields';
    return 'publish';
  })();

  // Sync slug from body `title` or `name` when not manually touched
  React.useEffect(() => {
    if (slugTouched) return;
    const titleLike =
      typeof body.title === 'string'
        ? body.title
        : typeof body.name === 'string'
          ? body.name
          : '';
    if (titleLike) setSlug(slugify(titleLike));
  }, [body, slugTouched]);

  // ── Step 1: select type ───────────────────────────────────────────────────

  async function selectType(typeKey: string) {
    setSelectedTypeKey(typeKey);
    setLoadingSchema(true);
    try {
      const schema = await api.get<TypeSchema>(`/v1/content/types/${encodeURIComponent(typeKey)}`);
      setTypeSchema(schema);
      setStep(1);
    } catch {
      setError('Could not load the content type. Please try again.');
    } finally {
      setLoadingSchema(false);
    }
  }

  // ── Step 2: validate required fields ─────────────────────────────────────

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

  // ── Step 3: submit ───────────────────────────────────────────────────────

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
        submitSlug
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

  function goNext() {
    if (stepName === 'fields') {
      if (!validateFields()) return;
    }
    setFieldErrors({});
    setError(null);
    setStep((s) => s + 1);
  }

  function goBack() {
    setFieldErrors({});
    setError(null);
    setStep((s) => s - 1);
  }

  const isLastStep = step === steps.length - 1;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Stack gap={6}>
      <Stepper steps={steps} current={step} />

      {/* Step 1 — Type picker */}
      {stepName === 'type' && (
        <Stack gap={4}>
          <Text variant="muted">
            Choose a content type to create a new entry for. Types define the schema — fields,
            validation, and URL patterns.
          </Text>
          {loadingSchema && (
            <Text size="sm" variant="muted">
              Loading schema…
            </Text>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {types.filter((t) => !t.is_singleton).map((t) => (
              <button
                key={t.key}
                type="button"
                disabled={loadingSchema}
                onClick={() => void selectType(t.key)}
                className="group rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-left transition-colors hover:border-[var(--color-module-active)] hover:bg-[var(--color-module-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-module-active)] disabled:opacity-50"
              >
                <Stack gap={2}>
                  <Stack direction="row" align="center" gap={2}>
                    <FileText className="h-4 w-4 text-[var(--color-module-active)]" />
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
          <Stack direction="row" gap={3}>
            <Button variant="ghost" asChild>
              <Link href="/cms/content">Cancel</Link>
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Step 2 — Required fields */}
      {stepName === 'fields' && typeSchema && (
        <Stack gap={4}>
          <Stack gap={1}>
            <Text variant="muted">
              Fill in the required fields for this {typeSchema.name.toLowerCase()}. You can add or
              edit all fields after creation.
            </Text>
            {typeSchema.schema_json.fields.filter((f) => f.required).length === 0 && (
              <Stack
                direction="row"
                align="center"
                gap={2}
                className="rounded-md bg-[var(--color-success-subtle)] px-3 py-2"
              >
                <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                <Text size="sm">
                  This content type has no required fields — jump straight to publish settings.
                </Text>
              </Stack>
            )}
          </Stack>

          <ContentEntryForm
            schema={{
              fields: typeSchema.schema_json.fields.filter((f) => f.required),
            }}
            body={body}
            onBodyChange={(next) => setBody(next)}
            autoDeriveSlugs
          />

          {Object.keys(fieldErrors).length > 0 && (
            <Text size="sm" variant="danger" role="alert">
              Please fix the errors above before continuing.
            </Text>
          )}

          <Stack direction="row" gap={3} align="center">
            {hasTypeStep ? (
              <Button variant="ghost" onClick={goBack} disabled={submitting}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/cms/content">Cancel</Link>
              </Button>
            )}
            <Button color="module" onClick={goNext} disabled={submitting}>
              Continue
            </Button>
          </Stack>
        </Stack>
      )}

      {/* Step 3 — Publish settings */}
      {stepName === 'publish' && typeSchema && (
        <Stack gap={5}>
          <Text variant="muted">
            Choose when this {typeSchema.name.toLowerCase()} goes live.
          </Text>

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
                <Stack gap={2}>
                  <Stack gap={1}>
                    <Label htmlFor="wizard-slug">
                      Slug
                      {typeSchema.url_pattern && (
                        <Badge variant="soft" color="neutral" className="ml-2 font-mono text-xs">
                          {typeSchema.url_pattern.replace('{slug}', slug || '…')}
                        </Badge>
                      )}
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
                </Stack>
              </CardContent>
            </Card>
          )}

          {error && (
            <Text size="sm" variant="danger" role="alert">
              {error}
            </Text>
          )}

          <Stack direction="row" gap={3} align="center">
            <Button variant="ghost" onClick={goBack} disabled={submitting}>
              Back
            </Button>
            <Button
              color="module"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              loading={submitting}
            >
              {status === 'published' ? 'Publish' : status === 'scheduled' ? 'Schedule' : 'Create draft'}
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
