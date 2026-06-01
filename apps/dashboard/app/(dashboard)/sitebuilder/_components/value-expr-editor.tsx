'use client';

// Value-expression + condition leaf editors for the Section Studio visual tree
// builder (docs/38 Phase C; Section Studio increment 6).
//
// A template prop value is a ValueExpr: a string literal, a single `$bind` to a
// scope path, or a `$concat` of those (the closed grammar in section-template.ts).
// These controls edit one ValueExpr / Condition over a known binding scope, so the
// author never hand-writes a `$bind` path string. The scope (which field.* /
// item.* / ctx.* / product.* paths are legal here) is computed by the tree editor
// at the node's location and threaded down.

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
import { Plus, Trash2 } from 'lucide-react';
import type {
  BindExpr,
  Condition,
  SectionField,
  ValueExpr,
  ValueFormat,
} from '@sparx/sitebuilder-schemas';

// The binding paths legal at a given point in the template tree.
export interface BindScope {
  /** Top-level config fields (`field.*`). */
  fields: SectionField[];
  /** Innermost enclosing Repeater item fields (`item.*`), or null outside one. */
  itemFields: SectionField[] | null;
  /** Inside a Repeater? Enables `item.*` and `index`. */
  inRepeater: boolean;
  /** A bound section may resolve `product.*` / `collection.*`. */
  binding: 'product' | 'collection' | null;
}

