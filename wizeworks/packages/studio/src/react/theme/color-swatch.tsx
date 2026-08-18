'use client';

// One block in the palette: a color, or the words that sit on it.
//
// A grid of squares, because that is how anyone actually reads a palette — the
// relationships between colors are visible at a glance and invisible in a list.
// Everything a sentence would have said moves into the popover behind the tile,
// and the whole guide moves into one modal for the section.
//
// EVERY color is two blocks, because every color IS two decisions: the fill, and
// the ink that has to be read on it. One tile carrying both hid the second one —
// and the second one is the half that goes wrong, since a fill can be any color
// at all while its ink either reads or does not.
//
// The tile is painted with real token classes inside a theme island, so it is not
// a rendering OF the color: `bg-primary` wearing `text-primary-content` is exactly
// what a button will be, ink and all.
//
// ONLY the color comes from inside. The frame and its corner are console chrome
// and stay out of the island — `rounded-box` in there reads the TENANT'S radius,
// so setting a site's cards to fully round reshaped the picker you were setting it
// with. A control must not wear the thing it edits.

import { Popover, PopoverContent, PopoverTrigger } from '@wizeworks/silicaui-react';
import { formatRatio, readContrast, recommendedInk } from './contrast';
import { useThemeEdit } from './edit-context';
import { ThemeChip } from './island';
import { SwatchDetail } from './swatch-detail';
import type { SwatchTile } from './tokens';

export function ColorSwatch({ tile, onRemove }: { tile: SwatchTile; onRemove?: () => void }) {
  const { mode, values } = useThemeEdit();
  const role = tile.role;

  // Always measured on the ROLE, never on the tile: a `-content` token has no
  // contrast of its own, only against the color it sits on.
  const reading = readContrast(role.token, values[role.token], values, role.contentToken);

  // The warning belongs to the pair, so it is shown once — on the ink tile, which
  // is the tile about readability. A surface has no ink tile beside it, so it
  // carries its own.
  const carriesWarning = tile.ink || !role.contentToken;
  const failing = carriesWarning && reading ? !reading.passes : false;

  return (
    <div className="min-w-0">
      <Popover>
        <PopoverTrigger>
          <button
            type="button"
            className="border-base-300 focus-visible:outline-primary relative block w-full overflow-hidden rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`${tile.label}${reading && carriesWarning ? `, ${formatRatio(reading.ratio)}` : ''}`}
          >
            <ThemeChip mode={mode} className="block">
              <span
                className={`${tile.sample} flex aspect-square w-full items-center justify-center text-lg font-semibold`}
              >
                {tile.ink ? 'Aa' : '\u00a0'}
              </span>
            </ThemeChip>
            {/* Outside the island: a warning about the theme is the console
                speaking, and it has to stay readable on a color that by definition
                nothing reads well on. */}
            {failing ? (
              <span
                className="bg-warning text-warning-content absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-sm font-bold"
                aria-hidden
              >
                !
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <SwatchDetail
            tile={tile}
            reading={reading}
            recommended={recommendedInk(values[role.token])}
            onRemove={onRemove}
          />
        </PopoverContent>
      </Popover>
      <p className="text-base-content mt-1 line-clamp-2 text-center text-sm leading-tight">
        {tile.short}
      </p>
    </div>
  );
}
