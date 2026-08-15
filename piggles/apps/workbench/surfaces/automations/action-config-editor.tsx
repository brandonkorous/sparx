'use client';

// The single-action config editor — hosted in the inspector when an action node
// is selected. An action is a typed choice plus a small config form; per-action
// config is validated downstream at run time, so most actions get a typed
// mini-form while a few (IDs, unions) get a raw-JSON box, and every action can
// fall back to JSON as an escape hatch.
//
// Only actions that can actually run (a registered executor whose module is on)
// are offered for a NEW choice; an existing rule using a not-yet-available action
// still renders it, flagged, so nothing is silently dropped. Ordering, insertion
// and removal-from-the-list live on the flow canvas — this edits ONE action.

import { useState } from 'react';
import {
  Badge,
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
  Text,
  Textarea,
} from '@wizeworks/silicaui-react';
import { Code2, Trash2 } from 'lucide-react';
import type { Action } from '@sparx/automation-schemas';
import {
  actionDef,
  availableActions,
  moduleLabel,
  primitiveText,
  type ActionConfigField,
  type ActionDef,
  type ConfigOptionSource,
} from './automations-catalog';
import { useSocialOverview } from '../social/data';
import { useSequences } from '../email/sequences-data';

type Config = Record<string, unknown>;

function stringifyJson(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

/** A JSON text box whose buffer is local; commits the parsed value on every valid
 *  edit and shows an error otherwise. Re-initialised from props by remounting via
 *  a `key`, so it never needs a prop-sync effect. */
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
  const [text, setText] = useState(() => stringifyJson(value));
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        color={error ? 'error' : 'module'}
        value={text}
        rows={rows}
        placeholder={placeholder}
        className="font-mono text-sm"
        onChange={(event) => {
          const next = event.target.value;
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
            setError('This is not valid JSON yet.');
          }
        }}
      />
      {error ? <Text className="text-error text-xs">{error}</Text> : null}
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

/**
 * Pick several from a list only the server knows — today, the tenant's own connected
 * social accounts.
 *
 * Every other field type is answered by static config, which is why an automation could
 * only ever post to EVERY connected account: there was no way to name one. The empty
 * selection deliberately means "all", because that is both the previous behaviour and
 * the right default for someone who has not thought about it — narrowing is the
 * deliberate act, not broadening.
 */
