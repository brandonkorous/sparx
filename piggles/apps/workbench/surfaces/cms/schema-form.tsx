'use client';

// The schema-driven body editor.
//
// A content type's `schema_json.fields` is a list of `FieldDef`s, and this file
// turns that list into a form — one control per field, chosen by the field's
// `type`. Nothing about a body is hardcoded: a business that defines a "recipe"
// type with a cook-time number and an ingredients repeater gets exactly those
// controls, because the schema said so.
//
// `object` and `repeater` recurse back into `BodyFields`, so a field can nest a
// group, and a group can hold a repeater of groups — however deep the schema
// authored it.
//
// The wiring rule: this file never touches the entry. It is handed ONE field's
// value and a setter for it, and the editor above owns the body object. That
// keeps a field three levels deep from having to know it is three levels deep.

import { useMemo } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Switch,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { faPlus, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ContentBlockEditor } from '@sparx/cms-editor/editor';
import {
  entryTitle,
  useContentEntries,
  type FieldDef,
  type ObjectFieldDef,
  type RepeaterFieldDef,
} from './data';
import { AssetField, useMediaPicker } from './media-picker';

/* ── Value readers ──────────────────────────────────────────────────────── */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

/** ISO ⇄ the `datetime-local` control's "YYYY-MM-DDTHH:mm" in the viewer's zone. */
function isoToLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function localToIso(local: string): string | undefined {
  if (local.trim() === '') return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** A body value coerced to a TipTap document for the rich-text editor, or
 *  undefined (the editor then starts from an empty document). Typed as a plain
 *  record — assignable to the editor's `CmsDoc` (which is the same shape) — so
 *  this file does not depend on that type name. */
function asDoc(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/* ── The list renderer ──────────────────────────────────────────────────── */

interface BodyFieldsProps {
  fields: FieldDef[];
  value: Record<string, unknown>;
  onChange: (key: string, next: unknown) => void;
  disabled?: boolean;
}

/** Render every field in a schema against the value object it owns. */
export function BodyFields({ fields, value, onChange, disabled }: BodyFieldsProps) {
  return (
    <>
      {fields.map((field) => (
        <SchemaField
          key={field.key}
          field={field}
          value={value[field.key]}
          onChange={(next) => {
            onChange(field.key, next);
          }}
          disabled={disabled}
        />
      ))}
    </>
  );
}

/* ── One field ──────────────────────────────────────────────────────────── */

interface SchemaFieldProps {
  field: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}

function SchemaField({ field, value, onChange, disabled }: SchemaFieldProps) {
  // Groups and repeaters are their own labelled blocks, not a single control in
  // a <Field>, so they short-circuit before the generic Field wrapper below.
  if (field.type === 'object') {
    return <ObjectField field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (field.type === 'repeater') {
    return <RepeaterField field={field} value={value} onChange={onChange} disabled={disabled} />;
  }

  const label = field.required ? `${field.label} (required)` : field.label;

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldInput field={field} value={value} onChange={onChange} disabled={disabled} />
      {field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null}
    </Field>
  );
}

/** The control for a scalar/leaf field. Groups and repeaters are handled above. */
function FieldInput({ field, value, onChange, disabled }: SchemaFieldProps) {
  switch (field.type) {
    case 'long_text':
      return (
        <FieldControl
          render={
            <Textarea
              color="module"
              rows={field.rows ?? 4}
              value={asString(value)}
              disabled={disabled}
              onChange={(event) => {
                onChange(event.target.value);
              }}
            />
          }
        />
      );

    case 'rich_text':
      // The real block editor from @sparx/cms-editor. It reads and writes the
      // exact TipTap document the content API validates and the storefront
      // renders, so rich content round-trips natively — no lossy mapping.
      return <RichTextField field={field} value={value} onChange={onChange} disabled={disabled} />;

    case 'number':
      return (
        <FieldControl
          render={
            <Input
              color="module"
              type="number"
              inputMode={field.integer ? 'numeric' : 'decimal'}
              value={typeof value === 'number' ? String(value) : asString(value)}
              disabled={disabled}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw.trim() === '') {
                  onChange(undefined);
                  return;
                }
                const parsed = Number(raw);
                onChange(Number.isFinite(parsed) ? parsed : raw);
              }}
            />
          }
        />
      );

    case 'boolean':
      return (
        <Switch
          color="module"
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(next) => {
            onChange(next);
          }}
        />
      );

    case 'date':
      return (
        <FieldControl
          render={
            <div className="max-w-[16rem]">
              <Input
                color="module"
                type="date"
                value={asString(value)}
                disabled={disabled}
                onChange={(event) => {
                  onChange(event.target.value || undefined);
                }}
              />
            </div>
          }
        />
      );

    case 'datetime':
      return (
        <FieldControl
          render={
            <div className="max-w-[18rem]">
              <Input
                color="module"
                type="datetime-local"
                value={value ? isoToLocal(asString(value)) : ''}
                disabled={disabled}
                onChange={(event) => {
                  onChange(localToIso(event.target.value));
                }}
              />
            </div>
          }
        />
      );

    case 'enum':
      return field.multiple ? (
        <ChipMultiSelect
          options={field.options}
          selected={asStringArray(value)}
          disabled={disabled}
          onChange={onChange}
        />
      ) : (
        <NativeSelect
          color="module"
          value={asString(value)}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value || undefined);
          }}
        >
          <option value="">Choose…</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      );

    case 'reference':
      return (
        <ReferenceField
          toType={field.to}
          multiple={field.multiple ?? false}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case 'asset':
      // A real media picker: pick from the library or upload, shown as a
      // thumbnail. Stores the asset id(s) the schema validates.
      return (
        <AssetField
          value={value}
          onChange={onChange}
          multiple={field.multiple ?? false}
          disabled={disabled}
        />
      );

    case 'slug':
    case 'url':
    case 'email':
    case 'text':
    default:
      return (
        <FieldControl
          render={
            <Input
              color="module"
              type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
              className={field.type === 'slug' ? 'font-mono text-sm' : undefined}
              value={asString(value)}
              disabled={disabled}
              placeholder={field.type === 'text' ? field.placeholder : undefined}
              onChange={(event) => {
                onChange(event.target.value || undefined);
              }}
            />
          }
        />
      );
  }
}

