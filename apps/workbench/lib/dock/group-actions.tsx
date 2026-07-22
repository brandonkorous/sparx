'use client';

// The tear-off affordance, rendered at the right end of every group's tab strip.
//
// A browser cannot detect a tab dragged outside its own window, so "tear this
// off" has to be an explicit control rather than a drag gesture — dockview's
// popoutUrl only says where a detached group loads, not how one gets detached.
// One button per group: in the main window it moves the group into its own
// window; inside a popout window the same slot offers the way back. Closing a
// popout window also returns its group — the button is the discoverable path,
// not the only one.

import { useEffect, useState } from 'react';
import type { IDockviewHeaderActionsProps } from 'dockview';
import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { AppWindow, PanelsTopLeft } from 'lucide-react';
import { ChromeWindowBoundary } from './window-boundary';

export function GroupActions(props: IDockviewHeaderActionsProps) {
  // Location is live state, not a render-time constant: the SAME group instance
  // survives the move, so the button must re-render from grid → popout.
  const [location, setLocation] = useState(props.api.location.type);
  useEffect(() => {
    const sub = props.api.onDidLocationChange((event) => {
      setLocation(event.location.type);
    });
    return () => {
      sub.dispose();
    };
  }, [props.api]);

  const detached = location === 'popout';

  return (
    // The boundary keeps this button's tooltip in the group's own window once
    // the group is torn off — same fix the panes get, chrome-sized.
    <ChromeWindowBoundary api={props.api}>
      <Tooltip
        content={
          detached
            ? 'Bring these tabs back into the main window'
            : 'Move these tabs to their own window'
        }
      >
        <Button
          color="neutral"
          variant="ghost"
          size="xs"
          shape="square"
          aria-label={
            detached
              ? 'Bring these tabs back into the main window'
              : 'Move these tabs to their own window'
          }
          onClick={() => {
            if (detached) {
              // No target group + a position = dock back into the grid's edge.
              props.api.moveTo({ position: 'right' });
            } else {
              void props.containerApi.addPopoutGroup(props.group);
            }
          }}
        >
          {detached ? (
            <PanelsTopLeft className="size-3.5" aria-hidden />
          ) : (
            <AppWindow className="size-3.5" aria-hidden />
          )}
        </Button>
      </Tooltip>
    </ChromeWindowBoundary>
  );
}
