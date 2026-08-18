'use client';

// "More details" — the extra fields THIS business tracks on a record.
//
// One panel, dropped onto every CRM detail pane (customer, company, deal, and
// Phase 4's request). It reads the object's property schema and turns it into
// controls — so a business that added "Warranty expires" to their customers gets
// a date picker on every customer, with no code written for them. That is the
// whole point of docs/144 §3, and this file is where a tenant finally SEES it.
//
// IT RENDERS NOTHING WHEN THERE IS NOTHING. A business that has declared no
// extra details must not meet an empty panel headed "More details" asking them
// to imagine what could go in it — the panel simply is not there.
//
// THE WIRING RULE, borrowed from the CMS body editor it is a sibling of: this
// file never touches the record. It is handed the bag and a setter for the bag,
// and each control is handed ONE value and a setter for it. A field three levels
// deep inside a repeater never has to know it is three levels deep.

import { useMemo } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import { Plus, Trash2 } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { usePropertySchema, type PropertyField, type PropertySchema } from './object-types-data';

export interface CustomPropertiesPanelProps {
  /** contact | company | deal | ticket, or a custom object key. */
  objectKey: string;
  /** The record's stored bag. */
  values: Record<string, unknown>;
  /** Called with the WHOLE next bag — the pane owns the draft. */
  onChange: (next: Record<string, unknown>) => void;
  /** Read-only rendering, for a transaction record nobody edits in place. */
  readOnly?: boolean;
  /** Heading override. Defaults to the plain-language "More details". */
  title?: string;
}

export function CustomPropertiesPanel({
  objectKey,
  values,
  onChange,
  readOnly,
  title = 'More details',
}: CustomPropertiesPanelProps) {
  const fields = usePropertySchema(objectKey);

  // Nothing declared → no panel. See the header note.
  if (fields.length === 0) return null;

  return (
    <FormSection title={title} description="The extra details you chose to track on these records.">
      <PropertyFields fields={fields} values={values} onChange={onChange} readOnly={readOnly} />
    </FormSection>
  );
}

