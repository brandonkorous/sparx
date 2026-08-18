'use client';

// The stack — the mobile counterpart to the dock.
//
// One surface fills the screen. The open panes used to live in a switcher strip
// pinned along the bottom of this component; they now live behind the Open tab
// in the shell's nav bar (./mobile-shell.tsx), which is the same idiom stated
// properly — a phone browser puts its tabs behind a button with a count, not in
// a permanent strip. Two bars stacked at the bottom of a phone was the thing the
// status strip was already dropped for.
//
// It mirrors lib/dock/dock.tsx exactly — attach to the controller, hydrate from
// storage, persist on change — and differs in the one way that matters: it
// persists the pane SET only, never an arrangement. See persistence.savePanes
// for why that is not an optimisation but a safety rule.
//
// The HOST belongs to the shell, not to this component. The nav bar has to be
// able to switch panes, so whoever renders both has to own it.

import { useEffect, useSyncExternalStore } from 'react';
import { titleFor } from '../lib/surfaces/registry';
import { useWorkbench } from '../lib/workbench/context';
import type { StackPaneHost } from '../lib/workbench/stack-host';
import { loadPanes, savePanes } from '../lib/workbench/persistence';
import { DEFAULT_LAYOUT } from '../lib/dock/default-layout';
import { SurfaceMount } from './surface-mount';
import { EmptyWorkbench } from './empty-workbench';

export function MobileStack({ siteKey, host }: { siteKey: string; host: StackPaneHost }) {
  const { controller } = useWorkbench();

  // One subscription is enough: every controller change that the stack can SEE
  // (a retitle, a retarget, an open, a close) reaches the host and emits from
  // there. Subscribing to the controller as well would re-render on changes the
  // stack cannot show — and made an unbound-method call besides.
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
  // stack (the header's title, the launcher's context, the nav bar's hue) asks
  // the controller, not the host — the dock reports this from dockview's
  // active-panel event, and without the same report here the header sat on
  // "sparx" forever.
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
      // See dock.tsx: an intentional site-switch reload must not be re-prompted.
      if (controller.isUnloadIntentional()) return;
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
    // The padding is the nav bar's room. The bar floats over this box, so a
    // surface that scrolls to its own end would otherwise end underneath it —
    // it needs room to scroll clear of one. A surface cannot know that, and it
    // must not have to.
    <div className="flex min-h-0 flex-1 flex-col pb-24">
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
    </div>
  );
}
