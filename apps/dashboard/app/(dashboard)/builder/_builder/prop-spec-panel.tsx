'use client';

// The "Fields" rail tab of the component editor (docs/53 §5, P-D) — declares a
// component's configurable SLOTS (its propSpec). Each slot is a typed parameter
// every placement can fill; nodes inside the component reference a slot via a
// `{ $prop: key }` value on one of their props (set from the node inspector's
// "Make a field" affordance), and the expander substitutes the placement's value
// at render time.
//
// This panel is the slot REGISTRY: add / rename / retype / remove. It also shows
// how many places in the tree currently reference each slot, so removing a used
// slot is a deliberate, confirmed act (the references fall back to defaults).

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Input, NativeSelect, useConfirm } from '@sparx/ui';
import { isPropSlot, type BuilderNode, type PropKind, type PropSpec } from '@sparx/builder-schemas';

import { deriveFieldKey } from './field-kinds';

const KINDS: { value: PropKind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'richtext', label: 'Long text' },
  { value: 'url', label: 'URL' },
  { value: 'image', label: 'Image' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Toggle' },
];

/** How many node props in `tree` reference slot `key` via `{ $prop: key }`. */
function usageCount(tree: BuilderNode, key: string): number {
  let n = 0;
  const walk = (node: BuilderNode) => {
    for (const value of Object.values(node.props)) {
      if (isPropSlot(value) && value.$prop === key) n += 1;
    }
    (node.children ?? []).forEach(walk);
  };
  walk(tree);
  return n;
}

function SlotRow({
  spec,
  used,
  onPatch,
  onRemove,
}: {
  spec: PropSpec;
  used: number;
  onPatch: (patch: Partial<PropSpec>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bx-fieldrow">
      <div className="bx-fieldrow__main">
        <Input
          size="sm"
          value={spec.label}
          aria-label={`${spec.key} label`}
          onChange={(e) => onPatch({ label: e.target.value })}
        />
        <NativeSelect
          size="sm"
          value={spec.kind}
          aria-label={`${spec.key} type`}
          onChange={(e) => onPatch({ kind: e.target.value as PropKind })}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="bx-fieldrow__meta">
        <span className="bx-fieldrow__key">{spec.key}</span>
        <span className="bx-fieldrow__used">
          {used === 0 ? 'unused' : `${used} use${used === 1 ? '' : 's'}`}
        </span>
        <button
          type="button"
          className="bx-fieldrow__btn"
          aria-label={`Remove ${spec.label}`}
          onClick={onRemove}
        >
          <X aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function PropSpecPanel({
  propSpec,
  tree,
  onChange,
}: {
  propSpec: PropSpec[];
  tree: BuilderNode;
  onChange: (next: PropSpec[]) => void;
}) {
  const confirm = useConfirm();
  const [label, setLabel] = React.useState('');
  const [kind, setKind] = React.useState<PropKind>('text');

  const addSlot = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = deriveFieldKey(trimmed, propSpec);
    onChange([...propSpec, { key, label: trimmed, kind }]);
    setLabel('');
    setKind('text');
  };

  const patchSlot = (key: string, patch: Partial<PropSpec>) => {
    onChange(propSpec.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const removeSlot = async (spec: PropSpec) => {
    const used = usageCount(tree, spec.key);
    if (used > 0) {
      const ok = await confirm({
        title: `Remove the “${spec.label}” field?`,
        description: `It's used in ${used} place${used === 1 ? '' : 's'} in this component. Those will fall back to their built-in content until you wire them to another field.`,
        confirmLabel: 'Remove field',
        tone: 'danger',
      });
      if (!ok) return;
    }
    onChange(propSpec.filter((s) => s.key !== spec.key));
  };

  return (
    <div className="bx-fields">
      <p className="bx-fields__lead">
        Fields are the slots each placement of this component can fill. Add a field here, then
        select a block and choose <strong>Make a field</strong> on one of its settings to wire it
        up.
      </p>

      {propSpec.length > 0 ? (
        <div className="bx-fields__list">
          {propSpec.map((spec) => (
            <SlotRow
              key={spec.key}
              spec={spec}
              used={usageCount(tree, spec.key)}
              onPatch={(patch) => patchSlot(spec.key, patch)}
              onRemove={() => void removeSlot(spec)}
            />
          ))}
        </div>
      ) : (
        <p className="bx-fields__empty">No fields yet — every placement renders the same.</p>
      )}

      <div className="bx-fields__add">
        <Input
          size="sm"
          value={label}
          placeholder="Field label (e.g. Headline)"
          aria-label="New field label"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSlot();
            }
          }}
        />
        <NativeSelect
          size="sm"
          value={kind}
          aria-label="New field type"
          onChange={(e) => setKind(e.target.value as PropKind)}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </NativeSelect>
        <button
          type="button"
          className="bx-fieldrow__btn"
          disabled={!label.trim()}
          onClick={addSlot}
        >
          <Plus aria-hidden /> Add
        </button>
      </div>
    </div>
  );
}
