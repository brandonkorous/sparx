'use client';

// Every module, as a grid of tiles.
//
// ── WHY A GRID AND NOT A LIST ───────────────────────────────────────────────
//
// Twenty modules in a column is four thumb-scrolls and reads as a menu. The same
// twenty in three columns fits one screen, and that is the whole point of this
// sheet: the answer to "what else is there" has to be seeable, not scrollable.
//
// It is also the one place the module hues pay off hardest. At tile size the
// families read instantly — the selling ones, the content ones, the money ones —
// which a column of rows cannot show you because you only ever see part of it.
//
// ── THE TILES ARE NOT TINTED ────────────────────────────────────────────────
//
// Only the glyph carries its module's hue. Twenty soft-tinted tiles is twenty
// competing washes rather than wayfinding, which DESIGN.md rules out directly.
// The tile is a plain outline; the color sits on the icon, where it separates.

import { Button } from '@wizeworks/silicaui-react';
import type { NavModule } from '../../lib/surfaces/nav';
import { ModuleScope, type WorkbenchModule } from '../module-scope';

interface ModuleGridProps {
  nav: NavModule[];
  onPick: (module: WorkbenchModule) => void;
}

export function ModuleGrid({ nav, onPick }: ModuleGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2 p-2">
      {nav.map((entry) => (
        <ModuleScope key={entry.module} module={entry.module}>
          <Button
            block
            // Colorless on purpose: the tile is a container and names no
            // color, so it resolves to base-content and stays right in both
            // themes. The hue lives on the glyph.
            variant="outline"
            // 96px — a comfortable thumb target that still fits five rows of
            // three on a phone without scrolling.
            className="min-h-24 flex-col gap-2 px-1 text-sm font-medium"
            onClick={() => {
              onPick(entry.module);
            }}
          >
            <entry.icon className="text-module size-6" aria-hidden />
            <span className="w-full truncate text-center">{entry.label}</span>
          </Button>
        </ModuleScope>
      ))}
    </div>
  );
}
