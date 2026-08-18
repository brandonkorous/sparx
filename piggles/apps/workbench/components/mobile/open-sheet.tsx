'use client';

// What you have open, as a sheet.
//
// This is the pane switcher that used to be a strip pinned under the stack. It
// is the same information and the same job; what changed is that it costs a tap
// instead of a permanent bar, which is what a phone browser does with tabs and
// what leaves room for the nav bar to exist at all.
//
// The strip could only ever show two or three chips before scrolling sideways.
// A sheet shows every pane, full width, with the app each one belongs to — so
// "which of these is the invoice" is answerable without opening them.

import { Icon } from '@piggles/ui';
import { Button } from '@wizeworks/silicaui-react';
import { getSurface } from '@/lib/surfaces/registry';
import { useWorkbench } from '@/lib/workbench/context';
import type { StackPaneHost } from '@/lib/workbench/stack-host';
import { ModuleScope } from '@/components/module-scope';
import { moduleLabel } from '@/lib/surfaces/nav';
import { Sheet } from './sheet';

interface OpenSheetProps {
  open: boolean;
  host: StackPaneHost;
  order: readonly string[];
  activeId: string | null;
  onDismiss: () => void;
}

/** Open, and which one you are looking at — the same two marks the desktop
 *  panel's rows carry, so one shape means one thing in both presentations. */
function PaneMark({ focused }: { focused: boolean }) {
  return (
    <span
      aria-hidden
      className={
        focused
          ? 'bg-module size-2 shrink-0 rounded-full'
          : 'border-module size-2 shrink-0 rounded-full border-2'
      }
    />
  );
}

export function OpenSheet({ open, host, order, activeId, onDismiss }: OpenSheetProps) {
  const { controller } = useWorkbench();

  /** Stops at the first pane somebody chose to keep, rather than closing past
   *  it — the batch contract `requestClose` documents for exactly this. */
  const closeEverything = async () => {
    for (const paneId of [...order]) {
      const closed = await controller.requestClose(paneId);
      if (!closed) return;
    }
    onDismiss();
  };

  return (
    <Sheet
      open={open}
      title="Open"
      hint="tap to switch"
      onDismiss={onDismiss}
      footer={
        <Button
          block
          color="danger"
          variant="outline"
          className="min-h-13"
          onClick={() => {
            void closeEverything();
          }}
        >
          Close everything
        </Button>
      }
    >
      <div className="flex flex-col gap-1">
        {order.map((paneId) => {
          const descriptor = controller.getDescriptor(paneId);
          const definition = descriptor ? getSurface(descriptor.surface) : undefined;
          const focused = paneId === activeId;

          return (
            <ModuleScope key={paneId} module={definition?.module ?? 'platform'}>
              <Button
                block
                // The one you are looking at is filled; the rest are colourless,
                // which resolves to base-content in both themes.
                color={focused ? 'module' : undefined}
                variant={focused ? 'soft' : 'ghost'}
                aria-current={focused ? 'true' : undefined}
                className="min-h-13 justify-start gap-3 text-base"
                onClick={() => {
                  host.show(paneId);
                  onDismiss();
                }}
              >
                {definition ? (
                  <Icon glyph={definition.icon} className="text-module size-5" aria-hidden />
                ) : null}
                <span className="min-w-0 flex-1 truncate text-start">{host.titleOf(paneId)}</span>
                {definition ? (
                  <span className="text-sm">{moduleLabel(definition.module)}</span>
                ) : null}
                <PaneMark focused={focused} />
              </Button>
            </ModuleScope>
          );
        })}
      </div>
    </Sheet>
  );
}
