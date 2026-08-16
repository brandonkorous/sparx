'use client';

// Nothing open.
//
// Reachable on the stack in a way it never was on the dock: closing the last
// pane on a phone leaves a genuinely empty screen, where on desktop the grid
// still framed the space. An empty screen with no way out is a dead end, so
// this always offers the way back in.

import { faGrid } from '@fortawesome/pro-solid-svg-icons';

import { Icon } from '@piggles/ui';
import { Button, EmptyState } from '@wizeworks/silicaui-react';
import { useWorkbench } from '../lib/workbench/context';

export function EmptyWorkbench() {
  const { controller } = useWorkbench();

  return (
    <div className="grid h-full place-items-center p-6">
      <EmptyState
        className="max-w-sm"
        icon={<Icon glyph={faGrid} className="size-8" aria-hidden />}
        title="Nothing open"
        description="Pick something from the menu to get started. Whatever you open stays open until you close it."
        actions={
          <Button
            color="module"
            onClick={() => {
              controller.open('workbench.home');
            }}
          >
            Start here
          </Button>
        }
      />
    </div>
  );
}
