'use client';

// The phone's primary navigation: four destinations, floating, always on screen.
//
// ── WHY A BAR AND NOT A HAMBURGER ───────────────────────────────────────────
//
// Everything used to sit behind one ☰ in the top-left — the furthest point on
// the screen from a thumb, and the pattern the evidence is most consistently
// against: people do not tap what they cannot see. An operator working a counter
// or a stockroom from a phone is the normal case for this app, not the edge.
//
// ── WHY THESE FOUR ──────────────────────────────────────────────────────────
//
//   Home    what needs you. A real destination, opened in the stack.
//   Search  the launcher. It was in the top-right corner; it is what a phone is
//           for, so it moves into thumb reach.
//   Open    what you have open, with a count. This REPLACES the switcher strip
//           that used to be pinned under the stack — a phone browser puts tabs
//           behind a button with a count, and two bars stacked at the bottom is
//           what the status strip was already dropped for.
//   All     every module, then that module's surfaces.
//
// Open wears the hue of the pane you are looking at, which is the only place a
// phone can carry module color once the rail is gone.
//
// It FLOATS, and it floats OVER the sheets rather than under them: navigation is
// never the thing you have to dismiss something else to reach.

import { Home, Layers, Menu, Search, type LucideIcon } from 'lucide-react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { ModuleScope, type WorkbenchModule } from '../module-scope';

export type NavTab = 'home' | 'search' | 'open' | 'all';

interface NavBarProps {
  /** Which sheet is showing, or null when the work is uncovered. */
  active: NavTab | null;
  /** How many panes are open, for the count on Open. */
  openCount: number;
  /** The module the focused pane belongs to — Open takes its hue. */
  activeModule: WorkbenchModule;
  onSelect: (tab: NavTab) => void;
}

interface TabDef {
  key: NavTab;
  label: string;
  Glyph: LucideIcon;
  /** The module whose hue this tab wears. */
  module: WorkbenchModule;
}

export function NavBar({ active, openCount, activeModule, onSelect }: NavBarProps) {
  const tabs: TabDef[] = [
    { key: 'home', label: 'Home', Glyph: Home, module: 'platform' },
    { key: 'search', label: 'Search', Glyph: Search, module: 'platform' },
    { key: 'open', label: 'Open', Glyph: Layers, module: activeModule },
    { key: 'all', label: 'All', Glyph: Menu, module: 'platform' },
  ];

  return (
    // `pointer-events-none` on the gutter so the strip either side of the bar
    // does not swallow taps meant for the surface underneath it.
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3.5 pb-4">
      <nav
        aria-label="Main"
        // The workbench owns this chrome, so the workbench draws its own edge —
        // a border and a raised base tone, never a shadow (DESIGN.md).
        className="border-base-300 bg-base-100 rounded-selector pointer-events-auto grid grid-cols-4 gap-1 border p-1.5"
      >
        {tabs.map((tab) => {
          const on = active === tab.key;
          return (
            <ModuleScope key={tab.key} module={tab.module} className="relative">
              <Button
                block
                // Selection is a FILLED SHAPE (RULE #4) — the 2px underline this
                // pattern usually gets says "you are here" slower than the label
                // can be read. Inactive tabs name NO color: a colorless ghost
                // resolves to base-content and stays right in both themes.
                color={on ? 'module' : undefined}
                variant={on ? 'soft' : 'ghost'}
                aria-current={on ? 'true' : undefined}
                // 52px, over the 44px thumb floor.
                className="min-h-13 flex-col gap-1 text-sm font-medium"
                onClick={() => {
                  onSelect(tab.key);
                }}
              >
                <tab.Glyph className="size-5" aria-hidden />
                {tab.label}
              </Button>

              {tab.key === 'open' && openCount > 0 ? (
                // The ring is the bar's own surface, so the count separates from
                // the glyph AND from the filled pill without knowing which of
                // the two it is sitting on.
                <Badge
                  color="module"
                  size="sm"
                  className="ring-base-100 pointer-events-none absolute top-0.5 left-1/2 ml-1 tabular-nums ring-2"
                >
                  {openCount}
                </Badge>
              ) : null}
            </ModuleScope>
          );
        })}
      </nav>
    </div>
  );
}
