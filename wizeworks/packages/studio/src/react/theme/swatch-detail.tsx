'use client';

// What is behind a block: one color, and whether the pair it belongs to can be
// read.
//
// One tile edits ONE token, so this edits one token — the pair is expressed by the
// two tiles sitting next to each other in the grid, not by a popover that quietly
// contained both halves.
//
// The ink half is the author's to set. silica recommends one by measured contrast
// when the theme names none, and that is a recommendation — cream on a deep green
// is a brand decision no formula arrives at. So its picker OPENS on the
// recommendation and says which of the two is in force.

import { Button, ColorPicker, Input } from '@wizeworks/silicaui-react';
import { parseColor } from '@wizeworks/silicaui-html';
import { StudioIcon } from '../icon';
import { formatRatio, type ContrastReading } from './contrast';
import { useThemeEdit } from './edit-context';
import type { SwatchTile } from './tokens';

export function SwatchDetail({
  tile,
  reading,
  recommended,
  onRemove,
}: {
  tile: SwatchTile;
  reading: ContrastReading | undefined;
  /** silica's measured ink for the fill — what an unset `-content` resolves to. */
  recommended: string | undefined;
  onRemove?: () => void;
}) {
  const { mode, values, own, resolved, editable, setToken } = useThemeEdit();

  const stored = values[tile.token];
  const chosen = own[tile.token] !== undefined;
  // An ink tile shows the ink that is really ON the color — silica's, when the
  // theme names none, and silica's AGAIN when the one the theme named has been
  // set aside as unreadable. Opening the picker on the stored value instead would
  // hand back a color the page is not using, and write it on the first nudge.
  const painted = tile.ink ? (resolved[tile.token] ?? stored ?? recommended) : stored;
  const setAside = tile.ink && stored !== undefined && resolved[tile.token] !== stored;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-base-content text-base font-semibold">{tile.label}</p>
        <p className="text-base-content text-sm">
          {describe(tile, mode, chosen, stored, setAside)}
        </p>
      </div>

      <ColorValue
        label={tile.label}
        value={painted}
        disabled={!editable}
        onChange={(next) => setToken(tile.token, next, `Set ${tile.label}`)}
      />

      {reading ? (
        <p className={reading.passes ? 'text-base-content text-sm' : 'text-warning text-sm'}>
          {formatRatio(reading.ratio)} — {reading.advice ?? 'comfortable to read.'}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {editable && chosen && tile.ink ? (
          <Button size="sm" onClick={() => setToken(tile.token, undefined, `Reset ${tile.label}`)}>
            <StudioIcon name="undo" className="text-base" />
            Choose it for me
          </Button>
        ) : null}
        {editable && chosen && !tile.ink && mode === 'dark' ? (
          <Button size="sm" onClick={() => setToken(tile.token, undefined, `Reset ${tile.label}`)}>
            <StudioIcon name="undo" className="text-base" />
            Use the light one
          </Button>
        ) : null}
        {onRemove && editable ? (
          <Button size="sm" color="danger" variant="soft" onClick={onRemove}>
            <StudioIcon name="trash" className="text-base" />
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Where this tile's color is coming from, said in one line. */
function describe(
  tile: SwatchTile,
  mode: string,
  chosen: boolean,
  stored: string | undefined,
  setAside: boolean
): string {
  // Said before anything else, because it is the one case where what is on screen
  // is not what the theme says — and the author is owed the reason.
  if (setAside) {
    return 'Your light-mode text color cannot be read on this, so we picked one that can. Set it here to choose your own.';
  }
  if (mode === 'dark' && !chosen && stored !== undefined) {
    return 'Same as the light version, until you change it here.';
  }
  if (tile.ink && stored === undefined) return `Chosen for legibility. ${tile.hint}`;
  return tile.hint;
}

/**
 * The picker — or a text box, when the stored value is something no picker can
 * represent.
 *
 * A theme installed from elsewhere can hold a `color-mix()` or a `var()`. Handing
 * that to the picker would show its fallback color and then write that fallback
 * back on the first drag, quietly replacing a value the author never touched.
 */
export function ColorValue({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (value && !parseColor(value)) {
    return (
      <Input
        key={value}
        defaultValue={value}
        disabled={disabled}
        aria-label={label}
        onBlur={(event) => {
          const next = event.currentTarget.value.trim();
          if (next && next !== value) onChange(next);
        }}
      />
    );
  }

  return (
    <ColorPicker
      variant="swatch"
      className="shrink-0"
      value={value ?? ''}
      disabled={disabled}
      aria-label={label}
      onValueChange={(next) => onChange(next)}
    />
  );
}