/* ── Multi-select as toggle chips ───────────────────────────────────────── */

function ChipMultiSelect({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const set = new Set(selected);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = set.has(option.value);
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={on ? 'soft' : 'outline'}
            color={on ? 'module' : 'neutral'}
            disabled={disabled}
            aria-pressed={on}
            onClick={() => {
              const next = new Set(set);
              if (on) next.delete(option.value);
              else next.add(option.value);
              onChange([...next]);
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

/* ── Rich text ──────────────────────────────────────────────────────────── */

function RichTextField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  // Isolated so the heavy TipTap editor and the media-picker context read run
  // ONLY for rich-text fields, not every scalar field in the switch.
  const pick = useMediaPicker();
  return (
    <ContentBlockEditor
      value={asDoc(value)}
      onChange={onChange}
      disabled={disabled}
      ariaLabel={field.label}
      minHeight="20rem"
      placeholder="Write here. Use the toolbar for headings, lists, links, and pictures."
      pickImage={async () => {
        const asset = await pick();
        return asset?.url ? { src: asset.url, assetId: asset.id, alt: asset.filename } : null;
      }}
    />
  );
}

/* ── Reference to other entries ─────────────────────────────────────────── */

function ReferenceField({
  toType,
  multiple,
  value,
  onChange,
  disabled,
}: {
  toType: string;
  multiple: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
  disabled?: boolean;
}) {
  // Isolated in its own component so this fetch runs ONLY for reference fields,
  // never for the scalar fields sharing the switch above.
  const { data, isPending, isError } = useContentEntries({
    type: toType,
    take: 250,
    skip: 0,
  });

  const options = useMemo(
    () => (data?.items ?? []).map((entry) => ({ value: entry.id, label: entryTitle(entry) })),
    [data]
  );

  if (isPending) {
    return (
      <Text className="text-sm" role="status">
        Loading choices…
      </Text>
    );
  }
  if (isError) {
    return <Text className="text-sm">Could not load the list to choose from.</Text>;
  }
  if (options.length === 0) {
    return <Text className="text-sm">There is nothing of this kind to link to yet.</Text>;
  }

  if (multiple) {
    return (
      <ChipMultiSelect
        options={options}
        selected={asStringArray(value)}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  return (
    <NativeSelect
      color="module"
      value={asString(value)}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value || undefined);
      }}
    >
      <option value="">Choose…</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}

/* ── Nested group ───────────────────────────────────────────────────────── */

function ObjectField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: ObjectFieldDef;
  value: unknown;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const record = asRecord(value);
  return (
    <div className="border-base-300 flex flex-col gap-4 rounded-lg border p-3">
      <div className="flex flex-col gap-0.5">
        <Heading level={3} className="text-base font-semibold">
          {field.label}
        </Heading>
        {field.helpText ? <Text className="text-sm">{field.helpText}</Text> : null}
      </div>
      <BodyFields
        fields={field.fields}
        value={record}
        disabled={disabled}
        onChange={(key, next) => {
          onChange({ ...record, [key]: next });
        }}
      />
    </div>
  );
}

/* ── Repeater of groups ─────────────────────────────────────────────────── */

function RepeaterField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: RepeaterFieldDef;
  value: unknown;
  onChange: (next: Record<string, unknown>[]) => void;
  disabled?: boolean;
}) {
  const items = asRecordArray(value);
  const itemNoun = field.itemLabel ?? 'item';

  const update = (index: number, key: string, next: unknown) => {
    const copy = items.map((item, i) => (i === index ? { ...item, [key]: next } : item));
    onChange(copy);
  };
  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };
  const add = () => {
    onChange([...items, {}]);
  };

  const atMax = field.max !== undefined && items.length >= field.max;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <Heading level={3} className="text-base font-semibold">
          {field.required ? `${field.label} (required)` : field.label}
        </Heading>
        {field.helpText ? <Text className="text-sm">{field.helpText}</Text> : null}
      </div>

      {items.length === 0 ? (
        <Text className="text-sm">No {itemNoun}s yet.</Text>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            // Index key: repeater rows have no stable id, and reordering is not
            // offered here, so positional identity is correct for this list.
            <div key={index} className="border-base-300 flex flex-col gap-4 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Text className="text-sm font-semibold">
                  {itemNoun.charAt(0).toUpperCase() + itemNoun.slice(1)} {index + 1}
                </Text>
                <Button
                  size="sm"
                  variant="ghost"
                  color="danger"
                  shape="square"
                  disabled={disabled}
                  aria-label={`Remove ${itemNoun} ${String(index + 1)}`}
                  title={`Remove this ${itemNoun}`}
                  onClick={() => {
                    remove(index);
                  }}
                >
                  <Icon glyph={faTrashCan} className="size-4" aria-hidden />
                </Button>
              </div>
              <BodyFields
                fields={field.fields}
                value={item}
                disabled={disabled}
                onChange={(key, next) => {
                  update(index, key, next);
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <Button
          size="sm"
          variant="outline"
          color="module"
          disabled={atMax || Boolean(disabled)}
          onClick={add}
        >
          <Icon glyph={faPlus} className="size-4" aria-hidden />
          Add {itemNoun}
        </Button>
        {atMax ? (
          <Text className="mt-1 text-sm">
            You have reached the most this allows ({String(field.max)}).
          </Text>
        ) : null}
      </div>
    </div>
  );
}
