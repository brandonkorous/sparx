'use client';

// A live region's own settings, in the Inspector, under the block itself.
//
// Every host core declares its author-tunable props in `HOST_COMPONENTS` — the map's
// address, the embed's link, what the brand mark shows. Nothing read them, so the
// only values those props could ever hold were the ones a starter site wrote: a map
// on a contact page stayed pointed at the demo salon's street, in another state,
// beside an address block that had correctly followed the business.

import {
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Switch,
} from '@wizeworks/silicaui-react';
import { HOST_COMPONENTS, type HostComponentProp } from '@wizeworks/silica-catalog';
import type { HostNode } from '@wizeworks/silicaui-html';
import type { AddressableNode } from '@wizeworks/studio';
import { useApply } from '@wizeworks/studio/react';

export function HostSettingsPanel({ node }: { node: AddressableNode }) {
  if (node.kind !== 'host' || !node.id) return null;
  const meta = HOST_COMPONENTS.find((core) => core.key === node.component);
  if (!meta?.props?.length) return null;
  const id = node.id;

  return (
    <div className="border-base-300 mt-4 flex flex-col gap-4 border-t pt-4">
      <p className="text-base-content text-sm font-medium">{meta.label}</p>
      <p className="text-base-content text-sm">{meta.hint}</p>
      {meta.props.map((prop) => (
        <HostField key={prop.name} id={id} node={node} prop={prop} />
      ))}
    </div>
  );
}

/** One declared prop, drawn as the control its type asks for. */
function HostField({ id, node, prop }: { id: string; node: HostNode; prop: HostComponentProp }) {
  const apply = useApply();
  const current = node.props?.[prop.name] ?? prop.default;
  const label = prop.label ?? prop.name;
  const set = (value: unknown) => {
    apply(`Change ${label.toLowerCase()}`, [{ kind: 'node.setProp', id, key: prop.name, value }]);
  };

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <HostControl id={id} prop={prop} current={current} set={set} />
      {prop.type === 'number' ? <FieldDescription>Higher is closer in.</FieldDescription> : null}
    </Field>
  );
}

function HostControl({
  id,
  prop,
  current,
  set,
}: {
  id: string;
  prop: HostComponentProp;
  current: unknown;
  set: (value: unknown) => void;
}) {
  if (prop.type === 'select') {
    return (
      <NativeSelect
        value={typeof current === 'string' ? current : ''}
        onChange={(event) => set(event.currentTarget.value)}
      >
        {(prop.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    );
  }

  if (prop.type === 'boolean') {
    return <Switch checked={current === true} onCheckedChange={(next) => set(next)} />;
  }

  if (prop.type === 'number') {
    return (
      <Input
        key={fieldKey(id, prop.name, current)}
        type="number"
        defaultValue={typeof current === 'number' ? String(current) : ''}
        onBlur={(event) => {
          const raw = event.currentTarget.value.trim();
          const next = raw === '' ? undefined : Number(raw);
          if (next !== undefined && Number.isNaN(next)) return;
          if (next === current) return;
          set(next);
        }}
      />
    );
  }

  // Anything else — including a type added later — gets a text box rather than
  // nothing at all. A control that cannot express the value beats the silence
  // that left every one of these unreachable in the first place.
  return (
    <Input
      key={fieldKey(id, prop.name, current)}
      defaultValue={typeof current === 'string' ? current : ''}
      onBlur={(event) => {
        const next = event.currentTarget.value.trim();
        if (next === (typeof current === 'string' ? current : '')) return;
        set(next);
      }}
    />
  );
}

/** Uncontrolled inputs keep the value they mounted with, so the key has to change
 *  when the selection or the stored value does — otherwise selecting a second map
 *  shows the first one's address. */
function fieldKey(id: string, name: string, value: unknown): string {
  const seen = typeof value === 'string' || typeof value === 'number' ? value : '';
  return `${id}:${name}:${seen}`;
}
