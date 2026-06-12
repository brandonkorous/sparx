'use client';

// Action editor — the ordered list of effects an automation runs (docs/81 §5.4).
//
// Each action is a typed `type` + an opaque `config` bag; per-action config is
// validated at DISPATCH by the executing service, not here. So the editor offers:
//   • a type picker limited to actions with a registered executor whose module is
//     active (deferred actions aren't offered — but an existing one still renders);
//   • first-class config fields for picker-free configs (wait, tags, note, internal
//     email, webhook, dunning thresholds, …);
//   • a raw-JSON config mode — both the editor for ID-bearing/union configs
//     (create_task assignee, deal stage, send_campaign) and a universal escape
//     hatch on every action. JSON round-trips losslessly; it's the honest surface
//     for a config the client can't safely type-check.

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
  Textarea,
} from '@sparx/ui';
import { ArrowDown, ArrowUp, Code2, Plus, Trash2 } from 'lucide-react';
import type { Action } from '@sparx/automation-schemas';
import {
  actionDef,
  availableActions,
  moduleLabel,
  primitiveText,
  type ActionConfigField,
  type ActionDef,
} from '../_lib/catalog';

type Config = Record<string, unknown>;

function stringifyJson(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

/** A textarea whose buffer is local; commits the parsed value on every valid
 *  edit, shows an error otherwise. Re-initialised from props by remounting via a
 *  `key` (callers key it on action index + type/field) — no prop-sync effect. */
function JsonField({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [text, setText] = React.useState(() => stringifyJson(value));
  const [error, setError] = React.useState<string | null>(null);

  function handle(next: string) {
    setText(next);
    if (next.trim() === '') {
      setError(null);
      onChange(undefined);
      return;
    }
    try {
      onChange(JSON.parse(next));
      setError(null);
    } catch {
      setError('Invalid JSON');
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        value={text}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => handle(e.target.value)}
        className="font-mono text-xs"
      />
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}

function setKey(config: Config, key: string, val: unknown): Config {
  const next = { ...config };
  const empty =
    val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
  if (empty) delete next[key];
  else next[key] = val;
  return next;
}

function FieldInput({
  field,
  config,
  onConfig,
  fieldKey,
}: {
  field: ActionConfigField;
  config: Config;
  onConfig: (next: Config) => void;
  /** Stable remount key for the JSON sub-field. */
  fieldKey: string;
}) {
  const raw = config[field.key];

  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          value={typeof raw === 'string' ? raw : ''}
          rows={3}
          placeholder={field.placeholder}
          onChange={(e) => onConfig(setKey(config, field.key, e.target.value))}
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          value={primitiveText(raw)}
          placeholder={field.placeholder}
          onChange={(e) =>
            onConfig(setKey(config, field.key, e.target.value === '' ? undefined : Number(e.target.value)))
          }
        />
      );
    case 'tags':
      return (
        <Input
          value={Array.isArray(raw) ? raw.join(', ') : ''}
          placeholder="vip, fleet"
          onChange={(e) =>
            onConfig(
              setKey(
                config,
                field.key,
                e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
              )
            )
          }
        />
      );
    case 'select':
      return (
        <Select
          value={typeof raw === 'string' ? raw : ''}
          onValueChange={(v) => onConfig(setKey(config, field.key, v))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'json':
      return (
        <JsonField
          key={fieldKey}
          value={raw}
          rows={3}
          placeholder={field.placeholder}
          onChange={(v) => onConfig(setKey(config, field.key, v))}
        />
      );
    case 'email':
      return (
        <Input
          type="email"
          value={typeof raw === 'string' ? raw : ''}
          placeholder="ops@example.com"
          onChange={(e) => onConfig(setKey(config, field.key, e.target.value))}
        />
      );
    default:
      return (
        <Input
          value={primitiveText(raw)}
          placeholder={field.placeholder}
          onChange={(e) => onConfig(setKey(config, field.key, e.target.value))}
        />
      );
  }
}

function ActionCard({
  action,
  index,
  total,
  enabledModules,
  onChange,
  onRemove,
  onMove,
}: {
  action: Action;
  index: number;
  total: number;
  enabledModules: readonly string[];
  onChange: (next: Action) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const def = actionDef(action.type);
  const [jsonMode, setJsonMode] = React.useState(def?.mode === 'json');

  // Type options: every offerable action + the current type if it's not offerable
  // (a deferred/unavailable action still renders so the rule round-trips).
  const offerable = availableActions(enabledModules);
  const options: ActionDef[] = offerable.some((a) => a.type === action.type)
    ? offerable
    : def
      ? [def, ...offerable]
      : offerable;

  function changeType(type: string) {
    const nextDef = actionDef(type);
    onChange({ type: type as Action['type'], config: nextDef?.jsonTemplate ?? {} });
    setJsonMode(nextDef?.mode === 'json');
  }

  const config = (action.config ?? {}) as Config;
  const forcedJson = def?.mode === 'json';
  const showJson = jsonMode || forcedJson;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border-default)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-xs font-medium">
            {index + 1}
          </span>
          <Select value={action.type} onValueChange={changeType}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.type} value={o.type}>
                  {moduleLabel(o.module)} · {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          {!forcedJson && (
            <Button
              type="button"
              variant={jsonMode ? 'soft' : 'ghost'}
              size="sm"
              onClick={() => setJsonMode((v) => !v)}
              leftIcon={<Code2 className="h-3.5 w-3.5" />}
              aria-label="Edit config as JSON"
            >
              JSON
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            color="danger"
            onClick={onRemove}
            aria-label="Remove action"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {def?.description && (
        <p className="text-xs text-[var(--color-text-tertiary)]">{def.description}</p>
      )}
      {def && !def.available && (
        <p className="text-xs text-[var(--color-warning)]">
          This action has no runtime executor yet — it won’t run until its module ships support.
        </p>
      )}

      {showJson ? (
        <div className="flex flex-col gap-1">
          <Label>Config (JSON)</Label>
          <JsonField
            key={`${index}:${action.type}:full`}
            value={config}
            rows={5}
            onChange={(v) =>
              onChange({ ...action, config: (v ?? {}) as Config })
            }
          />
        </div>
      ) : def?.mode === 'fields' && def.configFields ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {def.configFields.map((field) => (
            <div
              key={field.key}
              className={`flex flex-col gap-1.5 ${field.type === 'textarea' || field.type === 'json' ? 'sm:col-span-2' : ''}`}
            >
              <Label>
                {field.label}
                {field.required && <span className="text-[var(--color-danger)]"> *</span>}
              </Label>
              <FieldInput
                field={field}
                config={config}
                onConfig={(next) => onChange({ ...action, config: next })}
                fieldKey={`${index}:${action.type}:${field.key}`}
              />
              {field.help && (
                <span className="text-xs text-[var(--color-text-tertiary)]">{field.help}</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface Props {
  value: Action[];
  onChange: (next: Action[]) => void;
  enabledModules: readonly string[];
}

export function ActionEditor({ value, onChange, enabledModules }: Props) {
  function addAction() {
    const first = availableActions(enabledModules)[0];
    const type = first?.type ?? 'platform.stop';
    onChange([...value, { type, config: first?.jsonTemplate ?? {} }]);
  }

  function updateAction(index: number, next: Action) {
    onChange(value.map((a, i) => (i === index ? next : a)));
  }

  function removeAction(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function moveAction(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          No actions yet — add at least one effect to run.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {value.map((a, i) => (
            <ActionCard
              key={i}
              action={a}
              index={i}
              total={value.length}
              enabledModules={enabledModules}
              onChange={(next) => updateAction(i, next)}
              onRemove={() => removeAction(i)}
              onMove={(dir) => moveAction(i, dir)}
            />
          ))}
        </div>
      )}
      <div>
        <Button
          type="button"
          variant="soft"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={addAction}
        >
          Add action
        </Button>
      </div>
    </div>
  );
}
