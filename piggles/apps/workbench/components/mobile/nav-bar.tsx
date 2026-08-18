'use client';

// The phone's primary navigation: four destinations, floating, always on screen.
//
// ── WHY A BAR AND NOT A HAMBURGER ───────────────────────────────────────────
//
// Everything used to sit behind one ☰ in the top-left — the furthest point on
// the screen from a thumb, and the pattern the evidence is most consistently
// against: people do not tap what they cannot see. A business owner doing the
// books in a stockroom is the normal case for this product, not the edge.
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
//   All     every app, then that app's screens.
//
// ── THE COUNT WEARS THE BRAND, NOT THE FOCUSED PANE ─────────────────────────
//
// It used to take the hue of whatever pane was in front, on the reasoning that a
// phone has nowhere else to carry module colour once the rail is gone. That was
// the wrong thing to spend it on. A number that recolours every time you switch
// panes reads as a change in what it MEANS, and it means the same thing every
// time: this many things are open.
//
// ── ICON-ONLY, IN CIRCLES ───────────────────────────────────────────────────
//
// Round buttons in a round bar. Four of them, so each is unambiguous by
// position as well as glyph, and every one carries an `aria-label` because
// there is no visible text to read. This is the one place Piggles drops labels —
// the rail keeps them, deliberately (components/app-rail.tsx).
//
// It FLOATS over the work and over the sheets, which anchor to the bottom edge
// and reserve room for it. A sheet never covers it: you switch from Open to All
// without dismissing anything.

import {
  faGrid2,
  faHouse,
  faLayerGroup,
  faMagnifyingGlass,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon, type PigglesIcon } from '@piggles/ui';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { AppScope } from '@/components/app-scope';

export type NavTab = 'home' | 'search' | 'open' | 'all';

interface NavBarProps {
  /** Which sheet is showing, or null when the work is uncovered. */
  active: NavTab | null;
  /** How many panes are open, for the count on Open. */
  openCount: number;
  /** The app the focused pane belongs to — the selected tab's fill. */
  activeApp: string;
  onSelect: (tab: NavTab) => void;
}

interface TabDef {
  key: NavTab;
  label: string;
  glyph: PigglesIcon;
  /** The app whose hue this tab wears when selected. */
  app: string;
}

export function NavBar({ active, openCount, activeApp, onSelect }: NavBarProps) {
  const tabs: TabDef[] = [
    { key: 'home', label: 'Home', glyph: faHouse, app: 'home' },
    { key: 'search', label: 'Search', glyph: faMagnifyingGlass, app: 'home' },
    { key: 'open', label: 'Open', glyph: faLayerGroup, app: activeApp },
    // Four squares, because it opens a grid of apps — and because a
    // hamburger is the exact shape this bar exists to replace.
    { key: 'all', label: 'All', glyph: faGrid2, app: 'home' },
  ];

  return (
    // `pointer-events-none` on the gutter so the strip either side of the bar
    // does not swallow taps meant for the surface underneath it.
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3.5 pb-4">
      <nav
        aria-label="Main"
        // Piggles owns this chrome, so Piggles lifts it — silica never sees it,
        // so there is no resting shadow to double (DESIGN.md §4).
        className="border-base-300 bg-base-100 rounded-selector pointer-events-auto flex items-center justify-around border p-2 shadow-lg"
      >
        {tabs.map((tab) => {
          const on = active === tab.key;
          return (
            <AppScope key={tab.key} app={tab.app} className="relative">
              <Button
                // Round buttons in a round bar. `lg` puts the circle at 58px,
                // well over the 44px thumb floor.
                shape="circle"
                size="lg"
                // Selection is a FILLED SHAPE (DESIGN.md RULE #4). Unselected
                // tabs name NO colour: a colourless ghost resolves to
                // base-content and stays right in both themes.
                color={on ? 'module' : undefined}
                variant={on ? 'soft' : 'ghost'}
                aria-current={on ? 'true' : undefined}
                // The only name this control has — there is no visible label.
                aria-label={tab.label}
                onClick={() => {
                  onSelect(tab.key);
                }}
              >
                <Icon glyph={tab.glyph} className="size-6" aria-hidden />
              </Button>

              {tab.key === 'open' && openCount > 0 ? (
                // The ring is the bar's own surface, so the count separates from
                // the glyph AND from the filled circle without knowing which of
                // the two it is sitting on.
                <Badge
                  color="primary"
                  size="sm"
                  className="ring-base-100 pointer-events-none absolute -top-0.5 -right-1 tabular-nums ring-2"
                >
                  {openCount}
                </Badge>
              ) : null}
            </AppScope>
          );
        })}
      </nav>
    </div>
  );
}
