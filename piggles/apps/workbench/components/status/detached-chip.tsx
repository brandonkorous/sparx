'use client';

// Panes torn onto other monitors — the one fact this window cannot show.
// Lifted out of components/status-bar.tsx, which had grown past the 250-line
// ceiling (piggles/CLAUDE.md RULE #0.5). The strip itself is now just the strip.

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { faWindow } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { getSurface, resolveTitle } from '../../lib/surfaces/registry';
import { useWorkbench } from '../../lib/workbench/context';
import type { DetachedWindow } from '../../lib/workbench/pane-host';

/**
 * The detached-windows chip: how many windows, what's in them, and the two
 * things you ever want to do about one.
 *
 * A menu rather than a plain count because the count alone is the least useful
 * half — "2 windows" you can't name is barely better than not knowing. Each row
 * FOCUSES its window (the common case: it's buried, bring it forward) and every
 * window can be brought home, for the monitor you just unplugged.
 */
export function DetachedChip({ windows }: { windows: DetachedWindow[] }) {
  const { controller } = useWorkbench();

  /** A window's human name: its panes, or a count once that stops fitting.
   *  Named `entry`, not `window` — shadowing the global inside a component
   *  that also lives in a multi-window app is a trap waiting to be sprung. */
  const label = (entry: DetachedWindow): string => {
    const titles = entry.paneIds.map((paneId) => {
      const descriptor = controller.getDescriptor(paneId);
      if (!descriptor) return 'Pane';
      if (descriptor.title) return descriptor.title;
      const definition = getSurface(descriptor.surface);
      return definition ? resolveTitle(definition, descriptor.params ?? {}) : descriptor.surface;
    });
    if (titles.length === 0) return 'Empty window';
    if (titles.length <= 2) return titles.join(', ');
    return `${titles[0] ?? ''} +${String(titles.length - 1)} more`;
  };

  return (
    <DropdownMenu>
      <Tooltip content="Panes torn into their own windows">
        <DropdownMenuTrigger>
          <Button variant="ghost" size="xs" className="gap-1.5">
            <Icon glyph={faWindow} className="size-3.5" aria-hidden />
            {windows.length === 1 ? '1 window' : `${String(windows.length)} windows`}
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end">
        {/* Base UI requires a label to live inside a Group — a bare
            DropdownMenuLabel throws MenuGroupRootContext at runtime. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Detached windows</DropdownMenuLabel>
          {windows.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              onClick={() => {
                entry.focus();
              }}
            >
              <span className="max-w-64 truncate">{label(entry)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              // Redocking mutates the arrangement as it iterates, so walk a
              // copy — splicing the live list mid-loop would skip windows.
              for (const entry of [...windows]) entry.redock();
            }}
          >
            Bring them all back here
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
