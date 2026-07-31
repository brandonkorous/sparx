'use client';

// History — the studio's two undo ladders, as the inspector rail's third tab
// (docs/126 §4.6 + §5.3, docs/139 §17).
//
// TWO HISTORIES, and conflating them would be the dangerous bug. They restore
// different things and one of them is visible to the public:
//
//   · DRAFTS — every Save seals a version. Restoring one rewrites the working copy.
//     Visitors see nothing until the author publishes, so it is a private, cheap,
//     fully reversible action. This is the undo-across-saves that makes concurrent
//     agent+operator editing safe to promise.
//   · PUBLISHED — every Publish seals an immutable release. Restoring one changes
//     what VISITORS SEE, the moment it returns; there is no publish step in between.
//     This is a live-site rollback, and it is the recovery path for "we published
//     something broken" — the one moment an owner most needs a way back.
//
// They are separate TABS rather than one merged, timestamp-ordered list. Interleaved,
// the two kinds sit adjacent and read as one ladder, and the only thing distinguishing
// "changes my copy" from "changes my live website" would be a badge — which is not
// enough weight for an action a customer can see. The tab is the wall.
//
// The published side never lists a Restore on the current release: rolling back to what
// is already live is a no-op that still mints a release, so offering it would add noise
// to the history the author is trying to read.
//
// WHY THE RAIL, NOT A DRAWER. This was a right-hand `<Drawer>` opened from the toolbar,
// and it was the wrong container twice over: the workbench is an MDI (tabs, splits,
// tear-off windows) with no drawers anywhere else, and a drawer COVERS the canvas whose
// history it is describing. silicaui 0.43's `inspectorTabs` seam makes it a top-level
// peer of Design and Settings — it lives beside the thing it acts on, keeps its place
// when the author clicks around, and costs no screen the canvas was using.
//
// It is a `scope: "panel"` tab, which is load-bearing: history is about the DOCUMENT,
// not the selected element, so a node-scoped tab would go blank the moment the author
// clicked empty canvas — precisely when someone hunting for "put it back how it was"
// is least likely to have anything selected. The engine hides the identity header and
// the Duplicate/Delete footer while a panel tab is open, so the rail reads as one
// surface rather than history bolted under an element's name.
//
// WHAT A ROW SAYS, and why it is this little. The first pass through this rail ported
// the drawer's rows verbatim: a bordered card each, an outlined Restore button each,
// and a "You saved" badge on every single one. Four saves filled the rail with four
// identical blocks — the badge was on all of them so it distinguished nothing, and the
// only varying text ("3 hours ago" three times over) didn't either. So:
//
//   · The TIME OF DAY is the row's identity. Relative time ("3 hours ago") is how you
//     describe one version in a sentence, not how you tell three of them apart, so the
//     list shows clock times under day headings and the CONFIRM keeps the relative
//     phrasing where it reads naturally.
//   · AUTHORSHIP IS A HUE, not a word. The grey pill was the problem, not the pill: an
//     operator save, an assistant save and a restore are three different events, and a
//     single grey asserted they were the same. Colored — `info` / `module-ai` /
//     `warning` — the badge earns its line back, and you can tell the rows apart with
//     the text covered. That test is DESIGN.md §2; this file is its worked example (§5).
//   · The action is a solid button, not an outlined one. Restore is `primary`: it is
//     safe, private, reversible and the entire reason this panel exists, so it must not
//     look like the timid option. Put back is solid `danger` — the only control in the
//     editor that changes what visitors see with no publish step in between.
//   · `<List>` without `hover`, deliberately: silica's hover treatment puts
//     `cursor: pointer` on every row, and here the ROW is not the target — the button
//     in it is, and the version already in force has no action at all.
//
// Row-level pending state is per-id (`mutation.variables`), not `isPending`: they share
// one mutation, so a single flag would spin every button in the list while one restores.

import { Fragment, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  Badge,
  Button,
  EmptyState,
  List,
  ListColGrow,
  ListRow,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  useToast,
} from '@wizeworks/silicaui-react';
import { Clock, Globe, RotateCcw, Sparkles, User } from 'lucide-react';
import { useConfirm } from '../../../lib/confirm';
import {
  builderErrorMessage,
  useDraftVersions,
  useReleases,
  useRestoreDraftVersion,
  useRestoreRelease,
  type DraftVersionDto,
  type ReleaseDto,
  type RestoreReleaseResult,
} from './data';

