'use client';

// The themed colour picker for the inspector (replaces the colour `<select>`s).
//
// Colours in the builder are SEMANTIC TOKENS (`st-c-primary`, `bg-accent`,
// `text-primary-content`, …) — never raw hex — so a site re-theme recolours every
// node for free. A dropdown shows the WORD "Primary"; this shows the site's actual
// Primary. The swatches read the live tenant `--st-*` palette straight off the
// mounted `.bx-canvas` (the same vars the preview paints with, kept live by the
// Theme panel), so they always reflect THIS site. Writing still goes through the
// exact same class-group helpers (`applyValue` / `applyColorOpacity`) the selects
// used — only the control surface changed.

import * as React from 'react';
import type { BuilderNode } from '@sparx/builder-schemas';
import {
  activeValue,
  applyColorOpacity,
  applyValue,
  ensureArchetypeDefaults,
  readColorOpacity,
  type ClassControl,
  type ClassOption,
} from './class-controls';
import { FALLBACK, ST_VARS, colorNameFromToken, gradeContrast, paintExpr } from './color-tokens';
import { SwatchCell, type SwatchMode } from './swatch-cell';

// Layout-effect on the client (paint swatches with the real palette before the
// browser shows them, no flash), plain effect on the server (avoids the SSR warning).
const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/** Resolve the live tenant palette to concrete colours by probing `.bx-canvas`.
 *  Runs once per mount (the inspector remounts on node-select, and theme edits
 *  happen in a different zone where this panel is unmounted — so a mount-time read
 *  always reflects the current theme). Returns `{}` when no canvas is present. */
function useCanvasThemeVars(): Record<string, string> {
  const [vars, setVars] = React.useState<Record<string, string>>({});
  useIsoLayoutEffect(() => {
    const canvas = document.querySelector('.bx-canvas');
    if (!canvas) return;
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
    canvas.appendChild(probe);
    const out: Record<string, string> = {};
    for (const v of ST_VARS) {
      probe.style.color = `var(${v})`;
      const c = getComputedStyle(probe).color;
      if (c) out[v] = c;
    }
    probe.remove();
    setVars(out);
  }, []);
  return vars;
}

/** The recipe colour a node previews in — its own `st-c-*`, else the archetype's
 *  default, else primary. Drives the Emphasis chips so they preview in the colour
 *  the element actually uses. */
function recipeColorName(classStr: string | undefined, archetype: string | undefined): string {
  const scan = (s: string | undefined): string | null => {
    for (const t of (s ?? '').split(/\s+/)) if (t.startsWith('st-c-')) return t.slice(5);
    return null;
  };
  return scan(classStr) ?? scan(archetype) ?? 'primary';
}

const OPACITY_MIN = 10;

