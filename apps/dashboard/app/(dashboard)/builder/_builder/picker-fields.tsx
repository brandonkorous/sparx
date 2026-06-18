'use client';

// Visual pickers for the inspector — the non-colour counterparts to the swatch
// grids (docs/builder visual-controls). Two reusable patterns:
//   · IconChoiceField — a toolbar row of icon toggle buttons (alignment family).
//   · PreviewTileField — a tile grid where each chip RENDERS the effect (corner
//     rounding, aspect ratio, font weight, column count).
// Both write through the same class-group helpers (applyValue + archetype
// backfill) the dropdowns used — only the control surface changes.

import * as React from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { Switch } from '@sparx/ui';
import type { BuilderNode } from '@sparx/builder-schemas';
import {
  activeValue,
  applyValue,
  ensureArchetypeDefaults,
  type ClassControl,
} from './class-controls';
import { renderTileDemo, useCanvasFonts, type TileFonts, type TileKind } from './tile-demos';

// ── Icon toggle row (alignment, distribution, …) ──────────────────────────────
export function IconChoiceField({
  node,
  archetype,
  control,
  ctx = '',
  onClass,
  icons,
}: {
  node: BuilderNode;
  archetype: string | undefined;
  control: ClassControl;
  ctx?: string;
  onClass: (value: string) => void;
  /** value → lucide icon. A value with no icon falls back to its text label. */
  icons: Record<string, LucideIcon>;
}) {
  const current = activeValue(node.class, control, ctx);
  const commit = (value: string | null): void =>
    onClass(ensureArchetypeDefaults(applyValue(node.class, control, value, ctx), archetype));
  return (
    <div className="bx-field">
      <span className="bx-field__label">{control.label}</span>
      <div className="bx-iconrow" role="group" aria-label={control.label}>
        {control.options.map((o) => {
          const Icon = icons[o.value];
          const on = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className="bx-iconrow__btn"
              aria-pressed={on}
              aria-label={o.label}
              title={o.label}
              // Re-clicking the active option clears it → inherit the archetype default.
              onClick={() => commit(on ? null : o.value)}
            >
              {Icon ? <Icon aria-hidden /> : <span className="bx-iconrow__txt">{o.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Preview tiles (corners / aspect / weight / columns / size / family / shadow /
//    border / ring / tracking / leading / blur) ──────────────────────────────────
// The demo each chip renders lives in tile-demos.tsx (the data-heavy table); this is
// just the cell frame + grid wiring.

/** One preview chip. Reuses the swatch cell frame (`bx-sw-cell`/`bx-sw`) for shared
 *  sizing + the selected ring; the inner demo is kind-specific (tile-demos). */
export function PreviewTile({
  label,
  selected,
  onSelect,
  kind,
  value,
  fonts = {},
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  kind: TileKind;
  /** null = the empty/"Default" slot (checkerboard). */
  value: string | null;
  /** Resolved tenant fonts — only the `family` kind reads them. */
  fonts?: TileFonts;
}) {
  const none = value === null;
  const { inner, chipStyle } = none
    ? { inner: null, chipStyle: {} as React.CSSProperties }
    : renderTileDemo(kind, value, fonts);
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
        className="bx-sw bx-ptile"
        data-tile={kind}
        data-none={none || undefined}
        style={chipStyle}
      >
        {inner}
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

/** A tile grid for a simple enum control (corners / aspect ratio / font weight). */
export function PreviewTileField({
  node,
  archetype,
  control,
  ctx = '',
  onClass,
  kind,
}: {
  node: BuilderNode;
  archetype: string | undefined;
  control: ClassControl;
  ctx?: string;
  onClass: (value: string) => void;
  kind: TileKind;
}) {
  const current = activeValue(node.class, control, ctx);
  // The Font-family tiles preview the live tenant fonts (probed off the canvas);
  // every other kind ignores this.
  const fonts = useCanvasFonts(kind === 'family');
  const commit = (value: string | null): void =>
    onClass(ensureArchetypeDefaults(applyValue(node.class, control, value, ctx), archetype));
  return (
    <div className="bx-field bx-swatchfield">
      <span className="bx-field__label">{control.label}</span>
      <div
        className="bx-sw-grid"
        data-density="comfortable"
        role="group"
        aria-label={control.label}
      >
        <PreviewTile
          label="Default"
          selected={current === null}
          onSelect={() => commit(null)}
          kind={kind}
          value={null}
          fonts={fonts}
        />
        {control.options.map((o) => (
          <PreviewTile
            key={o.value}
            label={o.label}
            selected={current === o.value}
            onSelect={() => commit(o.value)}
            kind={kind}
            value={o.value}
            fonts={fonts}
          />
        ))}
      </div>
    </div>
  );
}

// ── On/off Switch (grayscale / sepia / invert) ────────────────────────────────
/** A labelled Switch for a two-option (on/off) class group — the friendly form of a
 *  yes/no filter. Checked writes the `on` value; unchecking clears the group back to
 *  the default (visually identical to off, and lets an archetype default show). */
export function SwitchField({
  node,
  archetype,
  control,
  ctx = '',
  onClass,
}: {
  node: BuilderNode;
  archetype: string | undefined;
  control: ClassControl;
  ctx?: string;
  onClass: (value: string) => void;
}) {
  const current = activeValue(node.class, control, ctx);
  const commit = (on: boolean): void =>
    onClass(
      ensureArchetypeDefaults(applyValue(node.class, control, on ? 'on' : null, ctx), archetype)
    );
  return (
    <div className="bx-row">
      <span className="bx-field__label">{control.label}</span>
      <Switch checked={current === 'on'} onCheckedChange={commit} />
    </div>
  );
}

// ── Position pad (background position) ─────────────────────────────────────────
/** The anchor points laid out spatially as a cross (centre + edges) instead of a
 *  dropdown. The corners are intentionally absent — the control carries no corner
 *  values, so a cross reads complete where a gapped 3×3 would look broken. Each cell
 *  is placed by `data-pos` (builder.css); re-clicking the active anchor clears it. */
export function PositionPadField({
  node,
  archetype,
  control,
  ctx = '',
  onClass,
}: {
  node: BuilderNode;
  archetype: string | undefined;
  control: ClassControl;
  ctx?: string;
  onClass: (value: string) => void;
}) {
  const current = activeValue(node.class, control, ctx);
  const commit = (value: string | null): void =>
    onClass(ensureArchetypeDefaults(applyValue(node.class, control, value, ctx), archetype));
  return (
    <div className="bx-field">
      <span className="bx-field__label">{control.label}</span>
      <div className="bx-pospad" role="group" aria-label={control.label}>
        {control.options.map((o) => {
          const on = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              className="bx-pospad__cell"
              data-pos={o.value}
              aria-pressed={on}
              aria-label={o.label}
              title={o.label}
              onClick={() => commit(on ? null : o.value)}
            />
          );
        })}
      </div>
    </div>
  );
}
