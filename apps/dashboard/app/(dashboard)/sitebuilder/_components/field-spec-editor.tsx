'use client';

// Field-spec editor (docs/38 Phase C Section Studio §4.3). Edits a SectionField[]
// — the inspector form a custom section generates. The same descriptor FieldControl
// renders, authored here: per field a key, label, type, help, and type-specific
// extras (select options; number/range bounds; a `list` field's nested itemFields,
// one level deep). Controlled — every change reports the whole array up.

import * as React from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sparx/ui';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { SectionField, SectionFieldType } from '@sparx/sitebuilder-schemas';

const FIELD_TYPES: { value: SectionFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text area' },
  { value: 'richtext', label: 'Rich text' },
  { value: 'select', label: 'Select' },
  { value: 'number', label: 'Number' },
  { value: 'range', label: 'Range (slider)' },
  { value: 'boolean', label: 'Toggle' },
  { value: 'color', label: 'Color token' },
  { value: 'font', label: 'Font' },
  { value: 'media', label: 'Media' },
  { value: 'url', label: 'URL' },
  { value: 'collection', label: 'Collection' },
  { value: 'products', label: 'Products' },
  { value: 'list', label: 'List (repeatable)' },
];

function blankField(): SectionField {
  return { key: '', label: '', type: 'text' };
}

export interface FieldSpecEditorProps {
  value: SectionField[];
  onChange: (fields: SectionField[]) => void;
  /** Top level allows `list`; a list's nested itemFields do not (one level deep). */
  allowList?: boolean;
}

export function FieldSpecEditor({ value, onChange, allowList = true }: FieldSpecEditorProps) {
  const types = allowList ? FIELD_TYPES : FIELD_TYPES.filter((t) => t.value !== 'list');

  const patch = (i: number, p: Partial<SectionField>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    const a = next[i];
    const b = next[j];
    if (!a || !b) return;
    next[i] = b;
    next[j] = a;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {value.map((field, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-md border border-[var(--color-border-default)] p-3"
        >
          <div className="flex items-center gap-2">
            <Input
              aria-label="Field key"
              placeholder="key"
              value={field.key}
              onChange={(e) => patch(i, { key: e.target.value })}
              className="flex-1 font-mono text-sm"
            />
            <Select
              value={field.type}
              onValueChange={(v) => patch(i, { type: v as SectionFieldType })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => move(i, 1)}
              disabled={i === value.length - 1}
              aria-label="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => remove(i)} aria-label="Remove field">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <Input
            aria-label="Field label"
            placeholder="Label (shown in the inspector)"
            value={field.label}
            onChange={(e) => patch(i, { label: e.target.value })}
          />
          <Input
            aria-label="Help text"
            placeholder="Help text (optional)"
            value={field.help ?? ''}
            onChange={(e) => patch(i, { help: e.target.value || undefined })}
          />

          {field.type === 'select' ? (
            <OptionsEditor
              value={field.options ?? []}
              onChange={(options) => patch(i, { options })}
            />
          ) : null}

          {field.type === 'number' || field.type === 'range' ? (
            <div className="grid grid-cols-3 gap-2">
              <NumberInput label="Min" value={field.min} onChange={(min) => patch(i, { min })} />
              <NumberInput label="Max" value={field.max} onChange={(max) => patch(i, { max })} />
              <NumberInput
                label="Step"
                value={field.step}
                onChange={(step) => patch(i, { step })}
              />
            </div>
          ) : null}

          {field.type === 'list' && allowList ? (
            <div className="flex flex-col gap-2 rounded-md bg-[var(--color-bg-subtle)] p-2.5">
              <Input
                aria-label="Item label"
                placeholder="Item label (e.g. Feature)"
                value={field.itemLabel ?? ''}
                onChange={(e) => patch(i, { itemLabel: e.target.value || undefined })}
              />
              <Label className="text-xs text-[var(--color-text-muted)]">Item fields</Label>
              <FieldSpecEditor
                value={field.itemFields ?? []}
                onChange={(itemFields) => patch(i, { itemFields })}
                allowList={false}
              />
            </div>
          ) : null}
        </div>
      ))}

      <Button variant="outline" onClick={() => onChange([...value, blankField()])}>
        <Plus className="h-4 w-4" />
        Add field
      </Button>
    </div>
  );
}

// Edits a select field's { label, value } options.
function OptionsEditor({
  value,
  onChange,
}: {
  value: { label: string; value: string }[];
  onChange: (opts: { label: string; value: string }[]) => void;
}) {
  const patch = (i: number, p: Partial<{ label: string; value: string }>) =>
    onChange(value.map((o, idx) => (idx === i ? { ...o, ...p } : o)));
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-[var(--color-bg-subtle)] p-2.5">
      <Label className="text-xs text-[var(--color-text-muted)]">Options</Label>
      {value.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            aria-label="Option label"
            placeholder="Label"
            value={opt.label}
            onChange={(e) => patch(i, { label: e.target.value })}
            className="flex-1"
          />
          <Input
            aria-label="Option value"
            placeholder="value"
            value={opt.value}
            onChange={(e) => patch(i, { value: e.target.value })}
            className="flex-1 font-mono text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            aria-label="Remove option"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => onChange([...value, { label: '', value: '' }])}
      >
        <Plus className="h-4 w-4" />
        Add option
      </Button>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-[var(--color-text-muted)]">{label}</Label>
      <Input
        type="number"
        value={typeof value === 'number' ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </div>
  );
}
