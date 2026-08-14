'use client';

// Polls the deployed release and, when it diverges from the version THIS tab was
// built with, raises a sticky toast offering to reload.
//
// The dashboard's equivalent (apps/dashboard/components/update-notifier.tsx)
// hands the operator a bare "Refresh" button, which is right there: its blast
// radius is one form, and the operator knows what they were typing.
//
// Here the blast radius is the whole arrangement, and — more to the point — a
// reload discards every unsaved DRAFT. Pane layout is persisted and comes back;
// draft content is in-memory and does not (see lib/drafts.ts, cleared when the
// pane closes). So a plain Refresh button would be a one-click version of
// exactly the data loss requestClose() exists to prevent, walking in through a
// door no dirty guard watches.
//
// Hence: the same detection, but the ACTION is routed through the controller's
// dirty state. Clean workbench reloads on the spot; a dirty one names what would
// be lost and makes the operator answer for it. Never auto-reloads either way.

import { useEffect, useRef } from 'react';
import { queryKeys, useQuery } from '@sparx/query';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../lib/confirm';
import { useWorkbench } from '../lib/workbench/context';
import { productName } from '../lib/product';

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
const POLL_INTERVAL_MS = 60_000;
const TOAST_ID = 'sparx-update-available';

interface VersionResponse {
  version: string;
}

async function fetchDeployedVersion(): Promise<string> {
  const res = await fetch('/api/version', { cache: 'no-store' });
  if (!res.ok) throw new Error(`version check failed: ${String(res.status)}`);
  const body = (await res.json()) as VersionResponse;
  return body.version;
}

/** "Invoice INV-0004, New invoice and 2 others" — names what a reload would cost. */
function describe(titles: string[]): string {
  if (titles.length === 1) return titles[0] ?? '';
  if (titles.length === 2) return `${titles[0] ?? ''} and ${titles[1] ?? ''}`;
  const rest = titles.length - 2;
  return `${titles[0] ?? ''}, ${titles[1] ?? ''} and ${String(rest)} other${rest === 1 ? '' : 's'}`;
}

export function UpdateNotifier(): null {
  const { controller, role } = useWorkbench();
  const toast = useToast();
  const confirm = useConfirm();
  // The toast is raised from an effect that must not re-run when `controller` or
  // `confirm` change identity, so the action is reached through a ref instead of
  // being closed over as a dependency.
  const actionRef = useRef<() => void>(() => undefined);

  // In local dev both sides read 'dev', so there's nothing to detect — don't
  // poll at all. The check only does real work against a built image.
  //
  // Detached windows don't poll either: they share this window's controller and
  // a torn-off pane is the SAME app, so a second poller would only produce a
  // second toast for one update. The main window speaks for the workbench.
  const enabled = CURRENT_VERSION !== 'dev' && role === 'main';

  const { data: deployedVersion } = useQuery({
    queryKey: queryKeys.appVersion(),
    queryFn: fetchDeployedVersion,
    enabled,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0, // always reflect the live deployed value, never a cached one
    gcTime: 0,
    retry: 1,
  });

  const updateAvailable = Boolean(deployedVersion) && deployedVersion !== CURRENT_VERSION;

  // Raised at most ONCE per tab, and that is load-bearing, not tidiness.
  //
  // Two facts about the toast manager combine into an infinite render loop:
  // `useToast()` returns a fresh object whenever the toast LIST changes (Base
  // UI memoizes it on `toasts`), and `add()` does NOT dedupe on `id` — it
  // prepends another toast carrying the same id. So an effect that lists
  // `toast` as a dependency and calls `add()` feeds itself: add → new toasts
  // array → new manager identity → effect re-runs → add → … React stops that
  // at 50 nested updates by throwing "Maximum update depth exceeded", from
  // inside ToastProvider — which sits ABOVE app/error.tsx in the root layout,
  // so the whole window fell through to global-error.tsx's bare crash screen.
  //
  // It could only ever fire when a version divergence was actually detected,
  // which is exactly why it read as "the workbench crashes after every
  // release" and never reproduced in dev (both sides read 'dev', so `enabled`
  // is false and the poll never runs).
  const raisedRef = useRef(false);

  actionRef.current = () => {
    // Read dirty state at CLICK time, not when the toast was raised. The toast is
    // sticky and may sit there for an hour while the operator starts and finishes
    // three invoices — what mattered at poll time is not what matters now.
    const dirty = controller.dirtyPanes();
    if (dirty.length === 0) {
      window.location.reload();
      return;
    }

    const titles = dirty.map((pane) => pane.title ?? 'an unsaved panel');
    void confirm({
      title: 'Reload and lose unsaved work?',
      description: `${describe(titles)} ${
        titles.length === 1 ? 'has' : 'have'
      } changes that were never saved. Reloading loads the new version and discards them. Your panel arrangement comes back either way — the unsaved changes do not.`,
      confirmLabel: 'Reload anyway',
      cancelLabel: 'Let me save first',
      color: 'danger',
    }).then((ok) => {
      if (ok) window.location.reload();
    });
  };

  // `toast.add` rather than `toast`: the manager object churns on every toast
  // anything in the app raises, the `add` function underneath it never does
  // (Base UI stabilises it). Depending on the whole manager is what let an
  // unrelated toast re-enter this effect at all.
  const addToast = toast.add;

  useEffect(() => {
    if (!updateAvailable || raisedRef.current) return;
    // Set BEFORE the add, so the write lands even if a re-render beats the
    // effect's own return — the guard has to hold on the first pass or it isn't
    // a guard.
    raisedRef.current = true;
    // `timeout: 0` keeps it up — an update the operator scrolled past is an
    // update they never learn about.
    addToast({
      id: TOAST_ID,
      title: `A new version of ${productName()} is available`,
      description: 'Reload when you are at a good stopping point.',
      timeout: 0,
      actionProps: {
        children: 'Reload',
        onClick: () => {
          actionRef.current();
        },
      },
    });
  }, [updateAvailable, addToast]);

  return null;
}
