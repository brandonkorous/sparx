'use client';

// The status bar — a live signal strip, nothing else.
//
// Everything here is a fact that can CHANGE while you work; identity (tenant,
// site, person) lives in the toolbar and is deliberately not repeated. Five
// signals earn the 32 pixels:
//
//   • Connection — this app calls api-rest from the browser, so "offline" is
//     an app-level fact here in a way it never was for the server-rendered
//     dashboard. One global signal beats six panes erroring in six ways.
//   • Activity — a quiet "Saving…"/"Syncing…" pulse while requests are in
//     flight, so a slow save reads as working, not broken. Once it settles the
//     slot reports WHEN the last write landed rather than reverting to a
//     content-free "Online" — that's the question people actually had.
//   • Unsaved work — with panes torn off across monitors, "something
//     somewhere is dirty" is genuinely easy to lose track of. The chip counts
//     it and clicking focuses the pane that needs attention.
//   • Detached windows — the counterpart fact, and the only one here that is
//     otherwise INVISIBLE: a torn-off pane can sit behind this window or on a
//     monitor that's asleep. Nothing else on screen admits it exists.
//   • Running jobs — background work in flight (imports today), with live
//     progress. Answers "did my import finish?" without reopening the pane that
//     started it. The read-side of the awareness layer (docs/124), via
//     lib/api/jobs.ts → GET /v1/jobs.
//
// Plus the business pulse: the latest notable thing that happened — a sale, a
// new customer — read from the platform's AUDIT LOG via GET /v1/activity
// (lib/api/activity.ts), with fresh events announced as toasts. The owner's
// question "is anything happening?" gets answered without opening a report.
// It filters to NOTABLE_ACTIONS on purpose: things that happen TO the business,
// never the operator's own edits, or the toast becomes something to dismiss.