const CTX_PATHS = [
  { value: 'currency', label: 'Currency' },
  { value: 'locale', label: 'Locale' },
  { value: 'tenantSlug', label: 'Store slug' },
];
const FORMATS: { value: ValueFormat; label: string }[] = [
  { value: 'none', label: 'Plain' },
  { value: 'money', label: 'Money' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
];

type Root = 'field' | 'item' | 'index' | 'ctx' | 'product' | 'collection';

function splitPath(path: string): { root: Root | ''; rest: string } {
  if (path === 'index') return { root: 'index', rest: '' };
  const dot = path.indexOf('.');
  if (dot === -1) return { root: (path as Root) || '', rest: '' };
  return { root: path.slice(0, dot) as Root, rest: path.slice(dot + 1) };
}

// A sensible starting path when switching a value into bind mode / changing root.
function defaultPathForRoot(root: Root, scope: BindScope): string {
  switch (root) {
    case 'field':
      return `field.${scope.fields[0]?.key ?? ''}`;
    case 'item':
      return `item.${scope.itemFields?.[0]?.key ?? ''}`;
    case 'index':
      return 'index';
    case 'ctx':
      return 'ctx.currency';
    case 'product':
      return 'product.title';
    case 'collection':
      return 'collection.title';
  }
}

function defaultBindPath(scope: BindScope): string {
  if (scope.fields[0]) return `field.${scope.fields[0].key}`;
  return 'ctx.currency';
}

// Edits a single `$bind` scope path against the legal roots + declared keys.
function BindPathPicker({
  scope,
  value,
  onChange,
}: {
  scope: BindScope;
  value: string;
  onChange: (path: string) => void;
}) {
  const { root, rest } = splitPath(value);
  const roots: { value: Root; label: string }[] = [
    { value: 'field', label: 'Field' },
    ...(scope.inRepeater
      ? ([
          { value: 'item', label: 'Item' },
          { value: 'index', label: 'Index' },
        ] as { value: Root; label: string }[])
      : []),
    { value: 'ctx', label: 'Context' },
    ...(scope.binding === 'product'
      ? ([{ value: 'product', label: 'Product' }] as { value: Root; label: string }[])
      : []),
    ...(scope.binding === 'collection'
      ? ([{ value: 'collection', label: 'Collection' }] as { value: Root; label: string }[])
      : []),
  ];
  const activeRoot: Root = root && roots.some((r) => r.value === root) ? root : 'field';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={activeRoot}
        onValueChange={(v) => onChange(defaultPathForRoot(v as Root, scope))}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roots.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeRoot === 'field' ? (
        <KeySelect fields={scope.fields} value={rest} onChange={(k) => onChange(`field.${k}`)} />
      ) : null}
      {activeRoot === 'item' ? (
        <KeySelect
          fields={scope.itemFields ?? []}
          value={rest}
          onChange={(k) => onChange(`item.${k}`)}
        />
      ) : null}
      {activeRoot === 'ctx' ? (
        <Select value={rest || 'currency'} onValueChange={(v) => onChange(`ctx.${v}`)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CTX_PATHS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {activeRoot === 'product' || activeRoot === 'collection' ? (
        <Input
          aria-label="Property path"
          className="w-40 font-mono text-sm"
          placeholder="price"
          value={rest}
          onChange={(e) => onChange(`${activeRoot}.${e.target.value}`)}
        />
      ) : null}
    </div>
  );
}

// A select of field keys (shown by label) — used for field.* and item.* roots.
function KeySelect({
  fields,
  value,
  onChange,
}: {
  fields: SectionField[];
  value: string;
  onChange: (key: string) => void;
}) {
  if (fields.length === 0) {
    return <span className="text-xs text-[var(--color-text-muted)]">No fields declared</span>;
  }
  const active = fields.some((f) => f.key === value) ? value : fields[0]!.key;
  return (
    <Select value={active} onValueChange={onChange}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {fields.map((f) => (
          <SelectItem key={f.key} value={f.key}>
            {f.label || f.key}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Mode = 'text' | 'bind' | 'concat';

function modeOf(value: ValueExpr | undefined): Mode {
  if (value == null || typeof value === 'string') return 'text';
  if ('$bind' in value) return 'bind';
  return 'concat';
}

/**
 * Edits one ValueExpr (literal | $bind | $concat). `depth > 0` (a concat part)
 * hides the Concat option so the grammar stays one level of concat deep, matching
 * how the renderer reads it.
 */
export function ValueExprField({
  label,
  scope,
  value,
  onChange,
  depth = 0,
}: {
  label?: string;
  scope: BindScope;
  value: ValueExpr | undefined;
  onChange: (v: ValueExpr) => void;
  depth?: number;
}) {
  const mode = modeOf(value);

  const setMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'text') onChange(typeof value === 'string' ? value : '');
    else if (next === 'bind') onChange({ $bind: defaultBindPath(scope) });
    else onChange({ $concat: [value ?? ''] });
  };

  const modes: { value: Mode; label: string }[] = [
    { value: 'text', label: 'Text' },
    { value: 'bind', label: 'Binding' },
    ...(depth === 0 ? [{ value: 'concat' as Mode, label: 'Joined' }] : []),
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <Label className="text-xs text-[var(--color-text-muted)]">{label}</Label>
        ) : (
          <span />
        )}
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modes.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === 'text' ? (
        <Input
          aria-label={label ?? 'Text value'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}

      {mode === 'bind' && value && typeof value === 'object' && '$bind' in value ? (
        <BindEditor scope={scope} value={value} onChange={onChange} />
      ) : null}

      {mode === 'concat' && value && typeof value === 'object' && '$concat' in value ? (
        <ConcatEditor
          scope={scope}
          value={value.$concat}
          onChange={(parts) => onChange({ $concat: parts })}
        />
      ) : null}
    </div>
  );
}

// The $bind controls: the scope path plus an optional fallback + formatter.
function BindEditor({
  scope,
  value,
  onChange,
}: {
  scope: BindScope;
  value: BindExpr;
  onChange: (v: BindExpr) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-[var(--color-bg-subtle)] p-2.5">
      <BindPathPicker
        scope={scope}
        value={value.$bind}
        onChange={(path) => onChange({ ...value, $bind: path })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Fallback"
          className="h-8 flex-1 text-sm"
          placeholder="Fallback if empty (optional)"
          value={value.default ?? ''}
          onChange={(e) => {
            const next = { ...value };
            const v = e.target.value;
            if (v) next.default = v;
            else delete next.default;
            onChange(next);
          }}
        />
        <Select
          value={value.format ?? 'none'}
          onValueChange={(v) => {
            const next = { ...value };
            if (v === 'none') delete next.format;
            else next.format = v as ValueFormat;
            onChange(next);
          }}
        >
          <SelectTrigger className="h-8 w-28 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// A $concat: an ordered list of parts, each a text/bind ValueExpr.
function ConcatEditor({
  scope,
  value,
  onChange,
}: {
  scope: BindScope;
  value: ValueExpr[];
  onChange: (parts: ValueExpr[]) => void;
}) {
  const setPart = (i: number, v: ValueExpr) => onChange(value.map((p, idx) => (idx === i ? v : p)));
  const removePart = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="flex flex-col gap-2 rounded-md bg-[var(--color-bg-subtle)] p-2.5">
      {value.map((part, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            <ValueExprField scope={scope} value={part} onChange={(v) => setPart(i, v)} depth={1} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removePart(i)}
            aria-label="Remove part"
            disabled={value.length <= 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => onChange([...value, ''])}
      >
        <Plus className="h-4 w-4" />
        Add part
      </Button>
    </div>
  );
}

/** Edits an `If` condition: `$exists` (truthy/non-empty) or `$eq` (path equals a value). */
export function ConditionEditor({
  scope,
  value,
  onChange,
}: {
  scope: BindScope;
  value: Condition;
  onChange: (c: Condition) => void;
}) {
  const kind: 'exists' | 'eq' = '$exists' in value ? 'exists' : 'eq';
  const path = '$exists' in value ? value.$exists : value.$eq[0];
  const expected = '$eq' in value ? value.$eq[1] : '';

  const setKind = (next: 'exists' | 'eq') => {
    if (next === kind) return;
    if (next === 'exists') onChange({ $exists: path });
    else onChange({ $eq: [path, typeof expected === 'string' ? expected : String(expected)] });
  };
  const setPath = (p: string) =>
    onChange(kind === 'exists' ? { $exists: p } : { $eq: [p, expected] });

  return (
    <div className="flex flex-col gap-2 rounded-md bg-[var(--color-bg-subtle)] p-2.5">
      <div className="flex items-center gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as 'exists' | 'eq')}>
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exists">Is set</SelectItem>
            <SelectItem value="eq">Equals</SelectItem>
          </SelectContent>
        </Select>
        {kind === 'eq' ? (
          <Input
            aria-label="Equals value"
            className="h-8 flex-1 text-sm"
            placeholder="value"
            value={typeof expected === 'string' ? expected : String(expected)}
            onChange={(e) => onChange({ $eq: [path, e.target.value] })}
          />
        ) : null}
      </div>
      <BindPathPicker scope={scope} value={path} onChange={setPath} />
    </div>
  );
}
