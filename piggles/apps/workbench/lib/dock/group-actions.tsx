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
  faCompress,
  faEllipsis,
  faExpand,
  faPictureInPicture,
  faWindow,
  faXmark,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ChromeWindowBoundary } from '@/lib/dock/window-boundary';
import { useWorkbench } from '@/lib/workbench/context';
import { useWindowMode } from '@/lib/window-mode-context';
import { TabScrollButtons } from './tab-scroll';

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

  // Windows mode has no grid, so "tidy this back into" it is an offer nothing
  // can honour — the window would be lifted straight back out (window-mode.ts).
  // The whole-workspace toggle is where somebody goes back to tiling.
  const gridless = useWindowMode() === 'windows';

  return (
    // Keeps these buttons' tooltips and menus in the group's OWN window once it
    // has been torn off — the same fix the panes get, chrome-sized.
    <ChromeWindowBoundary api={props.api}>
      {/* Reaching the tabs that no longer fit. At this end rather than at the
          strip's own edges because these are window controls: everything that
          acts on the bar itself sits together, and a pair of arrows floating
          mid-bar would compete with the tabs they are there to move. */}
      <TabScrollButtons />

      <DropdownMenu>
        <Tooltip content="More">
          <DropdownMenuTrigger>
            <Button color="neutral" variant="ghost" size="xs" shape="square" aria-label="More">
              <Icon glyph={faEllipsis} className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>This window</DropdownMenuLabel>

            {/* Floating is meaningless for a popout — it is already its own OS
                window — so the item is simply absent there rather than present
                and disabled. */}
            {!detached && !gridless ? (
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
                <Icon glyph={faPictureInPicture} className="size-4" aria-hidden />
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
                <Icon glyph={faWindow} className="size-4" aria-hidden />
              ) : (
                <Icon glyph={faWindow} className="size-4" aria-hidden />
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
              <Icon glyph={faCompress} className="size-3.5" aria-hidden />
            ) : (
              <Icon glyph={faExpand} className="size-3.5" aria-hidden />
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
          <Icon glyph={faXmark} className="size-3.5" aria-hidden />
        </Button>
      </Tooltip>
    </ChromeWindowBoundary>
  );
}