import { useSyncExternalStore } from 'react';
import { useIsFetching, useIsMutating } from '@wizeworks/query';
import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { faCircleExclamation, faSpinner } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { describeAgo, useActivity, NOTABLE_ACTIONS } from '../lib/api/activity';
import { useActiveJobs } from '../lib/api/jobs';
import { useWorkbench } from '../lib/workbench/context';
import { useAgoTick, useDetachedWindows, useDirtyPanes, useLastSaved } from './status-bar-signals';
import { SentimentChip } from './feedback/sentiment-chip';
import { DetachedChip } from './status/detached-chip';
import { JobsChip } from './status/jobs-chip';
import {
  freshEnoughToShow,
  iconForActivity,
  surfaceForActivity,
  toneForActivity,
  useActivityToasts,
} from './status/activity';
import { GuideChip } from '../lib/tour/guide-chip';

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function StatusBar() {
  const { controller } = useWorkbench();
  const dirty = useDirtyPanes();
  const detached = useDetachedWindows();
  const jobs = useActiveJobs();
  const lastSaved = useLastSaved();

  // No module gating any more: a tenant without commerce simply has no
  // `commerce.*` audit rows, so the filter does the gating for free — one less
  // thing to keep in sync with the module switchboard.
  const { items, ready } = useActivity({ actions: NOTABLE_ACTIONS, limit: 5 });
  // Toasts see EVERY notable event, ages-out or not. A fresh event is fresh by
  // definition, so the age rule below can't suppress one — but tying the two
  // together would mean a display rule quietly deciding what gets announced.
  useActivityToasts(items, ready);
  const latest = freshEnoughToShow(items[0]);

  // Only tick while there is a relative timestamp on screen to age. `latest`
  // rather than the raw newest event, so the timer stops once the chip is
  // hidden — and, on the way there, the tick is what re-renders the strip at
  // the moment the chip crosses the threshold and disappears.
  useAgoTick(lastSaved !== null || latest !== undefined);

  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );

  // Mutations always count; fetches exclude the background polls (the activity
  // feed and the jobs chip) so the bar doesn't blink "Syncing…" on their timers
  // forever. Keep this list in step with any new polling query key.
  const mutating = useIsMutating();
  const fetching = useIsFetching({
    predicate: (query) =>
      query.queryKey[0] !== 'activity' &&
      query.queryKey[0] !== 'jobs' &&
      query.queryKey[0] !== 'notifications',
  });

  return (
    // Dev builds float two framework buttons over the corners (Next.js dev
    // tools bottom-left, query devtools bottom-right); the extra padding keeps
    // real controls out from under them. Production has neither.
    // Plain text in the strip is 14px (`text-sm`); the BUTTONS deliberately keep
    // whatever silica bakes into `btn-xs` (11px) rather than overriding it. A
    // 14px override inside a 24px-tall xs button sat badly in its box — the
    // control is sized as a unit, so letting the size prop own both the box and
    // the type keeps them in proportion. Two sizes here is intentional: labels
    // read, chips are controls.
    <footer
      className={`border-base-300 bg-base-100 flex h-8 shrink-0 items-center gap-3 border-t px-3 text-sm ${
        process.env.NODE_ENV !== 'production' ? 'px-14' : ''
      }`}
    >
      {/* Connection + activity — one slot, most urgent wins. Urgency rides
          color, not weight; a bolder offline message would be a fourth voice. */}
      {!online ? (
        <span className="text-danger flex items-center gap-1.5">
          <Icon glyph={faCircleExclamation} className="size-3.5" aria-hidden />
          Offline — changes can’t save right now
        </span>
      ) : mutating > 0 ? (
        <span className="flex items-center gap-1.5" role="status">
          <Icon glyph={faSpinner} className="size-3.5 animate-spin" aria-hidden />
          Saving…
        </span>
      ) : fetching > 0 ? (
        <span className="flex items-center gap-1.5" role="status">
          <Icon glyph={faSpinner} className="size-3.5 animate-spin" aria-hidden />
          Syncing…
        </span>
      ) : lastSaved ? (
        // Settled, and something HAS been saved. "Online" is the answer to a
        // question nobody asked; when the work landed is the one they had.
        <span className="flex items-center gap-1.5">
          <span className="bg-success size-1.5 rounded-full" aria-hidden />
          Saved {describeAgo(lastSaved)}
        </span>
      ) : (
        // Nothing saved yet this session — fall back to the connection fact
        // rather than inventing a save that never happened.
        <span className="flex items-center gap-1.5">
          <span className="bg-success size-1.5 rounded-full" aria-hidden />
          Online
        </span>
      )}

      <span className="flex-1" />

      {/* Running jobs — background work in flight (imports today). Answers "did
          my import finish?" without reopening the pane that started it. */}
      {jobs.length > 0 ? <JobsChip jobs={jobs} /> : null}

      {/* Detached windows — panes torn onto other monitors. The one signal here
          that answers a question the screen physically cannot: nothing in this
          window reveals a popout sitting behind it. */}
      {detached.length > 0 ? <DetachedChip windows={detached} /> : null}

      {/* "Show me around" — the guide, offered and then run from this shelf.
          It is here for the same reason the sentiment chip is: it is the one
          place in the console that can ask for attention without taking the
          screen away from the work it is explaining. */}
      <GuideChip />

      {/* The occasional "how's it going?" — self-hiding like every chip here,
          and on this shelf precisely so it never covers the work it is asking
          about. Renders nothing unless the server says this person is due. */}
      <SentimentChip />

      {/* The pulse — the latest notable thing that happened, click-through to
          its list. Sourced from the audit log now, not a bespoke poll. Hidden
          once it ages out (see PULSE_MAX_AGE_MS) rather than pinning stale news
          to a strip whose whole job is reporting what is true right now. */}
      {latest ? (
        <Tooltip content={`${latest.subject ?? latest.title} · open the list`}>
          <Button
            color="neutral"
            variant="ghost"
            size="xs"
            className="gap-1.5"
            onClick={() => {
              controller.open(surfaceForActivity(latest.action));
            }}
          >
            {(() => {
              const glyph = iconForActivity(latest.action);
              return (
                <Icon
                  glyph={glyph}
                  className={`size-3.5 ${toneForActivity(latest.action)}`}
                  aria-hidden
                />
              );
            })()}
            <span className="max-w-72 truncate">
              {latest.subject ? `${latest.title} — ${latest.subject}` : latest.title}
            </span>
            <span>{describeAgo(latest.at)}</span>
          </Button>
        </Tooltip>
      ) : null}

      {/* Unsaved work — only speaks when there is something to say. */}
      {dirty.length > 0 ? (
        <Tooltip content="Click to go to the pane with unsaved changes">
          <Button
            color="warning"
            variant="soft"
            size="xs"
            onClick={() => {
              const first = dirty[0];
              if (first) controller.focusPane(first.id);
            }}
          >
            {dirty.length === 1 ? '1 unsaved change' : `${String(dirty.length)} unsaved changes`}
          </Button>
        </Tooltip>
      ) : null}
    </footer>
  );
}
