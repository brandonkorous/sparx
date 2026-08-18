'use client';

// Every app, as a grid of tiles.
//
// ── WHY A GRID AND NOT A LIST ───────────────────────────────────────────────
//
// Fifteen apps in a column is four thumb-scrolls and reads as a menu. The same
// fifteen in three columns fits one screen, and that is the whole point of this
// sheet: the answer to "what else is there" has to be seeable, not scrollable
// (piggles/CLAUDE.md RULE #2 — everything is included, and the only thing that
// makes that true rather than stated is whether somebody can SEE it).
//
// It is also the one place the six colour groups pay off hardest. At tile size
// the families read instantly — three indigo, three orange, three cyan — which a
// column of rows cannot show you because you only ever see part of it.
//
// ── THE TILES ARE NOT TINTED ────────────────────────────────────────────────
//
// Only the glyph carries its app's hue. Fifteen soft-tinted tiles is fifteen
// competing washes rather than wayfinding, which DESIGN.md rules out directly.
// The tile is a plain outline; the colour sits on the icon, where it separates.

import { Icon } from '@piggles/ui';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { AppScope } from '@/components/app-scope';
import { appWaiting } from '@/components/rail/waiting';
import type { useAttention } from '@/lib/console/home-data';
import type { ConsoleNavApp } from '@/lib/console/nav';

type Attention = ReturnType<typeof useAttention>;

interface AppGridProps {
  nav: ConsoleNavApp[];
  attention: Attention;
  onPick: (appId: string) => void;
}

export function AppGrid({ nav, attention, onPick }: AppGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2 p-2">
      {nav.map((entry) => {
        const waiting = appWaiting(entry, attention);
        return (
          <AppScope key={entry.app.id} app={entry.app.id} className="relative">
            <Button
              block
              // Colourless on purpose: the tile is a container and names no
              // colour, so it resolves to base-content and stays right in both
              // themes. The hue lives on the glyph.
              variant="outline"
              // 96px — a comfortable thumb target that still fits five rows of
              // three on a phone without scrolling.
              className="min-h-24 flex-col gap-2 px-1 text-sm font-medium"
              onClick={() => {
                onPick(entry.app.id);
              }}
            >
              <Icon glyph={entry.icon} className="text-module size-6" aria-hidden />
              <span className="w-full truncate text-center">{entry.label}</span>
            </Button>

            {/* The same count the rail shows for this app, from the same rollup.
                Positioned as a sibling — `Button` has no badge slot, and a
                button inside a button is invalid HTML. */}
            {waiting === null ? null : (
              <Badge
                color="module"
                variant="soft"
                size="sm"
                className="pointer-events-none absolute top-1.5 right-1.5 tabular-nums"
              >
                {waiting > 99 ? '99+' : waiting}
              </Badge>
            )}
          </AppScope>
        );
      })}
    </div>
  );
}
