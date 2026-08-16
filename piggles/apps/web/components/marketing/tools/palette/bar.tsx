'use client';

import { Button, Kbd, NativeSelect, Tooltip } from '@wizeworks/silicaui-react';
import {
  faMinus,
  faPlus,
  faRotateLeft,
  faRotateRight,
  faShuffle,
} from '@fortawesome/pro-solid-svg-icons';
import type { PigglesIcon } from '@piggles/ui';
import { Icon } from '@piggles/ui';
import { SCHEMES, type Scheme } from './generate';
import { VISIONS, type Vision } from './vision';
import { MAX_SWATCHES, MIN_SWATCHES } from './model';

/**
 * A secondary action on the palette — no `color`, no `variant`.
 *
 * A bare `.btn` is already the right control: it resolves to `base-content` on
 * the base surface, so it is correct in both themes and inside any island.
 * `neutral` is the banned version of this, and `soft` tints a colour that isn't
 * there.
 */
function Round({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: PigglesIcon;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={label}>
      <Button shape="circle" aria-label={label} disabled={disabled} onClick={onClick}>
        <Icon glyph={icon} className="size-4" />
      </Button>
    </Tooltip>
  );
}

/**
 * Everything that acts on the whole palette, in one row above it.
 *
 * Shuffle is a real button AND the space bar. The button is how anybody finds
 * the feature; the space bar is how anybody who has found it actually works,
 * because the twentieth press should not require aiming.
 */
export function PaletteBar({
  count,
  scheme,
  vision,
  canUndo,
  canRedo,
  onShuffle,
  onUndo,
  onRedo,
  onScheme,
  onVision,
  onAdd,
  onRemove,
}: {
  count: number;
  scheme: Scheme;
  vision: Vision;
  canUndo: boolean;
  canRedo: boolean;
  onShuffle: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onScheme: (scheme: Scheme) => void;
  onVision: (vision: Vision) => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-section border-base-300 bg-base-100 flex flex-wrap items-center gap-3 border p-3 shadow-md">
      <Button color="module" size="lg" onClick={onShuffle}>
        <Icon glyph={faShuffle} className="size-5" aria-hidden />
        Shuffle
      </Button>
      <p className="text-base font-semibold max-sm:hidden">
        or press <Kbd>Space</Kbd>
      </p>

      <div className="flex items-center gap-2 sm:ml-auto">
        <Round icon={faRotateLeft} label="Undo" disabled={!canUndo} onClick={onUndo} />
        <Round icon={faRotateRight} label="Redo" disabled={!canRedo} onClick={onRedo} />
      </div>

      <div className="flex items-center gap-2">
        <Round
          icon={faMinus}
          label="One fewer colour"
          disabled={count <= MIN_SWATCHES}
          onClick={onRemove}
        />
        <span className="w-6 text-center text-base font-bold tabular-nums">{count}</span>
        <Round
          icon={faPlus}
          label="One more colour"
          disabled={count >= MAX_SWATCHES}
          onClick={onAdd}
        />
      </div>

      <Choice
        label="How the colours relate to each other"
        value={scheme}
        onChange={onScheme}
        options={(Object.keys(SCHEMES) as Scheme[]).map((k) => [k, SCHEMES[k].label])}
      />
      <Choice
        label="See the palette through a different kind of colour vision"
        value={vision}
        onChange={onVision}
        options={(Object.keys(VISIONS) as Vision[]).map((k) => [k, VISIONS[k].label])}
      />
    </div>
  );
}

/** A native dropdown, because on a phone it opens as the operating system's own
 *  wheel — better than any listbox we would build, and neither of these has the
 *  grouping or search that would earn the rich `Select`. */
function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
}) {
  return (
    <NativeSelect
      color="module"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-auto"
    >
      {options.map(([key, text]) => (
        <option key={key} value={key}>
          {text}
        </option>
      ))}
    </NativeSelect>
  );
}
