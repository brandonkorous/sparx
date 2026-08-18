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
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@wizeworks/silicaui-react';
import { getSurface } from '../../lib/surfaces/registry';
import { moduleLabel } from '../../lib/surfaces/nav';
import { useWorkbench } from '../../lib/workbench/context';
import type { StackPaneHost } from '../../lib/workbench/stack-host';
import { ModuleScope } from '../module-scope';

interface OpenSheetProps {
  open: boolean;
  host: StackPaneHost;
  order: readonly string[];
  activeId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function OpenSheet({ open, host, order, activeId, onOpenChange }: OpenSheetProps) {
  const { controller } = useWorkbench();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {/* Stops short of the bottom so the nav bar floating over it stays whole —
          the bar is how you leave, and covering it would make Open a trap. */}
      <DrawerContent side="bottom" className="max-h-[70dvh] pb-24">
        <DrawerHeader sticky>
          <DrawerTitle>Open</DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-1 p-2">
          {order.map((paneId) => {
            const descriptor = controller.getDescriptor(paneId);
            const definition = descriptor ? getSurface(descriptor.surface) : undefined;
            const Icon = definition?.icon;
            const isActive = paneId === activeId;

            return (
              <ModuleScope key={paneId} module={definition?.module ?? 'platform'}>
                <div className="flex items-center gap-1">
                  <Button
                    block
                    // The one you are looking at is filled; the rest are
                    // colourless, which resolves to base-content in both themes.
                    color={isActive ? 'module' : undefined}
                    variant={isActive ? 'soft' : 'ghost'}
                    aria-current={isActive ? 'true' : undefined}
                    className="min-h-13 justify-start gap-3 text-base"
                    onClick={() => {
                      host.show(paneId);
                      onOpenChange(false);
                    }}
                  >
                    {Icon ? <Icon className="text-module size-5" aria-hidden /> : null}
                    <span className="min-w-0 flex-1 truncate text-start">
                      {host.titleOf(paneId)}
                    </span>
                    {definition ? (
                      <span className="text-sm">{moduleLabel(definition.module)}</span>
                    ) : null}
                  </Button>

                  {/* Every row can close, not just the active one. The strip
                      allowed only the active one because a row of × targets
                      beside a row of switch targets is a mis-tap generator at
                      chip size — at 52px full width they are far enough apart. */}
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
      </DrawerContent>
    </Drawer>
  );
}
