'use client';

// The Inspector's field primitives, bound to one email node.
//
// Text and numbers commit on BLUR, colours and switches on change. That split is
// deliberate: a keystroke is not a decision — committing each one would put forty
// entries on the undo stack for one sentence, and ⌘Z would then walk backwards
// through the author's typing a letter at a time. A colour drag or a toggle IS
// one gesture, and the author ends it themselves.
//
// Every field is `key`ed by the node id at the call site, so selecting a
// different block re-mounts the row with that block's value rather than leaving
// the previous one in an uncontrolled input.

import { useCallback, type ReactNode } from 'react';
import {
  Button,
  ColorPicker,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import { useApply, useStudioHost } from '../../context';

/** Write a patch to one node, labelled for the undo stack. */
export function usePatch(id: string): (label: string, patch: Record<string, unknown>) => void {
  const apply = useApply();
  return useCallback(
    (label, patch) => {
      apply(label, [{ kind: 'email.patch', id, patch }]);
    },
    [apply, id]
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-base-300 flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <p className="text-base-content text-sm font-medium">{title}</p>
      {children}
    </section>
  );
}

export function TextRow({
  label,
  value,
  onCommit,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        size="sm"
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(event) => {
          const next = event.currentTarget.value;
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

export function AreaRow({
  label,
  value,
  onCommit,
  hint,
  rows = 4,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        size="sm"
        rows={rows}
        defaultValue={value}
        onBlur={(event) => {
          const next = event.currentTarget.value;
          if (next !== value) onCommit(next);
        }}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

export function NumberRow({
  label,
  value,
  onCommit,
  min = 0,
  max,
  hint,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        size="sm"
        type="number"
        min={min}
        {...(max === undefined ? {} : { max })}
        defaultValue={value}
        onBlur={(event) => {
          const next = Number(event.currentTarget.value);
          if (!Number.isFinite(next) || next === value) return;
          onCommit(Math.max(min, max === undefined ? next : Math.min(next, max)));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

/**
 * A colour, always as literal hex.
 *
 * `format="hex"` is not a preference — an email carries frozen colour values
 * because email clients do not support `oklch()` or CSS custom properties. A
 * token written here would reach an inbox as an unparseable string.
 */
export function ColorRow({
  label,
  value,
  onCommit,
  hint,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  hint?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <ColorPicker
        variant="swatch"
        format="hex"
        value={value}
        onValueChange={(next) => {
          if (next !== value) onCommit(next);
        }}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

export function SelectRow<T extends string>({
  label,
  value,
  options,
  onCommit,
  hint,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onCommit: (value: T) => void;
  hint?: string;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <NativeSelect
        size="sm"
        value={value}
        onChange={(event) => onCommit(event.currentTarget.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

export function SwitchRow({
  label,
  checked,
  onCommit,
  hint,
}: {
  label: string;
  checked: boolean;
  onCommit: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <Switch color="primary" checked={checked} onCheckedChange={onCommit} />
      </div>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

/**
 * A picture, chosen from the app's own library.
 *
 * The address box stays, because a picture hosted elsewhere is a real case — but it
 * is second. Asking a business owner for the web address of their own photograph is
 * asking them to do a technical thing, and the button is what makes it optional.
 *
 * An email stores the URL, never a media id: a mail client fetches the image
 * cross-origin, with no app around to resolve an id into anything.
 */
export function PictureRow({
  label,
  value,
  onCommit,
  hint,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  hint?: string;
}) {
  const host = useStudioHost();
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {host.pickAsset ? (
        <Button
          size="sm"
          color="primary"
          variant="soft"
          onClick={() => {
            void host.pickAsset?.().then((picked) => {
              if (picked) onCommit(picked.url);
            });
          }}
        >
          {value ? 'Change picture' : 'Choose a picture'}
        </Button>
      ) : null}
      <Input
        size="sm"
        defaultValue={value}
        placeholder="…or paste a web address"
        key={value}
        onBlur={(event) => {
          const next = event.currentTarget.value;
          if (next !== value) onCommit(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

export const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
] as const;

export const WEIGHT_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medium' },
  { value: 'semibold', label: 'Semi-bold' },
  { value: 'bold', label: 'Bold' },
] as const;
