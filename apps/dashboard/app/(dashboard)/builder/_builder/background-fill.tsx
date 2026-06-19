'use client';

// The inspector's Background fill — a single colour grid that unifies two kinds of
// fill, then an Emphasis row, exactly the "colour → treatment" pair the rest of the
// builder uses:
//   · Surface tones (None / Page / Subtle / Muted) — flat `bg-base-*` utilities. A
//     page surface has no treatment, so these never show Emphasis.
//   · Recipe palette (Primary … Highlight) — the `st-c-*` colour axis. Picking one
//     reveals the Emphasis chips (`st-v-*`: Solid / Soft / Outline / …), because a
//     brand fill carries a treatment. `st-c-*` only sets the `--c-*` vars; `st-v-*`
//     does the painting — so choosing a colour auto-defaults Emphasis to Solid (a
//     raw `el:*` has no archetype to backfill it).
//
// The two are mutually exclusive: picking a surface clears the recipe colour +
// emphasis, and picking a recipe colour clears the surface. Base layer only — the
// recipe classes are static CSS (not Tailwind utilities), so they don't prefix to
// `@lg:`/`hover:`; the treatments carry their own `:hover` instead (recipes.css).

import * as React from 'react';
import type { BuilderNode } from '@sparx/builder-schemas';
import { SwatchCell } from './swatch-cell';
import { EmphasisSwatchField, useCanvasThemeVars } from './color-swatch';
import {
  activeValue,
  applyValue,
  ensureArchetypeDefaults,
  BG_SURFACE_CONTROL,
  COLOR_CONTROL,
  VARIANT_CONTROL,
} from './class-controls';
import { FALLBACK, colorNameFromToken } from './color-tokens';

// The brand palette for a fill — the recipe colours minus `surface` (that page tone
// is already offered as the flat "Page" surface, so it would read as a duplicate).
const PALETTE = COLOR_CONTROL.options.filter((o) => o.value !== 'surface');

export function BackgroundFillField({
  node,
  archetype,
  onClass,
}: {
  node: BuilderNode;
  /** The node's archetype default class — backfills the structural base + unset
   *  recipe axes (so styling a named component never collapses it). */
  archetype: string | undefined;
  onClass: (value: string) => void;
}) {
  const vars = useCanvasThemeVars();
  const containerStyle = {
    ...vars,
    '--sw-page-ink': vars['--st-base-content'] ?? FALLBACK['base-content'],
  } as React.CSSProperties;

  const colorVal = activeValue(node.class, COLOR_CONTROL);
  const surfaceVal = activeValue(node.class, BG_SURFACE_CONTROL);
  // Recipe chips preview in the node's current treatment, like the Style card.
  const emphasis = activeValue(node.class, VARIANT_CONTROL) ?? 'solid';

  // A surface fill is flat → drop any recipe colour + emphasis it replaces.
  const commitSurface = (value: string | null): void => {
    let next = applyValue(node.class, COLOR_CONTROL, null);
    next = applyValue(next, VARIANT_CONTROL, null);
    next = applyValue(next, BG_SURFACE_CONTROL, value);
    onClass(ensureArchetypeDefaults(next, archetype));
  };

  // A recipe colour replaces any flat surface, and needs a treatment to paint —
  // default it to Solid when none is set yet.
  const commitColor = (value: string): void => {
    let next = applyValue(node.class, BG_SURFACE_CONTROL, null);
    next = applyValue(next, COLOR_CONTROL, value);
    if (activeValue(next, VARIANT_CONTROL) === null) {
      next = applyValue(next, VARIANT_CONTROL, 'solid');
    }
    onClass(ensureArchetypeDefaults(next, archetype));
  };

  // Default = clear the whole fill (inherit) — distinct from the explicit "None"
  // transparent surface, mirroring every other swatch field.
  const commitDefault = (): void => {
    let next = applyValue(node.class, BG_SURFACE_CONTROL, null);
    next = applyValue(next, COLOR_CONTROL, null);
    next = applyValue(next, VARIANT_CONTROL, null);
    onClass(ensureArchetypeDefaults(next, archetype));
  };

  return (
    <div className="bx-field bx-swatchfield">
      <span className="bx-field__label">Background</span>
      <div
        className="bx-sw-grid"
        data-density="comfortable"
        style={containerStyle}
        role="group"
        aria-label="Background fill"
      >
        <SwatchCell
          label="Default"
          selected={colorVal === null && surfaceVal === null}
          onSelect={commitDefault}
          mode="fill"
          name={null}
          treat="flat"
          vars={vars}
        />
        {BG_SURFACE_CONTROL.options.map((o) => (
          <SwatchCell
            key={`s-${o.value}`}
            label={o.label}
            selected={surfaceVal === o.value}
            onSelect={() => commitSurface(o.value)}
            mode="fill"
            name={colorNameFromToken(o.token)}
            treat="flat"
            vars={vars}
          />
        ))}
        {PALETTE.map((o) => (
          <SwatchCell
            key={`c-${o.value}`}
            label={o.label}
            selected={colorVal === o.value}
            onSelect={() => commitColor(o.value)}
            mode="recipe"
            name={colorNameFromToken(o.token)}
            treat={emphasis}
            vars={vars}
          />
        ))}
      </div>

      {/* Emphasis only applies to a recipe (brand) fill — a flat surface has none. */}
      {colorVal ? (
        <EmphasisSwatchField
          node={node}
          archetype={archetype}
          control={VARIANT_CONTROL}
          onClass={onClass}
        />
      ) : null}
    </div>
  );
}