/** Locale-aware, built once — `Intl` objects are expensive to construct per render. */
const CLOCK = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** A short "2 minutes ago" — used in the CONFIRM, where it reads as a sentence
 *  ("Restore the version from 3 hours ago?"). The list uses clock times instead,
 *  because three saves in one afternoon all read "3 hours ago". */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** "Today" / "Yesterday" / "Mon 28 Jul" — compared by calendar day, not by elapsed
 *  hours, so a save at 11pm and one at 1am are correctly two different days. */
function dayLabel(date: Date): string {
  const midnight = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return DAY.format(date);
}

/** Group a newest-first ladder into consecutive day runs, preserving order. */
function byDay<T extends { createdAt: string }>(rows: T[]): { day: string; rows: T[] }[] {
  const out: { day: string; rows: T[] }[] = [];
  for (const row of rows) {
    const day = dayLabel(new Date(row.createdAt));
    const last = out[out.length - 1];
    if (last?.day === day) last.rows.push(row);
    else out.push({ day, rows: [row] });
  }
  return out;
}

/**
 * WHO made this version, as a colored badge — the row's identity axis (DESIGN.md §2).
 *
 * Every row used to wear the same grey "You saved" pill, which asserted that an
 * operator save, an assistant save and a restore were the same kind of event. They
 * are not, and the hue is what says so before anything is read: the operator is
 * `info` (private, routine), the assistant gets the AI module's own pink — NOT a bare
 * `module`, which would resolve to the surrounding builder scope and make the two
 * indistinguishable again — and a restore is `warning`, because a version that came
 * from a rollback is a recovery event, not a routine save.
 */
function draftActor(source: string): { label: string; color: string; icon: typeof User } {
  if (source === 'agent') return { label: 'Assistant saved', color: 'module-ai', icon: Sparkles };
  if (source === 'restore') return { label: 'Restored', color: 'warning', icon: RotateCcw };
  return { label: 'You saved', color: 'info', icon: User };
}

/** The same for the published ladder. A release's `source` is `publish` or `restore` —
 *  never `agent`, since publishing is always a deliberate act. `success` for a release
 *  (it went live); `warning` for a rollback, which is an intervention in the live site. */
function releaseActor(source: string): { label: string; color: string; icon: typeof User } {
  if (source === 'restore') return { label: 'Rolled back', color: 'warning', icon: RotateCcw };
  return { label: 'Published', color: 'success', icon: Globe };
}

/**
 * What a rollback actually did, in a sentence an owner can act on.
 *
 * `pagesUnpublished` is the number that has to be said out loud. A page created
 * after the chosen release is not in its manifest, so restoring takes it OFF the
 * live site — correct (otherwise "restore" would produce a site that never existed)
 * and completely invisible from the rail. Its draft survives, so the fix is one
 * Publish away, and that is the half of the sentence that stops the news being alarming.
 */
function rollbackSummary(result: RestoreReleaseResult): string {
  const pages = `${result.pagesRestored} page${result.pagesRestored === 1 ? '' : 's'}`;
  if (result.pagesUnpublished === 0) return `Your live site is back to that version — ${pages}.`;
  const gone = `${result.pagesUnpublished} page${result.pagesUnpublished === 1 ? '' : 's'}`;
  return (
    `Your live site is back to that version — ${pages}. ${gone} you added later ` +
    `${result.pagesUnpublished === 1 ? 'is' : 'are'} no longer public, because ` +
    `${result.pagesUnpublished === 1 ? 'it did' : 'they did'}n’t exist yet. ` +
    `Nothing you wrote is lost — publish again to bring ${result.pagesUnpublished === 1 ? 'it' : 'them'} back.`
  );
}

/** The day divider inside a ladder.
 *
 *  NOT silica's `<ListTitle>`, which is the one thing in the List family that
 *  doesn't fit here: `.list-title` is 11px, uppercase, letter-spaced and 60%
 *  opacity — a faded micro-cap, under the platform's 16px floor and exactly the
 *  "de-emphasise the label" habit the house rules exist to stop. "Yesterday" is a
 *  word the author READS to find the version they want, so it gets real ink at
 *  real size and earns its weight from `font-semibold`, not from shouting. */
function DayHeading({ children }: { children: string }) {
  return <div className="px-4 pt-3 pb-1 text-base font-semibold">{children}</div>;
}

interface RowProps {
  createdAt: string;
  pageCount: number;
  /** Who made it — the identity axis. Always present; always colored. */
  actor: { label: string; color: string; icon: typeof User };
  /** The version in force. `solid` for the live one, because the public is looking
   *  at it — the strongest state on the panel earns the strongest weight. */
  state?: { label: string; solid: boolean };
  /** Absent on the version already in force: restoring to what you're on is a no-op. */
  action?: { label: string; color: 'primary' | 'danger' };
  pending: boolean;
  onAct: () => void;
}

