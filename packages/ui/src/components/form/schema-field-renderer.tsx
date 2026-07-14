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

import * as React from 'react';
import { Checkbox } from '../primitives/checkbox';
import { Input } from './input';
import { Label } from '../primitives/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Stack } from '../layout/stack';
import { Text } from '../primitives/text';
import { Textarea } from './textarea';

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
        <FieldControl
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

interface FieldControlProps {
  field: SimpleField;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}

function FieldControl({ field, value, error, onChange, disabled }: FieldControlProps) {
  const id = `sfr-${field.key}`;

  if (field.type === 'boolean') {
    return (
      <Stack gap={1}>
        <Stack direction="row" align="center" gap={2}>
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(next) => onChange(next === true)}
            disabled={disabled}
          />
          <Label htmlFor={id} required={field.required}>
            {field.label}
          </Label>
        </Stack>
        {field.helpText && (
          <Text size="xs" variant="muted">
            {field.helpText}
          </Text>
        )}
        {error && (
          <Text size="xs" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  if (field.type === 'select') {
    const strVal = typeof value === 'string' ? value : '';
    // Radix's SelectItem forbids an empty-string value (it's reserved to mean
    // "cleared, show the placeholder"), but an "(unspecified)" option with
    // value: '' is a normal thing for a caller's schema to want. Map it to an
    // internal sentinel so the external contract (option value '' = unset)
    // still works without crashing the whole form on mount.
    const UNSET = '__sfr_unset__';
    const toRadix = (v: string) => (v === '' ? UNSET : v);
    const fromRadix = (v: string) => (v === UNSET ? '' : v);
    return (
      <Stack gap={1}>
        <Label htmlFor={id} required={field.required}>
          {field.label}
        </Label>
        <Select
          value={toRadix(strVal)}
          onValueChange={(v) => onChange(fromRadix(v))}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue
              placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}…`}
            />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={toRadix(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {field.helpText && (
          <Text size="xs" variant="muted">
            {field.helpText}
          </Text>
        )}
        {error && (
          <Text size="xs" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  if (field.type === 'textarea') {
    const strVal = typeof value === 'string' ? value : '';
    return (
      <Stack gap={1}>
        <Label htmlFor={id} required={field.required}>
          {field.label}
        </Label>
        <Textarea
          id={id}
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
        />
        {field.helpText && (
          <Text size="xs" variant="muted">
            {field.helpText}
          </Text>
        )}
        {error && (
          <Text size="xs" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  // text / number / date / datetime-local / email / url / tel
  const inputType =
    field.type === 'number'
      ? 'number'
      : field.type === 'date'
        ? 'date'
        : field.type === 'datetime-local'
          ? 'datetime-local'
          : field.type === 'email'
            ? 'email'
            : field.type === 'url'
              ? 'url'
              : field.type === 'tel'
                ? 'tel'
                : 'text';

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
    <Stack gap={1}>
      <Label htmlFor={id} required={field.required}>
        {field.label}
      </Label>
      <Input
        id={id}
        type={inputType}
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
      {field.helpText && (
        <Text size="xs" variant="muted">
          {field.helpText}
        </Text>
      )}
      {error && (
        <Text size="xs" variant="danger" role="alert">
          {error}
        </Text>
      )}
    </Stack>
  );
}
