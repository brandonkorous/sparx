'use client';

// What you have open, as a sheet.
//
// This is the pane switcher that used to be a strip pinned under the stack. It
// is the same information and the same job; what changed is that it costs a tap
// instead of a permanent bar, which is what a phone browser does with tabs and
// what leaves room for the nav bar to exist at all.
//
// The strip could only ever show two or three chips before scrolling sideways.
// A sheet shows every pane, full width, with the module each one belongs to — so
// "which of these is the invoice" is answerable without opening them.

import { X } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { getSurface } from '../../lib/surfaces/registry';
import { moduleLabel } from '../../lib/surfaces/nav';
import { useWorkbench } from '../../lib/workbench/context';
import type { StackPaneHost } from '../../lib/workbench/stack-host';
import { ModuleScope } from '../module-scope';
import { Sheet } from './sheet';

interface OpenSheetProps {
  open: boolean;
  host: StackPaneHost;
  order: readonly string[];
  activeId: string | null;
  onDismiss: () => void;
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
          const Icon = definition?.icon;
          const focused = paneId === activeId;

          return (
            <ModuleScope key={paneId} module={definition?.module ?? 'platform'}>
              <div className="flex items-center gap-1">
                <Button
                  block
                  // The one you are looking at is filled; the rest are
                  // colourless, which resolves to base-content in both themes.
                  color={focused ? 'module' : undefined}
                  variant={focused ? 'soft' : 'ghost'}
                  aria-current={focused ? 'true' : undefined}
                  className="min-h-13 justify-start gap-3 text-base"
                  onClick={() => {
                    host.show(paneId);
                    onDismiss();
                  }}
                >
                  {Icon ? <Icon className="text-module size-5" aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate text-start">{host.titleOf(paneId)}</span>
                  {definition ? (
                    <span className="text-sm">{moduleLabel(definition.module)}</span>
                  ) : null}
                </Button>

                {/* Closing ONE pane. The strip this replaced put a × on the
                    active chip, so dropping it would make "close just this"
                    impossible on one column — the stack has no other close
                    affordance. It is a full 52px target sitting apart from the
                    switch target, which is what the strip could not afford at
                    chip size. */}
                <Button
                  color="danger"
                  variant="ghost"
                  shape="square"
                  className="min-h-13 min-w-13"
                  aria-label={`Close ${host.titleOf(paneId)}`}
                  onClick={() => {
                    void controller.requestClose(paneId);
                  }}
                >
                  <X className="size-5" aria-hidden />
                </Button>
              </div>
            </ModuleScope>
          );
        })}
      </div>
    </Sheet>
  );
}
