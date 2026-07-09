'use client';

// Per-action config editor — rendered in the inspector when an Action step is
// selected (docs/81 §5.4). An action is a typed `type` + an opaque `config` bag;
// per-action config is validated at DISPATCH by the executing service, not here.
// So this offers:
//   • a type picker limited to actions with a registered executor whose module is
//     active (deferred actions aren't offered for a NEW pick — but an existing one
//     still renders so the rule round-trips);
//   • first-class config fields for picker-free configs (wait, tags, note, internal
//     email, webhook, …);
//   • a raw-JSON config mode — both the editor for ID-bearing/union configs
//     (create_task assignee, deal stage, send_campaign) and a universal escape
//     hatch on every action. JSON round-trips losslessly.
//
// The card chrome comes from inspector-primitives; this file owns only the action
// controls. Extracted from the former action-editor.tsx (whose DnD list moved to
// the flow canvas).

import * as React from 'react';
import { Button, Input, Select, Textarea } from '@wizeworks/silicaui-react';
import { Code2, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Action } from '@sparx/automation-schemas';

import {
  actionDef,
  availableActions,
  moduleLabel,
  primitiveText,
  type ActionConfigField,
  type ActionDef,
} from '../_lib/catalog';
import { actionIcon } from '../_lib/flow';
import { NODE_ICONS } from './node-icons';
import { Field, InspectorCard, Segmented } from './inspector-primitives';

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
 *  `key` (callers key it on the action id + type/field) — no prop-sync effect. */
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
      {error && <span className="text-danger text-xs">{error}</span>}
    </div>
  );
}

function setKey(config: Config, key: string, val: unknown): Config {
  const next = { ...config };
  const empty = val === undefined || val === '' || (Array.isArray(val) && val.length === 0);
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
            onConfig(
              setKey(config, field.key, e.target.value === '' ? undefined : Number(e.target.value))
            )
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
          items={(field.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
          placeholder="Choose…"
        />
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

export function ActionConfigEditor({
  action,
  actionId,
  enabledModules,
  onChange,
  onRemove,
}: {
  action: Action;
  /** Stable id — remounts the JSON sub-fields when the selected action changes. */
  actionId: string;
  enabledModules: readonly string[];
  onChange: (next: Action) => void;
  onRemove: () => void;
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
  const ActionGlyph = NODE_ICONS[actionIcon(action)];

  return (
    <>
      <InspectorCard
        icon={ActionGlyph}
        title="Action"
        summary={def ? `${moduleLabel(def.module)} · ${def.label}` : action.type}
        caption={def?.description}
      >
        <Field label="Type">
          <Select
            value={action.type}
            onValueChange={(v) => changeType(v as string)}
            items={options.map((o) => ({
              value: o.type,
              label: `${moduleLabel(o.module)} · ${o.label}`,
            }))}
          />
        </Field>

        {!forcedJson && (
          <Field label="Edit as">
            <Segmented
              ariaLabel="Edit config as fields or JSON"
              value={jsonMode ? 'json' : 'fields'}
              onChange={(v) => setJsonMode(v === 'json')}
              options={[
                { value: 'fields', label: 'Fields' },
                {
                  value: 'json',
                  label: (
                    <>
                      <Code2 aria-hidden /> JSON
                    </>
                  ),
                },
              ]}
            />
          </Field>
        )}

        {def && !def.available && (
          <p className="ax-ins-warn">
            This action has no runtime executor yet — it won’t run until its module ships support.
          </p>
        )}
      </InspectorCard>

      <InspectorCard icon={SlidersHorizontal} title="Configuration">
        {showJson ? (
          <Field label="Config (JSON)">
            <JsonField
              key={`${actionId}:${action.type}:full`}
              value={config}
              rows={6}
              onChange={(v) => onChange({ ...action, config: (v ?? {}) as Config })}
            />
          </Field>
        ) : def?.mode === 'fields' && def.configFields ? (
          def.configFields.map((field) => (
            <Field key={field.key} label={field.label} required={field.required} hint={field.help}>
              <FieldInput
                field={field}
                config={config}
                onConfig={(next) => onChange({ ...action, config: next })}
                fieldKey={`${actionId}:${action.type}:${field.key}`}
              />
            </Field>
          ))
        ) : (
          <p className="ax-card__caption">This action takes no configuration.</p>
        )}
      </InspectorCard>

      <div className="ax-danger-row">
        <Button
          type="button"
          variant="outline"
          color="danger"
          iconStart={<Trash2 className="h-3.5 w-3.5" />}
          onClick={onRemove}
          className="w-full justify-center"
        >
          Remove this step
        </Button>
      </div>
    </>
  );
}
