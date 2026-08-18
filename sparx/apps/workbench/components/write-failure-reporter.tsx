'use client';

// The failed-save safety net.
//
// Error boundaries catch renders. They do not catch a WRITE — a mutation
// rejects inside a promise, React never sees it, and every boundary in this app
// stays green while the operator's change quietly did not happen. That is the
// worst failure the workbench has, because the screen still shows what they
// typed: nothing looks wrong, and they find out when the order never shipped.
//
// So every mutation is watched here, in one place, rather than trusted to 132
// call sites each remembering. The rule is:
//
//   • ALWAYS report it. Telemetry is unconditional and independent of whether
//     anything was shown — a write that fails for everyone must be visible to us
//     even where a surface handles it beautifully.
//   • Announce it ONLY if nobody else did. A mutation with its own `onError` has
//     a call site that owns the conversation (usually a better one: it can name
//     the invoice, restore the form, undo the optimistic row). Toasting on top
//     would say the same thing twice and teach people to ignore both.
//
// This is a NET, not the answer. A surface that can say something specific still
// should. What this guarantees is a floor: no failed write is ever silent.
//
// It deliberately never fires for an OFFLINE write, and that is not a hole.
// TanStack's default `networkMode: 'online'` PAUSES a mutation started with no
// connection rather than failing it, and resumes it on reconnect — so the change
// is queued, not lost, and there is nothing to apologise for. The status bar
// says "Offline — changes can't save right now" while that is true, which is the
// honest report. Adding a failure toast here would announce a loss that has not
// happened.

import { useEffect } from 'react';
import { useQueryClient } from '@wizeworks/query';
import { useToast } from '@wizeworks/silicaui-react';
import { describeWriteFailure } from '../lib/api/write-failure';
import { readWriteMeta } from '../lib/api/write-meta';
import { reportCrash } from '../lib/analytics';

export function WriteFailureReporter(): null {
  const queryClient = useQueryClient();
  const toast = useToast();
  // `toast.add`, never the manager — its identity churns on every toast in the
  // app, and re-subscribing to the mutation cache on that churn would drop
  // in-flight notifications. Same trap as components/update-notifier.tsx.
  const addToast = toast.add;

  useEffect(() => {
    const cache = queryClient.getMutationCache();

    return cache.subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;

      const error: unknown = event.action.error;
      const meta = readWriteMeta(event.mutation.meta);
      const failure = describeWriteFailure(error);

      // Unconditional, and BEFORE the display decision — a return path added
      // below must never be able to skip the report.
      reportCrash(error, {
        boundary: 'mutation',
        outcome: failure.code,
        ...(meta.writing ? { writing: meta.writing } : {}),
        ...(failure.reference ? { requestId: failure.reference } : {}),
      });

      // Nobody asked for this write, so its failure is not theirs to hear.
      if (meta.housekeeping === true) return;
      // The call site is handling it. `onError` on the mutation itself, not on
      // the observer: a component's own `mutate(vars, { onError })` also lands
      // here, and both mean the same thing — somebody downstream is speaking.
      if (typeof event.mutation.options.onError === 'function') return;

      addToast({
        title: meta.writing ? `Couldn't save ${meta.writing}` : "That didn't save",
        description: failure.showReference
          ? `${failure.message} If it keeps happening, quote ${failure.reference}.`
          : failure.message,
        type: 'error',
        // A failed write outlives the glance a toast normally gets. It stays
        // until dismissed, because the whole point is that the screen still
        // shows the change as though it landed.
        timeout: 0,
      });
    });
  }, [queryClient, addToast]);

  return null;
}