// ── The field ────────────────────────────────────────────────────────────────
export function ColorSwatchField({
  node,
  archetype,
  control,
  ctx = '',
  onClass,
  withOpacity = false,
  mode = 'fill',
  emphasisVariant = 'solid',
  showContrast = false,
  density = 'comfortable',
}: {
  node: BuilderNode;
  /** The node's archetype default class (`def.defaults.class`) — backfills the
   *  structural base + unset axes so styling never collapses the element. */
  archetype: string | undefined;
  control: ClassControl;
  ctx?: string;
  onClass: (value: string) => void;
  /** Colour utilities that accept a Tailwind `/NN` alpha (bg / text / border). */
  withOpacity?: boolean;
  mode?: SwatchMode;
  /** Recipe mode: the node's current Emphasis value, so swatches preview that treatment. */
  emphasisVariant?: string | null;
  /** Text mode: show the AA/AAA contrast badge against the node's background. */
  showContrast?: boolean;
  /** Compact = smaller chips, labels hidden (tooltip only) — for secondary/advanced
   *  colour controls (shadow / ring / caret / accent / gradient stops). */
  density?: 'comfortable' | 'compact';
}) {
  const vars = useCanvasThemeVars();
  const containerStyle = {
    ...vars,
    '--sw-page-ink': vars['--st-base-content'] ?? FALLBACK['base-content'],
  } as React.CSSProperties;

  const current = withOpacity
    ? readColorOpacity(node.class, control, ctx)
    : { value: activeValue(node.class, control, ctx), opacity: 100 };

  const commit = (value: string | null, opacity: number): void => {
    const next = withOpacity
      ? applyColorOpacity(node.class, control, value, opacity, ctx)
      : applyValue(node.class, control, value, ctx);
    onClass(ensureArchetypeDefaults(next, archetype));
  };

  const treat = emphasisVariant ?? 'solid';
  const selectedName = current.value
    ? colorNameFromToken(control.options.find((o) => o.value === current.value)?.token ?? '')
    : null;
  const verdict =
    showContrast && current.value && selectedName
      ? gradeContrast(selectedName, current.opacity, vars, node, ctx)
      : null;

  return (
    <div className="bx-field bx-swatchfield">
      <span className="bx-field__label">{control.label}</span>
      <div
        className="bx-sw-grid"
        data-density={density}
        style={containerStyle}
        role="group"
        aria-label={control.label}
      >
        {/* Default = clear the group (inherit the archetype's own value) — distinct
            from an explicit "None"/transparent option a control may also offer. */}
        <SwatchCell
          label="Default"
          selected={current.value === null}
          onSelect={() => commit(null, current.opacity)}
          mode={mode}
          name={null}
          treat={treat}
          vars={vars}
        />
        {control.options.map((o: ClassOption) => (
          <SwatchCell
            key={o.value}
            label={o.label}
            selected={current.value === o.value}
            onSelect={() => commit(o.value, current.opacity)}
            mode={mode}
            name={colorNameFromToken(o.token)}
            treat={treat}
            vars={vars}
          />
        ))}
      </div>

      {withOpacity && current.value ? (
        <div
          className="bx-sw-opacity"
          style={
            {
              '--sw-op-color': paintExpr(selectedName ?? 'primary') ?? '#888',
            } as React.CSSProperties
          }
        >
          <input
            className="bx-range bx-sw-opacity__track"
            type="range"
            min={OPACITY_MIN}
            max={100}
            step={5}
            value={current.opacity}
            aria-label={`${control.label} opacity`}
            onChange={(e) => commit(current.value, Number(e.target.value))}
          />
          <output className="bx-sw-opacity__out">
            {current.opacity === 100 ? 'Solid' : `${current.opacity}%`}
          </output>
        </div>
      ) : null}

      {verdict ? (
        <div className="bx-sw-contrast" data-grade={verdict.cls}>
          <span className="bx-sw-contrast__dot" aria-hidden />
          <span className="bx-sw-contrast__tier">{verdict.tier}</span>
          <span className="bx-sw-contrast__ratio">{verdict.ratio}:1</span>
          <span className="bx-sw-contrast__hint">
            {verdict.cls === 'fail' ? 'hard to read — try another' : 'readable on this background'}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ── Emphasis (treatment) picker ──────────────────────────────────────────────
// The recipe Variant axis as visual chips instead of a dropdown: each chip is the
// node's CURRENT colour rendered in that treatment (solid / soft / outline / …),
// so a user picks the emphasis they can see. Writes the same `st-v-*` group the
// select did (applyValue), backfilling archetype defaults like every recipe axis.
export function EmphasisSwatchField({
  node,
  archetype,
  control,
  onClass,
}: {
  node: BuilderNode;
  archetype: string | undefined;
  control: ClassControl;
  onClass: (value: string) => void;
}) {
  const vars = useCanvasThemeVars();
  const containerStyle = {
    ...vars,
    '--sw-page-ink': vars['--st-base-content'] ?? FALLBACK['base-content'],
  } as React.CSSProperties;
  const colorName = recipeColorName(node.class, archetype);
  const current = activeValue(node.class, control);
  const commit = (value: string | null): void =>
    onClass(ensureArchetypeDefaults(applyValue(node.class, control, value), archetype));

  return (
    <div className="bx-field bx-swatchfield">
      <span className="bx-field__label">{control.label}</span>
      <div
        className="bx-sw-grid"
        data-density="comfortable"
        style={containerStyle}
        role="group"
        aria-label={control.label}
      >
        {/* Default = clear the group → inherit the archetype's built-in emphasis. */}
        <SwatchCell
          label="Default"
          selected={current === null}
          onSelect={() => commit(null)}
          mode="recipe"
          name={null}
          treat="solid"
          vars={vars}
        />
        {control.options.map((o: ClassOption) => (
          <SwatchCell
            key={o.value}
            label={o.label}
            selected={current === o.value}
            onSelect={() => commit(o.value)}
            mode="recipe"
            name={colorName}
            treat={o.value}
            vars={vars}
          />
        ))}
      </div>
    </div>
  );
}