/** One entry in either ladder: when + how big on the first line, who on the second,
 *  and either the state it is in or the one thing you can do to it, trailing. */
function HistoryRow({ createdAt, pageCount, actor, state, action, pending, onAct }: RowProps) {
  const ActorIcon = actor.icon;
  return (
    <ListRow>
      <ListColGrow>
        <div className="text-base">
          {CLOCK.format(new Date(createdAt))} · {pageCount} page{pageCount === 1 ? '' : 's'}
        </div>
        <Badge color={actor.color} variant="soft" size="sm">
          <ActorIcon className="size-3.5 shrink-0" aria-hidden />
          {actor.label}
        </Badge>
      </ListColGrow>
      {state ? (
        <Badge color="success" {...(state.solid ? {} : { variant: 'soft' as const })} size="sm">
          {state.label}
        </Badge>
      ) : null}
      {action ? (
        <Button size="sm" color={action.color} loading={pending} onClick={onAct}>
          <RotateCcw className="size-4" aria-hidden />
          {action.label}
        </Button>
      ) : null}
    </ListRow>
  );
}

interface Props {
  /** Reload the editor (refetch + remount) after a restore, so the canvas shows it. */
  onReload: () => void;
}

/**
 * The rail tab's body. Rendered by the engine only while the tab is OPEN, which is
 * what gates the two queries: each side fetches when its own sub-tab is showing, so
 * opening History costs one request, not two, and closing it costs nothing.
 */
