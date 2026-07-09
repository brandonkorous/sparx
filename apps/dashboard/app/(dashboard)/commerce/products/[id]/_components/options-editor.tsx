'use client';

import * as React from 'react';
import { Plus, Trash } from 'lucide-react';

import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';

import { setProductOptionsAction } from '../../../variant-actions';

import type { OptionRow } from './variants-panel';

type DisplayType = 'dropdown' | 'swatch' | 'image_swatch' | 'radio' | 'segmented';

interface OptionDraft {
  localKey: string;
  name: string;
  displayType: DisplayType;
  values: ValueDraft[];
}

interface ValueDraft {
  localKey: string;
  value: string;
  swatchHex: string;
}

interface Props {
  productId: string;
  productTitle: string;
  initialOptions: OptionRow[];
  onSaved: () => void;
  onCancel: () => void;
}

// Editor for the product's option lattice. Submits a setProductOptions
// payload which destructively replaces options + values. Existing
// variants are NOT re-bound by this call — the merchant rebinds them
// afterwards (or, if the lattice was a no-op edit, nothing happens).

export function OptionsEditor({
  productId,
  productTitle,
  initialOptions,
  onSaved,
  onCancel,
}: Props) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<OptionDraft[]>(() => seedDrafts(initialOptions));

  function addOption() {
    setDrafts((d) => [
      ...d,
      {
        localKey: newKey('opt'),
        name: '',
        displayType: 'dropdown',
        values: [{ localKey: newKey('val'), value: '', swatchHex: '' }],
      },
    ]);
  }

  function removeOption(i: number) {
    setDrafts((d) => d.filter((_, idx) => idx !== i));
  }

  function patchOption(i: number, patch: Partial<OptionDraft>) {
    setDrafts((d) => d.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function addValue(optIdx: number) {
    setDrafts((d) =>
      d.map((o, idx) =>
        idx !== optIdx
          ? o
          : { ...o, values: [...o.values, { localKey: newKey('val'), value: '', swatchHex: '' }] }
      )
    );
  }

  function removeValue(optIdx: number, valIdx: number) {
    setDrafts((d) =>
      d.map((o, idx) =>
        idx !== optIdx ? o : { ...o, values: o.values.filter((_, vi) => vi !== valIdx) }
      )
    );
  }

  function patchValue(optIdx: number, valIdx: number, patch: Partial<ValueDraft>) {
    setDrafts((d) =>
      d.map((o, idx) =>
        idx !== optIdx
          ? o
          : { ...o, values: o.values.map((v, vi) => (vi !== valIdx ? v : { ...v, ...patch })) }
      )
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Quick client validation — surface obvious gaps before the server.
    for (const opt of drafts) {
      if (!opt.name.trim()) {
        setError('Every option needs a name.');
        return;
      }
      if (opt.values.length === 0) {
        setError(`Option "${opt.name}" must have at least one value.`);
        return;
      }
      for (const v of opt.values) {
        if (!v.value.trim()) {
          setError(`Option "${opt.name}" has an empty value.`);
          return;
        }
      }
    }

    const payload = {
      options: drafts.map((o, i) => ({
        name: o.name.trim(),
        displayType: o.displayType,
        position: i,
        values: o.values.map((v, j) => ({
          value: v.value.trim(),
          ...(v.swatchHex.trim().length > 0 ? { swatchHex: v.swatchHex.trim() } : {}),
          position: j,
        })),
      })),
    };

    startTransition(async () => {
      const result = await setProductOptionsAction(productId, payload);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onSaved();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-lg font-semibold">Edit option lattice — {productTitle}</h4>
          <p className="text-base-content/70 text-sm">
            Replace the option set. Existing variants stay but lose their option bindings — rebind
            them from the variants table afterwards.
          </p>
        </div>

        {drafts.length === 0 && (
          <div className="border-base-300 flex flex-col items-center gap-2 rounded border border-dashed p-6 text-center">
            <p className="text-base-content/70 text-sm">
              No options yet — single-SKU products work too.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {drafts.map((opt, oi) => (
            <div
              key={opt.localKey}
              className="border-base-300 flex flex-col gap-3 rounded border p-3"
            >
              <div className="flex flex-row items-end gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <Field>
                    <FieldLabel>Name</FieldLabel>
                    <FieldControl
                      id={`opt-${opt.localKey}-name`}
                      value={opt.name}
                      onChange={(e) => patchOption(oi, { name: e.target.value })}
                      placeholder="Color"
                    />
                  </Field>
                </div>
                <div className="flex flex-col gap-1">
                  <Field>
                    <FieldLabel>Display</FieldLabel>
                    <NativeSelect
                      id={`opt-${opt.localKey}-display`}
                      className="w-auto"
                      value={opt.displayType}
                      onChange={(e) =>
                        patchOption(oi, { displayType: e.target.value as DisplayType })
                      }
                    >
                      <option value="dropdown">Dropdown</option>
                      <option value="swatch">Color swatch</option>
                      <option value="image_swatch">Image swatch</option>
                      <option value="radio">Radio</option>
                      <option value="segmented">Segmented</option>
                    </NativeSelect>
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(oi)}
                  iconStart={<Trash className="h-3.5 w-3.5" />}
                  aria-label={`Remove ${opt.name || 'option'}`}
                >
                  Remove
                </Button>
              </div>

              <div className="flex flex-col gap-2 pl-4">
                <p className="text-base-content/70 text-xs">Values</p>
                {opt.values.map((val, vi) => (
                  <div key={val.localKey} className="flex flex-row items-center gap-2">
                    <FieldControl
                      value={val.value}
                      onChange={(e) => patchValue(oi, vi, { value: e.target.value })}
                      placeholder="Red"
                      className="flex-1"
                      aria-label={`Value ${vi + 1}`}
                    />
                    {(opt.displayType === 'swatch' || opt.displayType === 'image_swatch') && (
                      <FieldControl
                        value={val.swatchHex}
                        onChange={(e) => patchValue(oi, vi, { swatchHex: e.target.value })}
                        placeholder="#FF0000"
                        className="w-32"
                        aria-label={`Swatch hex for value ${vi + 1}`}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeValue(oi, vi)}
                      aria-label={`Remove value ${vi + 1}`}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addValue(oi)}
                  iconStart={<Plus className="h-3.5 w-3.5" />}
                >
                  Add value
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={addOption}
            iconStart={<Plus className="h-4 w-4" />}
          >
            Add option
          </Button>
        </div>

        {error && (
          <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
            {error}
          </FieldStatus>
        )}

        <div className="flex flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" color="module" disabled={pending} loading={pending}>
            Save options
          </Button>
        </div>
      </div>
    </form>
  );
}

function seedDrafts(opts: OptionRow[]): OptionDraft[] {
  return opts.map((o) => ({
    localKey: o.id,
    name: o.name,
    displayType: (o.displayType as DisplayType) || 'dropdown',
    values: o.values.map((v) => ({
      localKey: v.id,
      value: v.value,
      swatchHex: v.swatchHex ?? '',
    })),
  }));
}

let keyCounter = 0;
function newKey(prefix: string): string {
  keyCounter++;
  return `${prefix}-${keyCounter}`;
}
