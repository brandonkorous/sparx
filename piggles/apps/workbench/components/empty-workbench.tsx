'use client';

// Nothing open.
//
// Closing the last pane on a phone leaves a genuinely empty screen. An empty
// screen with no way out is a dead end, so this always offers the way back in —
// `piggles.home`, this console's Home. `workbench.home` is sparx's and is not
// registered here, so it opened nothing and left the dead end this prevents.

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
              controller.open('piggles.home');
            }}
          >
            Start here
          </Button>
        }
      />
    </div>
  );
}
