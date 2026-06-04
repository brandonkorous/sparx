'use client';

// Schema-driven content entry form.
//
// Reads a content type's schema from the api-rest /v1/content/types
// response and renders one FieldRenderer per field. Two modes:
//   - UNCONTROLLED (create flow): owns `body` state, renders its own
//     <form> + Save button + required-field guard, calls `onSubmit`.
//   - CONTROLLED (editor): the parent passes `body` + `onBodyChange` and
//     owns submit/autosave; this renders ONLY the fields. The slug
//     auto-derivation runs in both modes via the shared `applyFieldChange`.
//
// The form stays dumb about the entry's "shell" fields (slug column,
// status, scheduled_at, SEO) — those live in the dashboard edit chrome
// around it. ContentEntryForm only ever owns the `body` JSONB.

import * as React from 'react';
import { Button, Stack, Text } from '@sparx/ui';
import type { FieldDef } from '@sparx/cms-schemas';
import { FieldRenderer } from './field-renderer';
import { Save } from 'lucide-react';

export interface ContentTypeSchema {
  fields: FieldDef[];
}

export interface ContentEntryFormProps {
  schema: ContentTypeSchema;
  /** Initial body for the UNCONTROLLED (create) mode. Ignored when controlled. */
  initialBody?: Record<string, unknown>;
  /** CONTROLLED mode: the live body. Pair with `onBodyChange`. */
  body?: Record<string, unknown>;
  /** CONTROLLED mode: called with the next body on every field change. When set
   *  (with `body`), the component renders fields only — no <form>/Save. */
  onBodyChange?: (next: Record<string, unknown>) => void;
  /** Called on submit with the validated body (UNCONTROLLED only). */
  onSubmit?: (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  /** Optional: auto-derive `slug`-typed fields from their sourceField. */
  autoDeriveSlugs?: boolean;
  /** Submit button label (UNCONTROLLED only). */
  submitLabel?: string;
  disabled?: boolean;
}

function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 255);
}

// Apply one field edit to a body, including slug auto-derivation. Pure so the
// controlled (editor) and uncontrolled (create) paths derive identically.
export function applyFieldChange(
  schema: ContentTypeSchema,
  prev: Record<string, unknown>,
  key: string,
  next: unknown,
  autoDeriveSlugs: boolean
): Record<string, unknown> {
  const nextBody = { ...prev };
  if (next === undefined) {
    delete nextBody[key];
  } else {
    nextBody[key] = next;
  }
  if (autoDeriveSlugs) {
    for (const field of schema.fields) {
      if (field.type !== 'slug' || !field.sourceField) continue;
      if (field.sourceField !== key) continue;
      const userSlug =
        typeof nextBody[field.key] === 'string' ? (nextBody[field.key] as string) : '';
      const userManuallySet = userSlug.length > 0 && userSlug !== slugifyTitle(asString(prev[key]));
      if (!userManuallySet && typeof next === 'string') {
        nextBody[field.key] = slugifyTitle(next);
      }
    }
  }
  return nextBody;
}

// The labels of required fields that are still empty in `body` — the guard
// shared by the create submit and the editor's explicit Save.
export function missingRequiredFields(
  schema: ContentTypeSchema,
  body: Record<string, unknown>
): string[] {
  return schema.fields
    .filter((f) => f.required)
    .filter((f) => isEmpty(body[f.key]))
    .map((f) => f.label);
}

export function ContentEntryForm({
  schema,
  initialBody = {},
  body: controlledBody,
  onBodyChange,
  onSubmit,
  autoDeriveSlugs = true,
  submitLabel = 'Save',
  disabled,
}: ContentEntryFormProps) {
  const controlled = controlledBody !== undefined && onBodyChange !== undefined;
  const [internalBody, setInternalBody] = React.useState<Record<string, unknown>>(initialBody);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const body = controlled ? controlledBody : internalBody;

  const updateField = React.useCallback(
    (key: string, next: unknown) => {
      const nextBody = applyFieldChange(schema, body, key, next, autoDeriveSlugs);
      if (controlled) onBodyChange(nextBody);
      else setInternalBody(nextBody);
    },
    [schema, body, autoDeriveSlugs, controlled, onBodyChange]
  );

  const fields = (
    <Stack gap={5}>
      {schema.fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={body[field.key]}
          onChange={(next) => updateField(field.key, next)}
          pathPrefix={field.key}
          disabled={Boolean(disabled) || submitting}
        />
      ))}
    </Stack>
  );

  // Controlled (editor) mode: render only the fields — the parent owns
  // submit, autosave, and status messaging.
  if (controlled) return fields;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const missing = missingRequiredFields(schema, body);
    if (missing.length) {
      setError(`Required: ${missing.join(', ')}.`);
      return;
    }
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(body);
      if (res.ok) {
        setSuccess('Saved.');
      } else {
        setError(res.error ?? 'Save failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate>
      <Stack gap={5}>
        {fields}

        {error && (
          <Text variant="danger" size="sm">
            {error}
          </Text>
        )}
        {success && (
          <Text variant="success" size="sm">
            {success}
          </Text>
        )}

        <Stack direction="row" align="center" justify="end" gap={2}>
          <Button
            type="submit"
            color="module"
            disabled={Boolean(disabled) || submitting}
            leftIcon={<Save className="h-4 w-4" />}
          >
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('type' in obj && obj.type === 'doc') {
      const content = (obj as { content?: unknown[] }).content;
      return !content || content.length === 0;
    }
    return Object.keys(obj).length === 0;
  }
  return false;
}