/** A list of fields against one bag. Recurses for `object` and `repeater`. */
export function PropertyFields({
  fields,
  values,
  onChange,
  readOnly,
}: {
  fields: PropertyField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const set = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => (
        <PropertyControl
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(next) => {
            set(field.key, next);
          }}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

/* ── One control ────────────────────────────────────────────────────────── */

function PropertyControl({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PropertyField;
  value: unknown;
  onChange: (next: unknown) => void;
  readOnly?: boolean;
}) {
  // Worked out by the server — shown, never typed. Editable would be a lie:
  // whatever was typed is overwritten on save.
  if (field.type === 'calculated') {
    return (
      <Field>
        <FieldLabel>{field.label}</FieldLabel>
        <p className="font-mono text-sm tabular-nums">{formatCalculated(value, field)}</p>
        <FieldDescription>
          {field.helpText ?? 'Worked out from the other details. You do not fill this in.'}
        </FieldDescription>
      </Field>
    );
  }

  if (field.type === 'object') {
    const inner = asBag(value);
    return (
      <div className="border-base-300 rounded-box flex flex-col gap-3 border p-3">
        <p className="font-medium">{field.label}</p>
        {field.helpText ? <p className="text-sm">{field.helpText}</p> : null}
        <PropertyFields
          fields={field.fields ?? []}
          values={inner}
          onChange={onChange}
          readOnly={readOnly}
        />
      </div>
    );
  }

  if (field.type === 'repeater') {
    return <RepeaterControl field={field} value={value} onChange={onChange} readOnly={readOnly} />;
  }

  return (
    <Field>
      <FieldLabel>
        {field.label}
        {field.required ? <span className="text-danger"> *</span> : null}
      </FieldLabel>
      <FieldControl
        render={
          <ScalarControl field={field} value={value} onChange={onChange} readOnly={readOnly} />
        }
      />
      {field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null}
    </Field>
  );
}

/**
 * The control for one declared property.
 *
 * EVERY BRANCH CARRIES ITS OWN `aria-label`, and that is not redundant with the
 * `<FieldLabel>` above it. Base UI wires a label to a control by cloning the
 * element passed to `FieldControl render=` with the ids it minted — but this is
 * a component, not an element, so those props land on `ScalarControl` and stop
 * there. Every custom property on every contact, deal, company, request and
 * tenant-invented record was therefore announced as an unnamed edit box.
 *
 * Naming the control directly also survives the composite branches, where there
 * is no single element for a label to point at: money is a currency code beside
 * an input, and a multi-choice is a row of buttons.
 */
function ScalarControl({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PropertyField;
  value: unknown;
  onChange: (next: unknown) => void;
  readOnly?: boolean;
}) {
  const disabled = readOnly === true;

  switch (field.type) {
    case 'long_text':
      return (
        <Textarea
          color="module"
          aria-label={field.label}
          rows={field.rows ?? 3}
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(e) => {
            onChange(e.target.value === '' ? null : e.target.value);
          }}
        />
      );

    case 'rich_text':
      // Deliberately a plain textarea here rather than the block editor: this is
      // a side panel on a record, not an authoring surface, and pulling the CMS
      // editor into every CRM detail pane would cost far more than it gives.
      return (
        <Textarea
          color="module"
          aria-label={field.label}
          rows={field.rows ?? 4}
          disabled={disabled}
          value={richTextToPlain(value)}
          onChange={(e) => {
            onChange(plainToRichText(e.target.value));
          }}
        />
      );

    case 'boolean':
      return (
        <Switch
          color="module"
          aria-label={field.label}
          disabled={disabled}
          checked={value === true}
          onCheckedChange={(next: boolean) => {
            onChange(next);
          }}
        />
      );

    case 'enum': {
      const options = field.options ?? [];
      if (field.multiple) {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div role="group" aria-label={field.label} className="flex flex-wrap gap-2">
            {options.map((option) => {
              const on = selected.includes(option.value);
              return (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  disabled={disabled}
                  color={on ? 'module' : 'neutral'}
                  variant={on ? 'solid' : 'outline'}
                  onClick={() => {
                    onChange(
                      on ? selected.filter((v) => v !== option.value) : [...selected, option.value]
                    );
                  }}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        );
      }
      return (
        <NativeSelect
          color="module"
          aria-label={field.label}
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            onChange(e.target.value === '' ? null : e.target.value);
          }}
        >
          <option value="">Not set</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      );
    }

    case 'number':
      return (
        <Input
          color="module"
          aria-label={field.label}
          type="number"
          disabled={disabled}
          value={typeof value === 'number' ? String(value) : ''}
          step={field.integer ? 1 : 'any'}
          min={field.min}
          max={field.max}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? null : Number(raw));
          }}
        />
      );

    case 'currency': {
      const money = asMoney(value, field.currency ?? 'USD');
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{money.currency}</span>
          <Input
            color="module"
            aria-label={field.label}
            type="number"
            step="any"
            disabled={disabled}
            value={money.amount === null ? '' : String(money.amount)}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === '' ? null : { amount: Number(raw), currency: money.currency });
            }}
          />
        </div>
      );
    }

    case 'date':
      return (
        <Input
          color="module"
          aria-label={field.label}
          type="date"
          disabled={disabled}
          value={typeof value === 'string' ? value.slice(0, 10) : ''}
          onChange={(e) => {
            onChange(e.target.value === '' ? null : e.target.value);
          }}
        />
      );

    case 'datetime':
      return (
        <Input
          color="module"
          aria-label={field.label}
          type="datetime-local"
          disabled={disabled}
          value={toLocalInput(value)}
          onChange={(e) => {
            onChange(e.target.value === '' ? null : new Date(e.target.value).toISOString());
          }}
        />
      );

    case 'email':
      return (
        <Input
          color="module"
          aria-label={field.label}
          type="email"
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            onChange(e.target.value === '' ? null : e.target.value);
          }}
        />
      );

    case 'url':
      return (
        <Input
          color="module"
          aria-label={field.label}
          type="url"
          disabled={disabled}
          placeholder="https://"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            onChange(e.target.value === '' ? null : e.target.value);
          }}
        />
      );

    default:
      // text, slug, reference, asset, user — all a single line today. The last
      // three want their own pickers, and get them when the association panel
      // (Phase 2) and the media picker are wired in.
      return (
        <Input
          color="module"
          aria-label={field.label}
          disabled={disabled}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            onChange(e.target.value === '' ? null : e.target.value);
          }}
        />
      );
  }
}