function MultiSelectField({
  field,
  config,
  onConfig,
}: {
  field: ActionConfigField;
  config: Config;
  onConfig: (next: Config) => void;
}) {
  const options = useConfigOptions(field.optionSource);
  const raw = config[field.key];
  const picked = new Set(Array.isArray(raw) ? raw.map(String) : []);

  if (options.length === 0) {
    return <Text className="text-sm">{field.emptyHint ?? 'Nothing to choose from yet.'}</Text>;
  }

  const toggle = (value: string) => {
    const next = new Set(picked);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    // An empty selection is stored as "absent", so the action's own default ("every
    // enabled destination") applies rather than an empty array meaning "nowhere".
    onConfig(setKey(config, field.key, next.size > 0 ? [...next] : undefined));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = picked.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => {
              toggle(option.value);
            }}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
              on ? 'border-module bg-module bg-soft' : 'border-base-300'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** The live choices behind an `optionSource` (a `multiselect` or a live `select`).
 *  One hook, switching on source, so adding another source later is a case here
 *  rather than a new field type. Both underlying hooks are always called so hook
 *  order stays stable regardless of which source is asked for. */
function useConfigOptions(source: ConfigOptionSource | undefined): {
  value: string;
  label: string;
}[] {
  const overview = useSocialOverview();
  const sequences = useSequences();

  if (source === 'social-targets') {
    const out: { value: string; label: string }[] = [];
    for (const connection of overview.data?.connections ?? []) {
      if (connection.status !== 'active') continue;
      for (const target of connection.targets) {
        if (target.enabled) out.push({ value: target.id, label: target.name });
      }
    }
    return out;
  }

  if (source === 'email-sequences') {
    return (sequences.data ?? []).map((sequence) => ({
      value: sequence.id,
      label: sequence.name,
    }));
  }

  return [];
}

/** Pick ONE from a list only the server knows — today, the tenant's own email
 *  sequences. The static-`options` sibling of this is the `select` branch below;
 *  this is the runtime-list branch, named by {@link ActionConfigField.optionSource}. */
function DynamicSelectField({
  field,
  config,
  onConfig,
}: {
  field: ActionConfigField;
  config: Config;
  onConfig: (next: Config) => void;
}) {
  const options = useConfigOptions(field.optionSource);
  const raw = config[field.key];

  if (options.length === 0) {
    return <Text className="text-sm">{field.emptyHint ?? 'Nothing to choose from yet.'}</Text>;
  }

  return (
    <Select
      color="module"
      aria-label={field.label}
      value={typeof raw === 'string' ? raw : ''}
      items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
      placeholder="Choose…"
      onValueChange={(next) => {
        onConfig(setKey(config, field.key, next));
      }}
    />
  );
}

function FieldInput({
  field,
  config,
  onConfig,
  remountKey,
}: {
  field: ActionConfigField;
  config: Config;
  onConfig: (next: Config) => void;
  remountKey: string;
}) {
  const raw = config[field.key];
  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          color="module"
          value={typeof raw === 'string' ? raw : ''}
          rows={3}
          placeholder={field.placeholder}
          onChange={(event) => {
            onConfig(setKey(config, field.key, event.target.value));
          }}
        />
      );
    case 'number':
      return (
        <Input
          color="module"
          type="number"
          value={primitiveText(raw)}
          placeholder={field.placeholder}
          onChange={(event) => {
            onConfig(
              setKey(
                config,
                field.key,
                event.target.value === '' ? undefined : Number(event.target.value)
              )
            );
          }}
        />
      );
    case 'tags':
      return (
        <Input
          color="module"
          value={Array.isArray(raw) ? raw.join(', ') : ''}
          placeholder={field.placeholder ?? 'one, two, three'}
          onChange={(event) => {
            onConfig(
              setKey(
                config,
                field.key,
                event.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
              )
            );
          }}
        />
      );
    case 'multiselect':
      return <MultiSelectField field={field} config={config} onConfig={onConfig} />;
    case 'select':
      if (field.optionSource) {
        return <DynamicSelectField field={field} config={config} onConfig={onConfig} />;
      }
      return (
        <Select
          color="module"
          aria-label={field.label}
          value={typeof raw === 'string' ? raw : ''}
          items={Object.fromEntries((field.options ?? []).map((o) => [o.value, o.label]))}
          placeholder="Choose…"
          onValueChange={(next) => {
            onConfig(setKey(config, field.key, next));
          }}
        />
      );
    case 'email':
      return (
        <Input
          color="module"
          type="email"
          value={typeof raw === 'string' ? raw : ''}
          placeholder={field.placeholder ?? 'name@example.com'}
          onChange={(event) => {
            onConfig(setKey(config, field.key, event.target.value));
          }}
        />
      );
    case 'json':
      return (
        <JsonField
          key={remountKey}
          value={raw}
          rows={3}
          placeholder={field.placeholder}
          onChange={(v) => {
            onConfig(setKey(config, field.key, v));
          }}
        />
      );
    default:
      return (
        <Input
          color="module"
          value={primitiveText(raw)}
          placeholder={field.placeholder}
          onChange={(event) => {
            onConfig(setKey(config, field.key, event.target.value));
          }}
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
  const forcedJson = def?.mode === 'json';
  const [jsonMode, setJsonMode] = useState(forcedJson);

  const offerable = availableActions(enabledModules);
  const options: ActionDef[] = offerable.some((a) => a.type === action.type)
    ? offerable
    : def
      ? [def, ...offerable]
      : offerable;

  const config = (action.config ?? {}) as Config;
  const showJson = jsonMode || forcedJson;

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel>What should this step do?</FieldLabel>
        <Select
          color="module"
          aria-label="Step action"
          value={action.type}
          items={Object.fromEntries(
            options.map((o) => [o.type, `${moduleLabel(o.module)} · ${o.label}`])
          )}
          onValueChange={(next) => {
            const nextDef = actionDef(next as string);
            onChange({ type: next as Action['type'], config: nextDef?.jsonTemplate ?? {} });
            setJsonMode(nextDef?.mode === 'json');
          }}
        />
        {def?.description ? <FieldDescription>{def.description}</FieldDescription> : null}
      </Field>

      {def && !def.available ? (
        <Badge color="warning" variant="soft" size="sm">
          Not available yet — this step won’t run until its feature ships
        </Badge>
      ) : null}

      {def?.mode === 'none' ? (
        <Text className="text-sm">This step needs no extra setup.</Text>
      ) : def?.mode === 'branch' ? (
        // A branch's whole configuration is the question above and the two step
        // lists on the canvas. Showing a JSON editor over the same config here
        // would give somebody a second, worse way to edit the steps they can see
        // — and a way to break them.
        <Text className="text-sm">
          Set the question above, then add steps to either side on the flow.
        </Text>
      ) : (
        <div className="flex flex-col gap-3">
          {!forcedJson && def?.mode === 'fields' ? (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                color="neutral"
                size="sm"
                onClick={() => {
                  setJsonMode((v) => !v);
                }}
              >
                <Code2 className="size-4" aria-hidden />
                {jsonMode ? 'Simple fields' : 'Edit as JSON'}
              </Button>
            </div>
          ) : null}

          {showJson ? (
            <Field>
              <FieldLabel>Setup (JSON)</FieldLabel>
              <FieldControl
                render={
                  <div>
                    <JsonField
                      key={`${actionId}:${action.type}:full`}
                      value={config}
                      rows={6}
                      onChange={(v) => {
                        onChange({ ...action, config: (v ?? {}) as Config });
                      }}
                    />
                  </div>
                }
              />
            </Field>
          ) : def?.configFields ? (
            def.configFields.map((field) => (
              <Field key={field.key}>
                <FieldLabel>{field.label}</FieldLabel>
                <FieldControl
                  render={
                    <div>
                      <FieldInput
                        field={field}
                        config={config}
                        onConfig={(nextConfig) => {
                          onChange({ ...action, config: nextConfig });
                        }}
                        remountKey={`${actionId}:${action.type}:${field.key}`}
                      />
                    </div>
                  }
                />
                {field.help ? <FieldDescription>{field.help}</FieldDescription> : null}
              </Field>
            ))
          ) : null}
        </div>
      )}

      <div className="border-base-300 border-t pt-3">
        <Button variant="outline" color="danger" size="sm" onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden />
          Remove this step
        </Button>
      </div>
    </div>
  );
}
