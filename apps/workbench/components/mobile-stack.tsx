'use client';

// The stack — the mobile counterpart to the dock.
//
// One surface fills the screen; the open panes live in a switcher along the
// bottom. That is the same idiom every phone browser uses for tabs, which is
// the point: the gesture is already known, so nothing has to be taught.
//
// It mirrors lib/dock/dock.tsx exactly — own a host, attach it to the
// controller, hydrate from storage, persist on change — and differs in the one
// way that matters: it persists the pane SET only, never an arrangement. See
// persistence.savePanes for why that is not an optimisation but a safety rule.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { X } from 'lucide-react';
import { getSurface, titleFor } from '../lib/surfaces/registry';
import { useWorkbench } from '../lib/workbench/context';
import { StackPaneHost } from '../lib/workbench/stack-host';
import { loadPanes, savePanes } from '../lib/workbench/persistence';
import { DEFAULT_LAYOUT } from '../lib/dock/default-layout';
import { SurfaceMount } from './surface-mount';
import { EmptyWorkbench } from './empty-workbench';

export function MobileStack({ siteKey }: { siteKey: string }) {
  const { controller } = useWorkbench();
  const hostRef = useRef<StackPaneHost | null>(null);
  hostRef.current ??= new StackPaneHost();
  const host = hostRef.current;

  // One subscription is enough: every controller change that the switcher can
  // SEE (a retitle, a retarget, an open, a close) reaches the host and emits
  // from there. Subscribing to the controller as well would re-render on
  // changes the switcher cannot show — and made an unbound-method call besides.
  const stack = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getServerSnapshot);

  useEffect(() => {
    controller.attach(host);

    const stored = loadPanes(siteKey);
    if (stored && Object.keys(stored).length > 0) {
      // Descriptors FIRST, then the host's order — the host holds ids, and an
      // id with no descriptor renders as a missing surface.
      controller.hydrate(stored);
      const titles = Object.fromEntries(
        Object.entries(stored).map(([id, descriptor]) => [id, titleFor(descriptor)])
      );
      host.hydrate(Object.keys(stored), titles);
    } else {
      controller.hydrate({});
      DEFAULT_LAYOUT.forEach((entry) => controller.open(entry.surface, entry.params));
    }

    return () => {
      controller.detach();
    };
  }, [controller, host, siteKey]);

  // Tell the controller what the operator is looking at. Chrome outside the
  // stack (the header's title, the launcher's context) asks the controller, not
  // the host — the dock reports this from dockview's active-panel event, and
  // without the same report here the header sat on "sparx" forever.
  useEffect(() => {
    controller.setActivePane(stack.activeId);
  }, [controller, stack.activeId]);

  // Persist whenever the open set changes. No debounce: unlike a dock there is
  // no splitter drag firing continuously — a write only happens when a pane
  // opens or closes, which is already a discrete act.
  useEffect(() => {
    if (stack.order.length === 0) return;
    savePanes(siteKey, controller.snapshotDescriptors());
  }, [stack.order, controller, siteKey]);

  // Same last line of defence the dock keeps for a hard browser nav.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!controller.hasUnsavedWork()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [controller]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="min-h-0 flex-1">
        {stack.activeId ? (
          <SurfaceMount
            key={stack.activeId}
            paneId={stack.activeId}
            onReset={() => {
              host.show(stack.activeId ?? '');
            }}
          />
        ) : (
          <EmptyWorkbench />
        )}
      </main>

      {stack.order.length > 0 ? (
        <PaneSwitcher host={host} order={stack.order} activeId={stack.activeId} />
      ) : null}
    </div>
  );
}

/**
 * The open panes, as a scrollable strip.
 *
 * Only the ACTIVE chip carries a close button. A row of × targets beside a row
 * of switch targets on a thumb-sized control is a mis-tap generator — and
 * closing a pane you are not looking at is rare enough that costing it one
 * extra tap is the right trade.
 */
function PaneSwitcher({
  host,
  order,
  activeId,
}: {
  host: StackPaneHost;
  order: readonly string[];
  activeId: string | null;
}) {
  const { controller } = useWorkbench();

  return (
    <div
      className="border-base-300 bg-base-200 flex shrink-0 items-center gap-1 overflow-x-auto border-t p-1"
      role="tablist"
      aria-label="Open panels"
    >
      {order.map((paneId) => {
        const descriptor = controller.getDescriptor(paneId);
        const definition = descriptor ? getSurface(descriptor.surface) : undefined;
        const Icon = definition?.icon;
        const active = paneId === activeId;

        return (
          <div key={paneId} className="flex shrink-0 items-center">
            <Button
              role="tab"
              aria-selected={active}
              color={active ? 'module' : 'neutral'}
              variant={active ? 'soft' : 'ghost'}
              size="sm"
              // 44px minimum on the cross axis — the floor for a thumb target.
              className="min-h-11 gap-2"
              onClick={() => {
                host.show(paneId);
              }}
            >
              {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
              <span className="max-w-32 truncate">{host.titleOf(paneId)}</span>
            </Button>

            {active ? (
              <Button
                color="neutral"
                variant="ghost"
                size="sm"
                shape="square"
                className="min-h-11"
                aria-label={`Close ${host.titleOf(paneId)}`}
                onClick={() => {
                  void controller.requestClose(paneId);
                }}
              >
                <X className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        );
      })}

      <Badge color="neutral" variant="soft" size="sm" className="ml-auto shrink-0">
        {order.length}
      </Badge>
    </div>
  );
}
