'use client';

// Generic schema-driven field renderer for wizard steps.
//
// Handles simple, statically-typed fields (text, textarea, number, boolean,
// select, date, email, url, phone). Does NOT depend on @sparx/cms-schemas —
// the caller passes a SimpleField[] that maps to these primitives.
//
// Used by: CMS content wizard (Publish Settings step), B2B Account wizard,
// Customer wizard. Complex CMS fields (rich_text, asset, reference) are
// rendered by the app-level FieldRenderer which can import @sparx/cms-editor.
//
// Every row is silica's `<Field>`: it wires label ↔ control ↔ description ↔
// error together (ids, aria-describedby, validity), and `status` +
// `statusMessage` drive the control's accent, its trailing icon, and the
// message panel from ONE place. That replaces what this file used to do by
// hand — a `<Label>`, a muted help `<Text>`, a danger `<Text role="alert">`,
// and an `error` variant threaded onto the control — four call-site decisions
// that had to agree with each other on every field.

import * as React from 'react';
import {
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Input,
  Select,
  Textarea,
} from '@wizeworks/silicaui-react';
import { Stack } from '../layout/stack';

// ─── Field shape ────────────────────────────────────────────────────────────

export type SimpleFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'url'
  | 'tel';

export interface SimpleField {
  key: string;
  label: string;
  type: SimpleFieldType;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  /** For `select` fields. */
  options?: { value: string; label: string }[];
  min?: number | string;
  max?: number | string;
}

export interface SchemaFieldRendererProps {
  fields: SimpleField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SchemaFieldRenderer({
  fields,
  values,
  onChange,
  errors,
  disabled,
  className,
}: SchemaFieldRendererProps) {
  return (
    <Stack gap={4} className={className}>
      {fields.map((field) => (
        <SimpleFieldControl
          key={field.key}
          field={field}
          value={values[field.key]}
          error={errors?.[field.key]}
          onChange={(v) => onChange(field.key, v)}
          disabled={disabled}
        />
      ))}
    </Stack>
  );
}

// ─── Single field control ────────────────────────────────────────────────────

interface SimpleFieldControlProps {
  field: SimpleField;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}

const INPUT_TYPE: Partial<Record<SimpleFieldType, React.HTMLInputTypeAttribute>> = {
  number: 'number',
  date: 'date',
  'datetime-local': 'datetime-local',
  email: 'email',
  url: 'url',
  tel: 'tel',
};

function SimpleFieldControl({ field, value, error, onChange, disabled }: SimpleFieldControlProps) {
  const id = `sfr-${field.key}`;
  // One shape for every row: status + message on the Field, everything under it
  // inherits. `undefined` status leaves the control at its resting accent.
  const status = error ? ('error' as const) : undefined;

  if (field.type === 'boolean') {
    return (
      // A checkbox has no bordered control for the status panel to attach to,
      // so the message renders as a plain colored row (silica's own guidance
      // for checkbox/switch/radio).
      <Field status={status} disabled={disabled}>
        <Stack direction="row" align="center" gap={2}>
          <Checkbox
            id={id}
            color="module"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          <FieldLabel htmlFor={id} required={field.required}>
            {field.label}
          </FieldLabel>
        </Stack>
        {field.helpText && <FieldDescription>{field.helpText}</FieldDescription>}
        {error && (
          <FieldStatus attached={false} role="alert">
            {error}
          </FieldStatus>
        )}
      </Field>
    );
  }

  if (field.type === 'select') {
    const strVal = typeof value === 'string' ? value : '';
    // Base UI reserves `null` for "nothing selected", so an option whose value
    // is the empty string is a legal item and needs no sentinel — the mapping
    // is only between '' (the caller's "unset") and null (silica's).
    const items = Object.fromEntries((field.options ?? []).map((o) => [o.value, o.label]));
    return (
      <Field status={status} statusMessage={error} disabled={disabled}>
        <FieldLabel htmlFor={id} required={field.required}>
          {field.label}
        </FieldLabel>
        <Select
          id={id}
          items={items}
          value={strVal === '' ? null : strVal}
          // Every key in `items` is a string, so anything else (including the
          // `null` silica sends on clear) means "unset".
          onValueChange={(v) => onChange(typeof v === 'string' ? v : '')}
          placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}…`}
          disabled={disabled}
        />
        {field.helpText && <FieldDescription>{field.helpText}</FieldDescription>}
      </Field>
    );
  }

  if (field.type === 'textarea') {
    return (
      <Field status={status} statusMessage={error} disabled={disabled}>
        <FieldLabel htmlFor={id} required={field.required}>
          {field.label}
        </FieldLabel>
        <FieldControl
          id={id}
          render={<Textarea rows={4} />}
          value={typeof value === 'string' ? value : ''}
          // `FieldControl` types its event against HTMLInputElement whatever it
          // renders, so let inference stand rather than annotate a textarea
          // event it would reject — `.value` is on both element types.
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
        {field.helpText && <FieldDescription>{field.helpText}</FieldDescription>}
      </Field>
    );
  }

  // text / number / date / datetime-local / email / url / tel
  const strVal =
    field.type === 'number'
      ? typeof value === 'number'
        ? String(value)
        : typeof value === 'string'
          ? value
          : ''
      : typeof value === 'string'
        ? value
        : '';

  return (
    <Field status={status} statusMessage={error} disabled={disabled}>
      <FieldLabel htmlFor={id} required={field.required}>
        {field.label}
      </FieldLabel>
      <FieldControl
        id={id}
        render={<Input />}
        type={INPUT_TYPE[field.type] ?? 'text'}
        value={strVal}
        onChange={(e) =>
          onChange(
            field.type === 'number'
              ? e.target.value === ''
                ? ''
                : Number(e.target.value)
              : e.target.value
          )
        }
        placeholder={field.placeholder}
        disabled={disabled}
        min={field.min}
        max={field.max}
      />
      {field.helpText && <FieldDescription>{field.helpText}</FieldDescription>}
    </Field>
  );
}
