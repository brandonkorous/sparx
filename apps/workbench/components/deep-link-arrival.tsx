'use client';

// The arrival gate — a null-rendering component that follows the link the page
// was opened with, once there is somewhere to follow it to.
//
// It is a component rather than something the dock calls in `onReady` for two
// reasons, and both were bugs before:
//
//   • The dock is not the only presentation. Sitting above BOTH the dock and the
//     mobile stack means a link works the same on a phone, which is where an
//     emailed link is most often opened and where nothing used to happen at all.
//   • Arrival depends on data that is still loading. Which site the link names,
//     and whether this account has the module it points at, both come from
//     queries — so this waits, re-deciding as they land, instead of ruling on
//     facts it does not have yet. `resolveDeepLink` answers `nothing` while the
//     gates are open, which is a "not yet", not a "no".
//
// ONCE PER HOST, not once per page. Applying is idempotent (`controller.open`
// focuses an already-open match rather than adding a second copy), but idempotent
// is not the same as harmless: re-running on a background query refetch would
// yank focus back to the linked pane while somebody was working elsewhere. So the
// apply is gated on the host, and re-arms only when a host is torn down and
// replaced — which is exactly the strict-mode remount and the desktop⇄compact
// swap, the two cases where the layout genuinely was rebuilt from nothing. That
// is what the five-second retirement timer this replaced was reaching for, and it
// no longer races a slow boot.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSites, useModuleStates, switchSite } from '../lib/api/shell-data';
import { useWorkbench } from '../lib/workbench/context';
import { useConfirm } from '../lib/confirm';
import {
  applyDeepLink,
  clearSwitchAttempt,
  noteSwitchAttempt,
  readDeepLink,
  resolveDeepLink,
} from '../lib/workbench/deep-link';

export function DeepLinkArrival({ siteKey }: { siteKey: string | null }) {
  const { controller } = useWorkbench();
  const confirm = useConfirm();
  const { data: sites } = useSites();
  const { data: moduleStates } = useModuleStates();

  // `useConfirm` hands back a fresh closure every render, so it is held rather
  // than depended on — otherwise the effect below re-runs on every render.
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;

  /** Set once the link has been honoured against the CURRENT host. */
  const arrived = useRef(false);
  /** Set the moment a switch is committed to, so the reload can only start once. */
  const switching = useRef(false);

  // A host has to exist before a pane can open into it, and it can come and go
  // (strict mode, the desktop⇄compact swap). Subscribed rather than read once,
  // so a link followed before the dock mounted still lands when it does.
  const attached = useSyncExternalStore(
    controller.subscribe,
    () => controller.isAttached(),
    () => false
  );

  useEffect(() => {
    if (!attached) {
      // The host went away; the next one restores a layout from scratch and the
      // link applies to it too.
      arrived.current = false;
      return;
    }
    if (arrived.current || switching.current) return;

    const resolved = resolveDeepLink(
      readDeepLink(),
      { activeSiteId: siteKey, sites: sites ?? null },
      { states: moduleStates ?? null }
    );

    // Still loading, or there was no link at all. Either way, nothing to do yet
    // and nothing to arm — the next query to land runs this again.
    if (resolved.kind === 'nothing') return;

    if (resolved.kind === 'switch-site') {
      switching.current = true;
      const target = resolved.siteId;
      void (async () => {
        // The workspace being left may hold unsaved work, and the switch is a
        // reload. Same conversation the site switcher holds — a link must not be
        // a quieter way to lose someone's edits than a menu is.
        if (controller.hasUnsavedWork()) {
          const ok = await confirmRef.current({
            title: 'Open this link in another business?',
            description:
              'This link belongs to a different business. Opening it switches over and reloads the workbench, and anything here with unsaved edits will be lost.',
            confirmLabel: 'Switch and open',
            cancelLabel: 'Stay here',
            color: 'danger',
          });
          if (!ok) {
            // They chose to stay. The link is spent — re-asking on the next
            // render would be nagging, and the address bar has already moved on
            // to whatever they are actually looking at.
            arrived.current = true;
            switching.current = false;
            return;
          }
        }
        noteSwitchAttempt(target);
        await switchSite(controller, siteKey ?? 'default', target, { keepAddress: true });
      })();
      return;
    }

    // We are where the link asked to be — a later link to a different site gets
    // its own fresh attempt.
    clearSwitchAttempt();
    arrived.current = true;
    applyDeepLink(controller, resolved);
  }, [attached, controller, siteKey, sites, moduleStates]);

  return null;
}
