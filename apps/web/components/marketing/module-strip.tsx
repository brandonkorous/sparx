import type { CSSProperties } from 'react';
import { MODULES, MODULE_ICON, MODULE_HEX, type ModuleEntry } from './modules-catalog';

// The module strip — every module as a hued chip carrying the SAME Lucide glyph
// its dashboard sidebar entry uses (identity by shape, color by hue). Replaces
// the old "row of plain dots". Reused across the hero, marketing sections, and
// the edge-runtime OG images — so it depends ONLY on the data catalog
// (lucide-react + plain data), never on the DOM-pulling primitives, and uses
// Satori-safe markup: plain divs, `display: flex`, literal hex (no CSS vars),
// and the glyph inheriting `currentColor` from the chip.

interface ModuleStripProps {
  /** Chip edge length in px; the glyph scales with it. Default 27. */
  size?: number;
  /** Gap between chips in px. Default 8. */
  gap?: number;
  /** Glyph color. Default white — reads on every module hue, including the
   *  light amber Inventory chip, better than the per-module ink would. */
  iconColor?: string;
  /** Chip border. Default a faint white hairline, which delineates chips on a
   *  dark/indigo field (notably Builder, whose hue is the indigo itself) and is
   *  invisibly harmless on a light one. */
  border?: string;
  /** Let chips wrap to a second row. Off for single-line strips (e.g. OG). */
  wrap?: boolean;
  /** Which modules to draw. Defaults to the full catalog; pass `PAID_MODULES` for
   *  the 12 billable ones (e.g. an OG card whose label reads "12 modules"). */
  modules?: readonly ModuleEntry[];
  style?: CSSProperties;
}

export function ModuleStrip({
  size = 27,
  gap = 8,
  iconColor = '#FFFFFF',
  border = '1px solid rgba(255, 255, 255, 0.28)',
  wrap = true,
  modules = MODULES,
  style,
}: ModuleStripProps) {
  const iconSize = Math.round(size * 0.52);
  const radius = Math.round(size * 0.3);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap,
        ...style,
      }}
    >
      {modules.map((m) => {
        const Icon = MODULE_ICON[m.id];
        return (
          <div
            key={m.id}
            title={m.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: MODULE_HEX[m.id],
              border,
              color: iconColor,
            }}
          >
            <Icon size={iconSize} strokeWidth={2} aria-hidden />
          </div>
        );
      })}
    </div>
  );
}
