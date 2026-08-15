'use client';

// The right end of a window's title bar.
//
// Two controls, matching what a window looks like it should have: make it fill
// the workspace, and close it. Everything rarer lives behind the menu that only
// appears when it has something to say.
//
// ── WHY THERE IS A "FLOAT THIS" ITEM AT ALL ─────────────────────────────────
//
// dockview floats a group when a tab is dragged into empty space. A tiled grid
// HAS no empty space, so floating was enabled, documented and completely
// unreachable — the capability existed and the door did not. The console now has
// a windows/tabs toggle for the whole workspace (lib/window-mode.ts); this is the
// per-window version of the same thing, for somebody who wants one thing loose
// and everything else tidy.
//
// ── AND WHY TEAR-OFF IS A BUTTON RATHER THAN A GESTURE ──────────────────────
//
// A browser cannot detect a tab dragged outside its own window, so "move this to
// its own window" has to be an explicit control. dockview's `popoutUrl` only
// says where a detached group loads, not how one gets detached.

import { useEffect, useState } from 'react';
import type { IDockviewHeaderActionsProps } from 'dockview';
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
import {
  AppWindow,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelsTopLeft,
  PictureInPicture2,
  X,
} from 'lucide-react';
import { ChromeWindowBoundary } from '@/lib/dock/window-boundary';
import { useWorkbench } from '@/lib/workbench/context';

export function GroupActions(props: IDockviewHeaderActionsProps) {
  const { controller } = useWorkbench();

  // Location is live state, not a render-time constant: the SAME group instance
  // survives a move, so these must re-render grid → floating → popout.
  const [location, setLocation] = useState(props.api.location.type);
  useEffect(() => {
    const sub = props.api.onDidLocationChange((event) => {
      setLocation(event.location.type);
    });
    return () => {
      sub.dispose();
    };
  }, [props.api]);

  const [maximized, setMaximized] = useState(props.api.isMaximized());
  useEffect(() => {
    // dockview has no per-group "did maximize change" event, so this re-reads on
    // any layout change — which is what maximizing is.
    const sub = props.containerApi.onDidLayoutChange(() => {
      setMaximized(props.api.isMaximized());
    });
    return () => {
      sub.dispose();
    };
  }, [props.api, props.containerApi]);

  const detached = location === 'popout';
  const floating = location === 'floating';

  return (
    // Keeps these buttons' tooltips and menus in the group's OWN window once it
    // has been torn off — the same fix the panes get, chrome-sized.
    <ChromeWindowBoundary api={props.api}>
      <DropdownMenu>
        <Tooltip content="More">
          <DropdownMenuTrigger>
            <Button color="neutral" variant="ghost" size="xs" shape="square" aria-label="More">
              <MoreHorizontal className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>This window</DropdownMenuLabel>

            {/* Floating is meaningless for a popout — it is already its own OS
                window — so the item is simply absent there rather than present
                and disabled. */}
            {!detached ? (
              <DropdownMenuItem
                onClick={() => {
                  if (floating) {
                    // No target group + a position docks it against the grid's
                    // edge — the same call that brings a popout back, so a
                    // window returns to the grid identically however it left.
                    props.api.moveTo({ position: 'right' });
                  } else {
                    props.containerApi.addFloatingGroup(props.group);
                  }
                }}
              >
                <PictureInPicture2 className="size-4" aria-hidden />
                {floating ? 'Tidy this back into the grid' : 'Let this float freely'}
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuItem
              onClick={() => {
                if (detached) {
                  props.api.moveTo({ position: 'right' });
                } else {
                  void props.containerApi.addPopoutGroup(props.group);
                }
              }}
            >
              {detached ? (
                <PanelsTopLeft className="size-4" aria-hidden />
              ) : (
                <AppWindow className="size-4" aria-hidden />
              )}
              {detached ? 'Bring this back' : 'Move to its own window'}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              // Through the controller, never `group.api.close()` — the guard
              // conversation for unsaved work lives there, and closing a whole
              // window is the most expensive way to lose something.
              const ids = props.panels.map((panel) => panel.id);
              void (async () => {
                for (const id of ids) {
                  const closed = await controller.requestClose(id);
                  if (!closed) break;
                }
              })();
            }}
          >
            Close everything in here
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Maximize is hidden for popouts and floating windows: a popout already
          owns its screen, and a floating window is resized by dragging it. */}
      {!detached && !floating ? (
        <Tooltip content={maximized ? 'Put it back' : 'Make this fill the workspace'}>
          <Button
            color="neutral"
            variant="ghost"
            size="xs"
            shape="square"
            aria-label={maximized ? 'Restore this window' : 'Make this window fill the workspace'}
            aria-pressed={maximized}
            onClick={() => {
              if (maximized) props.api.exitMaximized();
              else props.api.maximize();
              setMaximized(!maximized);
            }}
          >
            {maximized ? (
              <Minimize2 className="size-3.5" aria-hidden />
            ) : (
              <Maximize2 className="size-3.5" aria-hidden />
            )}
          </Button>
        </Tooltip>
      ) : null}

      <Tooltip content="Close">
        <Button
          color="neutral"
          variant="ghost"
          size="xs"
          shape="square"
          aria-label="Close this window"
          onClick={() => {
            const ids = props.panels.map((panel) => panel.id);
            void (async () => {
              for (const id of ids) {
                const closed = await controller.requestClose(id);
                if (!closed) break;
              }
            })();
          }}
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </Tooltip>
    </ChromeWindowBoundary>
  );
}
