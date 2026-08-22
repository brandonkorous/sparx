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
import { useConfirm } from '@/lib/confirm';
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
  const confirm = useConfirm();

  /** Asks first, then stops at the first pane somebody chose to keep — the
   *  batch contract `requestClose` documents for exactly this.
   *
   *  The desktop's "Close everything and start empty" has always confirmed and
   *  said whether anything was unsaved; the phone's did neither, so one tap
   *  closed every pane open. Same action, same question. */
  const closeEverything = async () => {
    const dirty = controller.dirtyPanes().length;
    const ok = await confirm({
      title: `Close all ${String(order.length)}?`,
      description: dirty
        ? `${dirty === 1 ? 'One of them has' : `${String(dirty)} of them have`} unsaved edits, and you will be asked about ${dirty === 1 ? 'it' : 'each one'} on the way through.`
        : 'Nothing here has unsaved edits. Your saved layouts are not affected.',
      confirmLabel: 'Close them',
      cancelLabel: 'Keep them open',
      color: 'danger',
    });
    if (!ok) return;

    for (const paneId of [...order]) {
      const closed = await controller.requestClose(paneId);
      // Kept one: the sheet stays open showing what is left, rather than
      // dismissing as though the whole thing had gone through.
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
