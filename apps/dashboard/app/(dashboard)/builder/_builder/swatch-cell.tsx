'use client';

// One swatch in a picker grid — the atom both the colour and emphasis pickers
// compose. Three render modes:
//   · recipe → a chip in `--sw-base` rendered with the current treatment (data-treat),
//              showing "Aa". Used for the recipe Colour axis and the Emphasis picker.
//   · text   → "Aa" in the colour over an adaptive backdrop (legible for light inks).
//   · fill   → a plain colour tile (bg / border / ring / shadow / caret / accent).
// `name === null` is the empty/"Default" slot (checkerboard). The treatment CSS
// lives in builder.css (`.bx-sw[data-treat=…]`), mirroring @sparx/site-ui recipes.

import { Check } from 'lucide-react';
import * as React from 'react';
import { onPaintExpr, paintExpr, textSwatchBackdrop } from './color-tokens';

export type SwatchMode = 'recipe' | 'fill' | 'text';

export function SwatchCell({
  label,
  selected,
  onSelect,
  mode,
  name,
  treat,
  vars,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  mode: SwatchMode;
  /** null = the transparent/empty slot (checkerboard). */
  name: string | null;
  treat: string;
  /** Resolved tenant palette — used to pick a legible text-swatch backdrop. */
  vars: Record<string, string>;
}) {
  const fill = name ? paintExpr(name) : null;
  const none = fill === null;
  const style: React.CSSProperties = {};
  if (!none && fill) {
    if (mode === 'recipe') {
      (style as Record<string, string>)['--sw-base'] = fill;
      (style as Record<string, string>)['--sw-on'] = onPaintExpr(name!);
    } else if (mode === 'text') {
      style.background = textSwatchBackdrop(name!, vars);
      style.color = fill;
    } else {
      style.background = fill;
    }
  }
  const glyph = mode === 'recipe' || mode === 'text' ? 'Aa' : '';
  return (
    <button
      type="button"
      className="bx-sw-cell"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
    >
      <span
        className="bx-sw"
        data-mode={mode}
        data-treat={mode === 'recipe' ? treat : 'flat'}
        data-none={none || undefined}
        style={style}
      >
        {glyph}
      </span>
      <span className="bx-sw-cell__name">{label}</span>
      {selected ? (
        <span className="bx-sw-cell__check" aria-hidden>
          <Check />
        </span>
      ) : null}
    </button>
  );
}
