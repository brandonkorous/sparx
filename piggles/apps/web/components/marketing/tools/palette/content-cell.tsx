'use client';

import { ColorPicker, Popover, PopoverContent, PopoverTrigger } from '@wizeworks/silicaui-react';
import { faRotateLeft } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { contentFor, type Assignment, type Role } from './roles';
import { seenAs, type Vision } from './vision';

/**
 * The ink that goes ON this slot's colour, under it and outside it.
 *
 * A fill and its foreground are one decision, so they belong on screen together
 * — but the ink is not a member of the palette, and painting it inside the
 * colour block said it was. It sits in a band beneath instead.
 *
 * ── IT LIVES IN THE SLOT, NOT IN A ROW OF ITS OWN ───────────────────────────
 *
 * A separate row under the stage would drift out of line the moment a column
 * grew on hover or moved on a drag. Rendering it as the foot of the slot keeps
 * it aligned by construction — it travels with its colour for free.
 *
 * ── AND IT IS EDITABLE, WHICH IS THE POINT ──────────────────────────────────
 *
 * Silica derives these by measured contrast, which is the right default and not
 * always the right answer: black clears the maths on the Piggles pink, and a
 * brand may still want white. Overriding one turns a derived value into a
 * decision — and a decision is the only thing worth writing into the theme, so
 * an untouched slot still exports nothing and lets silica do its job.
 *
 * Every slot has one, `base-100`'s being the page's own writing (`base-content`).
 * That is the whole reason the ink is not a slot of its own: it belongs to a
 * colour, and putting it in the band made the row uniform and gave `neutral`
 * back the place it had been squatting in.
 */
export function ContentCell({
  role,
  roles,
  vision,
  overridden,
  onChange,
  onReset,
}: {
  role: Role | null;
  roles: Assignment;
  vision: Vision;
  overridden: boolean;
  onChange: (role: Role, hex: string) => void;
  onReset: (role: Role) => void;
}) {
  // A spare slot past the sixth carries no role, so it has no ink either. The
  // empty cell keeps the band aligned with the columns above it.
  if (!role) {
    return <div className="border-base-300 bg-base-100 h-16 border-t" />;
  }

  const pair = contentFor(role, roles);
  const swatch = (
    <span
      aria-hidden
      className="border-base-300 size-5 shrink-0 rounded-full border"
      style={{ backgroundColor: seenAs(pair.hex, vision) }}
    />
  );

  return (
    <div className="border-base-300 bg-base-100 flex h-16 items-center gap-1 border-t pr-1 pl-3">
      <Popover>
        <PopoverTrigger>
          <button type="button" className="flex min-w-0 grow flex-col gap-1 py-2 text-left">
            <span className="flex items-center gap-2">
              {swatch}
              <span className="truncate font-mono text-xs font-bold">{pair.name}</span>
            </span>
            <span className="font-mono text-xs">
              {pair.hex}
              {overridden ? '' : ' · worked out for you'}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-4">
          <ColorPicker
            value={pair.hex}
            format="hex"
            onValueChange={(next) => onChange(role, next.toUpperCase())}
          />
        </PopoverContent>
      </Popover>

      {overridden ? (
        <button
          type="button"
          onClick={() => onReset(role)}
          aria-label={`Put ${pair.name} back to the worked-out colour`}
          title={`Put ${pair.name} back to the worked-out colour`}
          className="grid size-8 shrink-0 place-items-center rounded-full"
        >
          <Icon glyph={faRotateLeft} className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
