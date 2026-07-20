'use client';

// The launcher — how anything gets opened.
//
// In the dashboard, navigation is a sidebar tree: a fixed hierarchy someone else
// decided. Here it is a search box, because the workbench has no hierarchy to
// navigate — it has a flat catalog of surfaces and an operator who already knows
// what they want. Typing "inv" and pressing Enter beats three clicks down a tree
// every time, and it scales to hundreds of surfaces without a nav redesign.
//
// The modifier keys are the other half of the story, and they are what make this
// a workbench rather than a launcher: Enter opens a tab, ⇧Enter opens it
// alongside what you're looking at, ⌥Enter tears it straight into its own window.
// The operator states where it goes at the moment they ask for it.

import { useMemo } from 'react';
import { CommandPalette, type CommandItem } from '@wizeworks/silicaui-react';
import { useFavorites } from '../lib/api/shell-data';
import { listedSurfaces, resolveTitle, type OpenTarget } from '../lib/surfaces/registry';
import {
  moduleIsVisible,
  useKnownModules,
  useReachableModules,
} from '../lib/surfaces/use-visible-nav';
import { useWorkbench } from '../lib/workbench/context';
import { useFeedback } from './feedback/provider';

/** Title-cases a module key for the palette's group headings. */
function groupLabel(module: string): string {
  return module.charAt(0).toUpperCase() + module.slice(1);
}

export function Launcher({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { controller } = useWorkbench();
  const feedback = useFeedback();
  const { data: favorites } = useFavorites();
  const reachable = useReachableModules();
  const known = useKnownModules();

  const items = useMemo<CommandItem[]>(() => {
    // Favorites float their surfaces into a group at the top — the whole point
    // of starring something is not having to search for it. The favorites table
    // is shared with the dashboard, so only actionIds that name a workbench
    // surface are honored; the rest belong to the other app and stay invisible.
    const favoriteKeys = new Set((favorites ?? []).map((favorite) => favorite.actionId));

    const toItem = (surface: ReturnType<typeof listedSurfaces>[number]): CommandItem => {
      const favorited = favoriteKeys.has(surface.key);
      return {
        id: surface.key,
        label: resolveTitle(surface, {}),
        group: favorited ? '★ Favorites' : groupLabel(surface.module),
        keywords: [...(surface.keywords ?? []), surface.module],
        description: 'Enter · tab   ⇧Enter · alongside   ⌥Enter · new window',
        onSelect: (event?: { shiftKey?: boolean; altKey?: boolean }) => {
          // The palette hands the originating event through, so the modifier
          // held at selection time decides the destination.
          const target: OpenTarget = event?.altKey ? 'window' : event?.shiftKey ? 'beside' : 'tab';
          controller.open(surface.key, undefined, { target });
        },
      };
    };

    // Gated by the SAME rule as the rail and the mobile drawer. The palette
    // used to list the registry raw, which meant a tenant that had never turned
    // Commerce on could still search "orders" and be handed a surface that
    // opens onto a 404 — and now, that a teammate restricted to Invoicing could
    // find their way into every other module by typing its name. The palette is
    // a faster route to a surface, never a wider one.
    const surfaces = listedSurfaces().filter((surface) =>
      moduleIsVisible(surface.module, reachable, known)
    );
    // Sending is the one feedback action that ISN'T a surface — writing a
    // message is a transient dialog, not a place — so it can't come from the
    // registry and is added by hand. Reading (`platform.feedback.list`) needs
    // nothing here: it is a listed surface, so it is already in `surfaces`
    // above, with the same modifier contract as everything else.
    const sendFeedback: CommandItem = {
      id: 'platform.feedback.send',
      label: 'Send feedback',
      group: 'Platform',
      keywords: ['feedback', 'support', 'bug', 'problem', 'idea', 'suggestion', 'contact'],
      description: 'Tell the sparx team something',
      onSelect: () => {
        feedback.openSend({ source: 'command' });
      },
    };

    // Favorites first so their group heads the palette; groups render in
    // first-appearance order.
    return [
      ...surfaces.filter((surface) => favoriteKeys.has(surface.key)).map(toItem),
      ...surfaces.filter((surface) => !favoriteKeys.has(surface.key)).map(toItem),
      sendFeedback,
    ];
  }, [controller, favorites, reachable, known, feedback]);

  return (
    <CommandPalette
      items={items}
      open={open}
      onOpenChange={onOpenChange}
      placeholder="Search for anything — orders, invoices, customers…"
      emptyMessage="Nothing matches that. Try a different word."
    />
  );
}