/* ── Repeater ───────────────────────────────────────────────────────────── */

function RepeaterControl({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: PropertyField;
  value: unknown;
  onChange: (next: unknown) => void;
  readOnly?: boolean;
}) {
  const rows = useMemo(
    () => (Array.isArray(value) ? (value as Record<string, unknown>[]) : []),
    [value]
  );
  const itemLabel = field.itemLabel ?? 'entry';
  const atMax = field.max !== undefined && rows.length >= field.max;

  return (
    <div className="border-base-300 rounded-box flex flex-col gap-3 border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">{field.label}</p>
        <span className="text-sm">
          {rows.length} {rows.length === 1 ? itemLabel : `${itemLabel}s`}
        </span>
      </div>
      {field.helpText ? <p className="text-sm">{field.helpText}</p> : null}

      {rows.map((row, index) => (
        <div key={index} className="border-base-300 rounded-box flex flex-col gap-3 border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {itemLabel} {index + 1}
            </p>
            {readOnly ? null : (
              <Button
                type="button"
                size="sm"
                color="danger"
                variant="ghost"
                aria-label={`Remove ${itemLabel} ${index + 1}`}
                onClick={() => {
                  onChange(rows.filter((_, i) => i !== index));
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
          <PropertyFields
            fields={field.fields ?? []}
            values={row}
            onChange={(next) => {
              onChange(rows.map((r, i) => (i === index ? next : r)));
            }}
            readOnly={readOnly}
          />
        </div>
      ))}

      {readOnly || atMax ? null : (
        <Button
          type="button"
          size="sm"
          color="module"
          variant="outline"
          onClick={() => {
            onChange([...rows, {}]);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add {itemLabel}
        </Button>
      )}
    </div>
  );
}

/* ── Value coercion ─────────────────────────────────────────────────────── */

function asBag(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asMoney(
  value: unknown,
  fallbackCurrency: string
): { amount: number | null; currency: string } {
  if (value && typeof value === 'object' && 'amount' in value) {
    const money = value as { amount?: unknown; currency?: unknown };
    return {
      amount: typeof money.amount === 'number' ? money.amount : null,
      currency: typeof money.currency === 'string' ? money.currency : fallbackCurrency,
    };
  }
  return { amount: null, currency: fallbackCurrency };
}

function formatCalculated(value: unknown, field: PropertyField): string {
  if (value == null) return '—';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object' && 'amount' in value) {
    const money = value as { amount?: unknown; currency?: unknown };
    if (typeof money.amount !== 'number') return '—';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: typeof money.currency === 'string' ? money.currency : (field.currency ?? 'USD'),
    }).format(money.amount);
  }
  return '—';
}

/** The rich-text document shape, flattened to text and back. */
function richTextToPlain(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'content' in value) {
    const doc = value as { content?: { content?: { text?: string }[] }[] };
    return (doc.content ?? [])
      .map((block) => (block.content ?? []).map((leaf) => leaf.text ?? '').join(''))
      .join('\n');
  }
  return '';
}

function plainToRichText(text: string): PropertySchema | null | Record<string, unknown> {
  if (text.trim() === '') return null;
  return {
    type: 'doc',
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      content: line === '' ? [] : [{ type: 'text', text: line }],
    })),
  };
}

/** Local-datetime input wants `YYYY-MM-DDTHH:mm`, not an ISO string with a zone. */
function toLocalInput(value: unknown): string {
  if (typeof value !== 'string') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
