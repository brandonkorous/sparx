'use client';

// The editor that opens under one detail row: its name, kind, hint, and the
// settings that only some kinds have.

import {
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Switch,
} from '@wizeworks/silicaui-react';
import { CurrencyField } from '../../components/currency-field';
import {
  ADVANCED_FIELD_TYPES,
  COMMON_FIELD_TYPES,
  FIELD_TYPE_HINTS,
  FIELD_TYPE_LABELS,
  keyFromLabel,
  type PropertyField,
  type PropertyFieldType,
} from './object-types-data';
import { EnumOptionsEditor } from './object-type-enum-options';

interface FieldEditorProps {
  field: PropertyField;
  onChange: (next: PropertyField) => void;
}

export function FieldRowEditor({ field, onChange }: FieldEditorProps) {
  return (
    <div className="mt-3 flex flex-col gap-3 border-t pt-3">
      <FieldNameInput field={field} onChange={onChange} />
      <FieldKindSelect field={field} onChange={onChange} />
      <FieldHintInput field={field} onChange={onChange} />

      {field.type === 'enum' ? <EnumOptionsEditor field={field} onChange={onChange} /> : null}

      {field.type === 'calculated' ? (
        <FieldExpressionInput field={field} onChange={onChange} />
      ) : null}

      {field.type === 'currency' ? (
        <CurrencyField
          required
          value={field.currency ?? 'USD'}
          onChange={(next) => {
            onChange({ ...field, currency: next });
          }}
          description="Every amount saved in this detail is in this currency."
        />
      ) : null}

      {field.type !== 'calculated' ? (
        <FieldRequiredSwitch field={field} onChange={onChange} />
      ) : null}
    </div>
  );
}

function FieldNameInput({ field, onChange }: FieldEditorProps) {
  return (
    <Field>
      <FieldLabel>What you call it</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={field.label}
            onChange={(e) => {
              const label = e.target.value;
              onChange({
                ...field,
                label,
                // The key follows the label only while it still matches —
                // once someone has data under a key, renaming the label
                // must not silently orphan it.
                key: field.key === keyFromLabel(field.label) ? keyFromLabel(label) : field.key,
              });
            }}
          />
        }
      />
      <FieldDescription>Saved as {field.key || '—'}</FieldDescription>
    </Field>
  );
}

function FieldKindSelect({ field, onChange }: FieldEditorProps) {
  return (
    <Field>
      <FieldLabel>What kind of detail</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            value={field.type}
            onChange={(e) => {
              onChange({ ...field, type: e.target.value as PropertyFieldType });
            }}
          >
            <optgroup label="Everyday">
              {COMMON_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </optgroup>
            <optgroup label="More">
              {ADVANCED_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </optgroup>
          </NativeSelect>
        }
      />
      <FieldDescription>{FIELD_TYPE_HINTS[field.type]}</FieldDescription>
    </Field>
  );
}

function FieldHintInput({ field, onChange }: FieldEditorProps) {
  return (
    <Field>
      <FieldLabel>Hint shown under it</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={field.helpText ?? ''}
            placeholder="The date the cover runs out."
            onChange={(e) => {
              onChange({ ...field, helpText: e.target.value || undefined });
            }}
          />
        }
      />
    </Field>
  );
}

function FieldExpressionInput({ field, onChange }: FieldEditorProps) {
  return (
    <Field>
      <FieldLabel>How to work it out</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            value={field.expression ?? ''}
            placeholder="price - cost"
            onChange={(e) => {
              onChange({ ...field, expression: e.target.value });
            }}
          />
        }
      />
      <FieldDescription>
        Use the short names of the other details, with + − × (as *) and ÷ (as /). Brackets work. So
        does round(…, 2).
      </FieldDescription>
    </Field>
  );
}

function FieldRequiredSwitch({ field, onChange }: FieldEditorProps) {
  return (
    <Field>
      <FieldLabel>Must be filled in</FieldLabel>
      <FieldControl
        render={
          <Switch
            color="module"
            checked={field.required === true}
            onCheckedChange={(next: boolean) => {
              onChange({ ...field, required: next || undefined });
            }}
          />
        }
      />
    </Field>
  );
}
