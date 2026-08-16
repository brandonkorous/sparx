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

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useIsFetching, useIsMutating } from '@sparx/query';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Popover,
    PopoverContent,
    PopoverTitle,
    PopoverTrigger,
    Progress,
    Tooltip,
    useToast,
} from '@wizeworks/silicaui-react';
import {
    faBagShopping,
    faCalendarClock,
    faCircleExclamation,
    faMoneyBill,
    faSpinner,
    faUserPlus,
    faWindow,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { describeAgo, useActivity, NOTABLE_ACTIONS, type ActivityItem } from '../lib/api/activity';
import { useActiveJobs, type Job } from '../lib/api/jobs';
import { resolveTitle, getSurface } from '../lib/surfaces/registry';
import type { DetachedWindow } from '../lib/workbench/pane-host';
import { useWorkbench } from '../lib/workbench/context';
import { useAgoTick, useDetachedWindows, useDirtyPanes, useLastSaved } from './status-bar-signals';
import { SentimentChip } from './feedback/sentiment-chip';

function subscribeOnline(listener: () => void): () => void {
    window.addEventListener('online', listener);
    window.addEventListener('offline', listener);
    return () => {
        window.removeEventListener('online', listener);
        window.removeEventListener('offline', listener);
    };
}

/** The list surface that shows this kind of event. Every NOTABLE_ACTIONS entry
 *  must land somewhere real — a chip that opens the wrong list is worse than one
 *  that doesn't open at all, because it silently answers a different question. */
function surfaceForActivity(action: string): string {
    if (action.startsWith('crm.customer')) return 'crm.customers.list';
    if (action.startsWith('invoicing.')) return 'invoicing.invoices.list';
    if (action.startsWith('booking.')) return 'scheduling.calendar';
    return 'commerce.orders.list';
}

/** Money in, a new person, a booking, or a sale — the shapes the chip takes. */
function iconForActivity(action: string) {
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
function toneForActivity(action: string): string {
    if (action === 'booking.cancelled') return 'text-warning';
    if (action.startsWith('crm.customer')) return 'text-info';
    return 'text-success';
}

/** The same rule, for the toast — and it matters MORE here. The chip is glanced
 *  at; the toast slides in and takes the eye, so a cancellation announcing
 *  itself in success green is the loudest possible version of that lie. Kept
 *  beside toneForActivity so the two never drift apart. */
function toastTypeForActivity(action: string): 'success' | 'warning' {
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

function freshEnoughToShow(item: ActivityItem | undefined): ActivityItem | undefined {
    if (!item) return undefined;
    return Date.now() - new Date(item.at).getTime() < PULSE_MAX_AGE_MS ? item : undefined;
}

/** Announces fresh activity as toasts. The first delivery is baseline —
 *  toasting last week's orders on every boot would train people to dismiss
 *  the very popup that's supposed to feel good. */
function useActivityToasts(items: ActivityItem[], ready: boolean) {
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
            className={`border-base-300 bg-base-100 flex h-8 shrink-0 items-center gap-3 border-t px-3 text-sm ${process.env.NODE_ENV !== 'production' ? 'px-14' : ''
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

/**
 * The detached-windows chip: how many windows, what's in them, and the two
 * things you ever want to do about one.
 *
 * A menu rather than a plain count because the count alone is the least useful
 * half — "2 windows" you can't name is barely better than not knowing. Each row
 * FOCUSES its window (the common case: it's buried, bring it forward) and every
 * window can be brought home, for the monitor you just unplugged.
 */
function DetachedChip({ windows }: { windows: DetachedWindow[] }) {
    const { controller } = useWorkbench();

    /** A window's human name: its panes, or a count once that stops fitting.
     *  Named `entry`, not `window` — shadowing the global inside a component
     *  that also lives in a multi-window app is a trap waiting to be sprung. */
    const label = (entry: DetachedWindow): string => {
        const titles = entry.paneIds.map((paneId) => {
            const descriptor = controller.getDescriptor(paneId);
            if (!descriptor) return 'Pane';
            if (descriptor.title) return descriptor.title;
            const definition = getSurface(descriptor.surface);
            return definition ? resolveTitle(definition, descriptor.params ?? {}) : descriptor.surface;
        });
        if (titles.length === 0) return 'Empty window';
        if (titles.length <= 2) return titles.join(', ');
        return `${titles[0] ?? ''} +${String(titles.length - 1)} more`;
    };

    return (
        <DropdownMenu>
            <Tooltip content="Panes torn into their own windows">
                <DropdownMenuTrigger>
                    <Button color="neutral" variant="ghost" size="xs" className="gap-1.5">
                        <Icon glyph={faWindow} className="size-3.5" aria-hidden />
                        {windows.length === 1 ? '1 window' : `${String(windows.length)} windows`}
                    </Button>
                </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end">
                {/* Base UI requires a label to live inside a Group — a bare
            DropdownMenuLabel throws MenuGroupRootContext at runtime. */}
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Detached windows</DropdownMenuLabel>
                    {windows.map((entry) => (
                        <DropdownMenuItem
                            key={entry.id}
                            onClick={() => {
                                entry.focus();
                            }}
                        >
                            <span className="max-w-64 truncate">{label(entry)}</span>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem
                        onClick={() => {
                            // Redocking mutates the arrangement as it iterates, so walk a
                            // copy — splicing the live list mid-loop would skip windows.
                            for (const entry of [...windows]) entry.redock();
                        }}
                    >
                        Bring them all back here
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * The running-jobs chip: what background work is in flight, and how far along.
 *
 * A popover, not a menu — the rows are read-only status, not actions. The
 * trigger names the single job when there's one (the common case: one import)
 * and falls back to a count. A spinner rather than a static icon because the
 * entire message of this chip is "something is still working." Opens UPWARD
 * (side="top") — it lives on the bottom edge, a downward panel would clip.
 *
 * Every job here is `running` by construction: the endpoint's active set is
 * pending/processing only, so a failure drops OUT of this list rather than
 * turning a row red. Surfacing failures with an explanation is the notification
 * layer's job (docs/124 Phase 3), not the chip's.
 */
function JobsChip({ jobs }: { jobs: Job[] }) {
    const { controller } = useWorkbench();
    const trigger =
        jobs.length === 1 ? (jobs[0]?.label ?? 'Working…') : `${String(jobs.length)} running`;

    return (
        <Popover>
            <Tooltip content="Background work in progress">
                <PopoverTrigger>
                    <Button color="neutral" variant="ghost" size="xs" className="gap-1.5">
                        <Icon glyph={faSpinner} className="size-3.5 animate-spin" aria-hidden />
                        <span className="max-w-56 truncate">{trigger}</span>
                    </Button>
                </PopoverTrigger>
            </Tooltip>
            <PopoverContent side="top" align="end" className="w-72">
                <PopoverTitle>Running now</PopoverTitle>
                <ul className="mt-2 flex flex-col gap-3">
                    {jobs.map((job) => {
                        // Capture into a const so the closure narrows it to string — an
                        // inline `job.surface` wouldn't, since a field could change.
                        const surface = job.surface;
                        return (
                            <li key={job.id}>
                                <JobRow job={job} onOpen={surface ? () => controller.open(surface) : undefined} />
                            </li>
                        );
                    })}
                </ul>
                {/* The chip only ever shows what's STILL going — a job that finishes or
            fails drops out of it silently. Pulse is where that gets answered,
            so the way there belongs right here. */}
                <div className="border-base-300 mt-3 border-t pt-2">
                    <Button
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        className="w-full justify-start"
                        onClick={() => {
                            controller.open('platform.pulse');
                        }}
                    >
                        Open Pulse
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

/** One running job: label, percentage, progress bar. Becomes a button that
 *  opens the surface its output lands in when the job HAS one — a plain block
 *  otherwise, so a job with nowhere to go isn't a dead-looking control. */
function JobRow({ job, onOpen }: { job: Job; onOpen?: () => void }) {
    const body = (
        <>
            <span className="flex items-center justify-between gap-2">
                <span className="truncate">{job.label}</span>
                {job.progress !== null ? (
                    <span className="tabular-nums">{String(job.progress)}%</span>
                ) : null}
            </span>
            {/* Null progress → indeterminate bar (pending, not yet counting). */}
            <Progress color="primary" size="xs" value={job.progress ?? undefined} />
        </>
    );

    if (!onOpen) return <div className="flex flex-col gap-1">{body}</div>;

    return (
        <button
            type="button"
            onClick={onOpen}
            className="hover:bg-base-200 -mx-1 flex w-[calc(100%+0.5rem)] flex-col gap-1 rounded px-1 py-0.5 text-left"
        >
            {body}
        </button>
    );
}