export function VersionHistoryPanel({ onReload }: Props) {
  const [tab, setTab] = useState('drafts');
  const versions = useDraftVersions(tab === 'drafts');
  const releases = useReleases(tab === 'published');
  const restore = useRestoreDraftVersion();
  const rollback = useRestoreRelease();
  const confirm = useConfirm();
  const toast = useToast();

  const onRestore = async (v: DraftVersionDto): Promise<void> => {
    const ok = await confirm({
      title: `Restore the version from ${timeAgo(v.createdAt)}?`,
      description:
        'Your site’s draft switches back to how it was then. Any unsaved changes will be lost, ' +
        'and pages you’ve added since are kept. You can restore a newer version to undo this.',
      confirmLabel: 'Restore it',
      cancelLabel: 'Keep current',
      color: 'primary',
    });
    if (!ok) return;
    try {
      await restore.mutateAsync(v.id);
      toast.add({
        title: 'Restored',
        description: 'Your draft was rolled back. Publish when you’re happy with it.',
        type: 'success',
      });
      onReload();
    } catch (error) {
      toast.add({
        title: 'Could not restore',
        description: builderErrorMessage(error, 'Nothing changed. Try again in a moment.'),
        type: 'error',
      });
    }
  };

  const onRollback = async (r: ReleaseDto): Promise<void> => {
    // A HEAVIER confirm than the draft one, because the consequence is heavier: this
    // is the only action in the editor that changes what the public sees without a
    // Publish. `danger` and an explicit "visitors will see" — the confirm has to name
    // the audience, not just the operation.
    const ok = await confirm({
      title: `Put the version from ${timeAgo(r.createdAt)} back on your live site?`,
      description:
        'Visitors will see that version straight away — this changes your public website, not ' +
        'just your working copy. Anything you’ve published since goes back to how it was then, ' +
        'and pages you added later stop being public until you publish them again. Nothing you ' +
        'have written is deleted, and this itself can be rolled back.',
      confirmLabel: 'Put it back live',
      cancelLabel: 'Leave my site as it is',
      color: 'danger',
    });
    if (!ok) return;
    try {
      const result = await rollback.mutateAsync(r.id);
      toast.add({
        title: 'Your live site was rolled back',
        description: rollbackSummary(result),
        type: 'success',
      });
      // DELIBERATELY NO `onReload()` here, unlike the draft restore above.
      //
      // A rollback rewrites the PUBLISHED trees and leaves the draft alone, so the
      // canvas is already showing the right thing. `onReload` remounts the editor
      // from the server's draft — which would throw away any unsaved edit the author
      // had on screen, to fix nothing. Rolling back a bad publish is exactly the
      // moment someone is mid-repair with unsaved work open, so this is the wrong
      // place of all places to reload.
      //
      // The one thing that DOES go stale is the "Published / not live yet" badge,
      // computed from draft-vs-published; `useRestoreRelease` invalidates that query,
      // so it refetches on its own without touching the canvas.
    } catch (error) {
      toast.add({
        title: 'Could not roll back',
        description: builderErrorMessage(
          error,
          'Your live site is unchanged. Try again in a moment.'
        ),
        type: 'error',
      });
    }
  };

  return (
    // `color` follows the OPEN tab, which is DESIGN.md §2.2's "carry it on the panel".
    // The two sides differ in consequence — a private working copy vs the live public
    // site — and that is the most important fact on this surface, so the pill itself
    // changes hue: `info` while you are in your own drafts, `warning` the moment you
    // are looking at versions your visitors have seen.
    <Tabs
      value={tab}
      onValueChange={setTab}
      variant="pills"
      color={tab === 'drafts' ? 'info' : 'warning'}
      className="flex flex-col gap-3 p-3"
    >
      {/* A real TRACK, not a bare strip: silica's `.tabs-list` is a transparent
        `inline-flex`, so pills float on the rail with nothing holding them. `bg-base-200`
        + full width + `flex-1` on each tab makes the pair read as one two-position
        switch that spans the panel — which is what they are. Layout and surface only;
        the pill fill, its ink and the sliding indicator stay silica's. */}
      <TabsList className="bg-base-200 rounded-selector flex w-full p-1">
        <TabsTab value="drafts" className="flex-1">
          Your drafts
        </TabsTab>
        <TabsTab value="published" className="flex-1">
          Published
        </TabsTab>
      </TabsList>

      <TabsPanel value="drafts" className="flex flex-col gap-3">
        <p className="text-base">
          Restoring changes your working copy only — visitors see nothing until you publish.
        </p>
        {versions.isPending ? (
          <p className="text-base" role="status">
            Loading history…
          </p>
        ) : !versions.data || versions.data.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Clock className="text-module-builder size-5" aria-hidden />}
            title="Nothing saved yet"
            description="Every time you (or your assistant) save, a version lands here."
          />
        ) : (
          <List>
            {byDay(versions.data).map((group) => (
              <Fragment key={group.day}>
                <DayHeading>{group.day}</DayHeading>
                {group.rows.map((v) => (
                  <HistoryRow
                    key={v.id}
                    createdAt={v.createdAt}
                    pageCount={v.pageCount}
                    actor={draftActor(v.source)}
                    {...(v.current
                      ? { state: { label: 'Current', solid: false } }
                      : { action: { label: 'Restore', color: 'primary' as const } })}
                    pending={restore.isPending && restore.variables === v.id}
                    onAct={() => {
                      void onRestore(v);
                    }}
                  />
                ))}
              </Fragment>
            ))}
          </List>
        )}
      </TabsPanel>

      <TabsPanel value="published" className="flex flex-col gap-3">
        {/* The warning belongs at the TOP of this panel, not on each row: it is true of
          the whole tab, and repeating it per release would train the eye to skip it —
          which is the opposite of what a live-site action needs. `warning`, not
          `danger`: this is a caution about what the buttons below do, not a report
          that something is wrong. */}
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertDescription>
              These are the versions your visitors have seen. Putting one back changes your live
              website straight away — no publishing step. Your working copy is left alone.
            </AlertDescription>
          </AlertContent>
        </Alert>

        {releases.isPending ? (
          <p className="text-base" role="status">
            Loading publish history…
          </p>
        ) : releases.isError ? (
          <p className="text-base">
            We couldn’t load your publish history just now. Your live site is unaffected — try again
            in a moment.
          </p>
        ) : !releases.data || releases.data.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Clock className="text-module-builder size-5" aria-hidden />}
            title="Not published yet"
            description="Every version you put live is kept here, so you can go back to it."
          />
        ) : (
          <List>
            {byDay(releases.data).map((group) => (
              <Fragment key={group.day}>
                <DayHeading>{group.day}</DayHeading>
                {group.rows.map((r) => (
                  <HistoryRow
                    key={r.id}
                    createdAt={r.createdAt}
                    pageCount={r.pageCount}
                    actor={releaseActor(r.source)}
                    {...(r.current
                      ? { state: { label: 'Live now', solid: true } }
                      : { action: { label: 'Put back', color: 'danger' as const } })}
                    pending={rollback.isPending && rollback.variables === r.id}
                    onAct={() => {
                      void onRollback(r);
                    }}
                  />
                ))}
              </Fragment>
            ))}
          </List>
        )}
      </TabsPanel>
    </Tabs>
  );
}
