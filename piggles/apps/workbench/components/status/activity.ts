'use client';

// What the pulse chip shows, and what it announces — the rules, apart from the
// strip that renders them.
//
// Lifted out of components/status-bar.tsx, which had grown past the 250-line
// ceiling (piggles/CLAUDE.md RULE #0.5).

import { useEffect, useRef } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import {
  faBagShopping,
  faCalendarClock,
  faMoneyBill,
  faUserPlus,
} from '@fortawesome/pro-solid-svg-icons';
import type { ActivityItem } from '../../lib/api/activity';

/** The list surface that shows this kind of event. Every NOTABLE_ACTIONS entry
 *  must land somewhere real — a chip that opens the wrong list is worse than one
 *  that doesn't open at all, because it silently answers a different question. */
export function surfaceForActivity(action: string): string {
  if (action.startsWith('crm.customer')) return 'crm.customers.list';
  if (action.startsWith('invoicing.')) return 'invoicing.invoices.list';
  if (action.startsWith('booking.')) return 'scheduling.calendar';
  return 'commerce.orders.list';
}

/** Money in, a new person, a booking, or a sale — the shapes the chip takes. */
export function iconForActivity(action: string) {
  if (action.startsWith('crm.customer')) return faUserPlus;
  if (action.startsWith('invoicing.payment') || action.includes('.payment.')) return faMoneyBill;
  if (action.startsWith('booking.')) return faCalendarClock;
  return faBagShopping;
}

/**
 * State is its own color axis. Almost everything notable is good news and reads
 * success; a cancellation is the exception and must NOT — a lost appointment
 * rendered in the same green as a sale is the interface lying about what
 * happened, at a glance, which is the only way this chip is ever read.
 */
export function toneForActivity(action: string): string {
  if (action === 'booking.cancelled') return 'text-warning';
  if (action.startsWith('crm.customer')) return 'text-info';
  return 'text-success';
}

/** The same rule, for the toast — and it matters MORE here. The chip is glanced
 *  at; the toast slides in and takes the eye, so a cancellation announcing
 *  itself in success green is the loudest possible version of that lie. Kept
 *  beside toneForActivity so the two never drift apart. */
export function toastTypeForActivity(action: string): 'success' | 'warning' {
  return action === 'booking.cancelled' ? 'warning' : 'success';
}

/**
 * How recent a sale or signup has to be to still earn a slot in the strip.
 *
 * The chip answers "is anything happening?", and past about a week the honest
 * answer is no — at which point "Customer created · 35d ago" stops being a
 * signal and becomes furniture. Worse, it reads as a broken widget rather than
 * as a quiet business: an owner sees a stale timestamp pinned to their status
 * bar and concludes the number is wrong, not that nothing sold.
 *
 * So the slot empties instead, the same way the jobs and detached-window chips
 * already hide themselves when they have nothing to report. Nothing is lost —
 * the full history is in Pulse, which is what that pane is for.
 */
const PULSE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function freshEnoughToShow(item: ActivityItem | undefined): ActivityItem | undefined {
  if (!item) return undefined;
  return Date.now() - new Date(item.at).getTime() < PULSE_MAX_AGE_MS ? item : undefined;
}

/** Announces fresh activity as toasts. The first delivery is baseline —
 *  toasting last week's orders on every boot would train people to dismiss
 *  the very popup that's supposed to feel good. */
export function useActivityToasts(items: ActivityItem[], ready: boolean) {
  const toast = useToast();
  // `toast.add` rather than `toast`: Base UI memoizes the manager on the toast
  // LIST, so its identity churns every time ANYTHING in the app raises one,
  // while `add` underneath it never does. Depending on the manager re-ran this
  // effect on an unrelated toast, which cleared the pending timer below — so a
  // sale announced itself only when nothing else happened to toast in the same
  // beat. (The same dependency is an outright render loop in a hook that adds
  // unconditionally; see components/update-notifier.tsx.)
  const addToast = toast.add;
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    // Baselining before the first load lands would make that load read as
    // all-fresh and toast history at the operator on boot.
    if (!ready) return;
    if (!seen.current) {
      seen.current = new Set(items.map((item) => item.id));
      return;
    }
    const fresh = items.filter((item) => !seen.current?.has(item.id));
    if (fresh.length === 0) return;

    // Deferred: Base UI's toast.add measures via flushSync, which React
    // rejects from inside a commit ("flushSync from inside a lifecycle").
    //
    // `seen` is marked HERE rather than above, so an event is only ever recorded
    // as announced once it actually has been. Marking before the timer meant a
    // cancelled run swallowed the ids permanently — the re-run found nothing
    // fresh and the toast was gone for good.
    const timer = setTimeout(() => {
      for (const item of fresh) seen.current?.add(item.id);
      // Cap the celebration: a burst (bulk import, catch-up after sleep)
      // becomes one summary rather than a stack of popups.
      if (fresh.length > 3) {
        // Counted from the two actions that ARE a sale, not every `crm.order.*`
        // — that prefix now also carries payments. And only mentioned when there
        // were some: "6 new events — 0 sales among them" reads as a bad morning
        // when what actually happened was six invoices getting paid.
        const sales = fresh.filter(
          (item) =>
            item.action === 'crm.order.created' || item.action === 'commerce.checkout.completed'
        ).length;
        addToast({
          title: 'Things are happening',
          description:
            sales > 0
              ? `${String(fresh.length)} new events — ${String(sales)} sales among them.`
              : `${String(fresh.length)} new events across your business.`,
          type: 'success',
        });
        return;
      }
      for (const item of fresh) {
        addToast({
          title: item.title,
          description: item.subject ?? undefined,
          type: toastTypeForActivity(item.action),
        });
      }
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [items, ready, addToast]);
}
