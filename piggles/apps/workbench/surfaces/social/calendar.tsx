'use client';

// The calendar — the view a social tool lives or dies on. Everything scheduled and
// everything already posted, laid out on the month it belongs to, so an operator sees
// the shape of their week at a glance: where the gaps are, what clusters, what is due
// tomorrow.
//
// The month grid is ALWAYS the view — this is the one place a social manager lives, so
// it never degrades into a list. When the pane is too narrow for seven legible columns
// the grid scrolls sideways rather than collapsing. Any day is a click target: click
// the empty space (or the date) to start a post already dated to it. Drafts have no
// date, so they sit in a tray beneath — picked up and opened, not lost.

import { useMemo, useState } from 'react';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  Button,
  Card,
  Heading,
  Text,
  ToggleGroup,
  ToggleGroupItem,
} from '@wizeworks/silicaui-react';
import {
  faCalendarPlus,
  faChevronLeft,
  faChevronRight,
  faPlus,
  faServer,
} from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { slotOccurrences } from '@wizeworks/social/cadence';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { MediaAsset } from '../cms/media';
import { PostThumb, excerpt, postInstant } from './post-visuals';
import {
  byDayOn,
  dateNumber,
  dayLabel as nameDay,
  dayOn,
  dayStartOn,
  monthGrid,
  monthOf,
  rangeLabel as nameRange,
  startOfMonth,
  startOfWeek,
  stepCursor,
  timeOn,
  timesNote,
  todayOn,
  weekDays,
} from './social-clock';
import { useSocialBoard } from './board';
import { isEditablePost, postStatusMeta, socialErrorMessage, type Post } from './data';
import { usePostingSlots, type PostingSlot } from './planning-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

interface CalendarProps {
  posts: Post[];
  assetsById: Map<string, MediaAsset>;
  /** The business's standing posting times, drawn as gaps where nothing is planned. */
  slots: PostingSlot[];
  canWrite: boolean;
  /** Nothing is connected yet, so the first thing to do is not writing a post. */
  nothingConnected: boolean;
  onOpenPost: (post: Post, event: OpenEvent) => void;
  /** A calendar day ("2026-10-11"), on the business's clock. */
  onNewOnDay: (day: string) => void;
  /** Start a post at an exact moment — clicking an empty posting time. */
  onNewAt: (at: Date) => void;
  /** Drop a post onto a day → (re)schedule it there. Only fired for editable posts
   *  (a published one is pinned to when it went out). */
  onReschedule: (post: Post, day: string) => void;
  /** The business's zone (undefined while it loads, null when it has none) and this
   *  computer's. Every day and time on the grid is on `zone ?? device`. */
  reader: { zone: string | null | undefined; device: string };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Status → a decorative dot color (not text, so a tone class is fine here). */
const TONE_DOT: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-base-content/40',
};

// The grid is built from calendar DAYS ("2026-10-11"), not this computer's midnights,
// and a post sits under the day its time falls on, on the business's clock: a post at
// half past midnight in London is on her Sunday, whatever a laptop in California says
// (piggles persona issue 990). The day arithmetic lives in social-clock.ts.

/** How close a post has to be to a posting time to count as filling it. Matches the
 *  server-side filler exactly, so a slot the calendar draws as free is precisely one the
 *  evergreen filler would claim. */
const OCCUPIED_WINDOW_MS = 90 * 60_000;

/* ── One post, as a calendar chip ─────────────────────────────────────────── */

function DayChip({
  post,
  assetsById,
  canWrite,
  clock,
  onOpen,
}: {
  post: Post;
  assetsById: Map<string, MediaAsset>;
  canWrite: boolean;
  clock: string;
  onOpen: (event: OpenEvent) => void;
}) {
  const meta = postStatusMeta(post.status);
  const iso = post.publishedAt ?? post.scheduledAt;
  // A published post is pinned to when it went out; everything still in flight can be
  // dragged to another day (by someone who may schedule). A 6px activation distance (on
  // the context's sensor) keeps a click-to-open distinct from a drag-to-reschedule.
  const movable = canWrite && isEditablePost(post.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: post.id,
    disabled: !movable,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      title={`${excerpt(post.body, 80)}: ${meta.label}${movable ? ' · drag to reschedule' : ''}`}
      className={`hover:bg-base-300 bg-base-200 flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left ${
        movable ? 'cursor-grab' : 'cursor-pointer'
      } ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[meta.tone]}`} aria-hidden />
      <PostThumb post={post} assetsById={assetsById} size="xs" />
      <span className="min-w-0 flex-1 truncate text-xs">
        {iso ? <span className="font-semibold">{timeOn(iso, clock)} </span> : null}
        {excerpt(post.body, 32)}
      </span>
    </button>
  );
}

/* ── The month grid ───────────────────────────────────────────────────────── */

/**
 * A posting time this day was meant to have, with nothing in it.
 *
 * This is what turns a cadence from a note in a settings screen into something you can
 * see. "We post Tuesdays at 9" is only useful if an empty Tuesday LOOKS empty — otherwise
 * a quiet month reads as blank space and nobody notices until engagement drops. Clicking
 * one starts a post already dated to that exact slot.
 */
function EmptySlotChip({
  at,
  canWrite,
  clock,
  onFill,
}: {
  at: Date;
  canWrite: boolean;
  clock: string;
  onFill: () => void;
}) {
  const time = timeOn(at.toISOString(), clock);
  const label = `${time}: nothing planned`;
  return (
    <button
      type="button"
      disabled={!canWrite}
      title={canWrite ? `Write a post for ${time}` : label}
      aria-label={label}
      onClick={onFill}
      className={`border-module/50 text-module flex w-full min-w-0 items-center gap-1.5 rounded-md border border-dashed px-1 py-1 text-left ${
        canWrite ? 'hover:bg-module hover:bg-soft cursor-pointer' : 'cursor-default'
      }`}
    >
      <Icon glyph={faCalendarPlus} className="size-3 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs">
        <span className="font-semibold">{time}</span> free
      </span>
    </button>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  dayPosts,
  openSlots,
  assetsById,
  canWrite,
  clock,
  onOpenPost,
  onNewOnDay,
  onNewAt,
}: {
  /** A calendar day, "2026-10-11". */
  day: string;
  inMonth: boolean;
  isToday: boolean;
  dayPosts: Post[];
  /** Posting times on this day with nothing scheduled in them. */
  openSlots: Date[];
  assetsById: Map<string, MediaAsset>;
  canWrite: boolean;
  clock: string;
  onOpenPost: (post: Post, event: OpenEvent) => void;
  onNewOnDay: (day: string) => void;
  onNewAt: (at: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const shown = dayPosts.slice(0, 3);
  const overflow = dayPosts.length - shown.length;
  const dayLabel = nameDay(day);

  return (
    <div
      ref={setNodeRef}
      className={`group/day relative flex min-h-28 flex-col gap-1 border-r border-b p-1.5 ${
        isOver
          ? 'border-module bg-module bg-soft'
          : `border-base-300 ${inMonth ? 'bg-base-100' : 'bg-base-200/50'}`
      }`}
    >
      {/* The whole cell is the "write a post on this day" target — the click surface a
          calendar operator expects. It sits BEHIND the date + chips (which re-enable
          their own pointer events), so tapping any empty space, the date, or the "+N
          more" line starts a dated post, while a chip still opens its post. */}
      {canWrite ? (
        <button
          type="button"
          aria-label={`New post on ${dayLabel}`}
          title="Write a post on this day"
          onClick={() => {
            onNewOnDay(day);
          }}
          className="hover:bg-module hover:bg-soft focus-visible:bg-module focus-visible:bg-soft absolute inset-0 cursor-pointer"
        />
      ) : null}

      <div className="pointer-events-none relative flex min-h-0 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span
            className={
              isToday
                ? 'bg-module text-module-content grid size-6 place-items-center rounded-full text-sm font-semibold'
                : 'grid size-6 place-items-center text-sm font-medium'
            }
          >
            {dateNumber(day)}
          </span>
          {canWrite ? (
            <span
              className="text-module opacity-0 transition-opacity group-hover/day:opacity-100"
              aria-hidden
            >
              <Icon glyph={faPlus} className="size-4" />
            </span>
          ) : null}
        </div>
        {shown.map((post) => (
          <div key={post.id} className="pointer-events-auto">
            <DayChip
              post={post}
              assetsById={assetsById}
              canWrite={canWrite}
              clock={clock}
              onOpen={(event) => {
                onOpenPost(post, event);
              }}
            />
          </div>
        ))}
        {/* Only when the day has room to show them — a busy day's real posts matter
            more than the gaps between them. */}
        {shown.length < 3
          ? openSlots.slice(0, 3 - shown.length).map((at) => (
              <div key={at.toISOString()} className="pointer-events-auto">
                <EmptySlotChip
                  at={at}
                  canWrite={canWrite}
                  clock={clock}
                  onFill={() => {
                    onNewAt(at);
                  }}
                />
              </div>
            ))
          : null}
        {overflow > 0 ? <span className="px-1 text-xs font-medium">+{overflow} more</span> : null}
      </div>
    </div>
  );
}

/**
 * The grid, month or week.
 *
 * One component for both, because a week IS seven day cells — the same cell, the same
 * drop target, the same chips. The only differences are which days are in the list and
 * how tall a row gets to be, and a second component would mean every future change to a
 * day cell having to be made twice.
 */
function CalendarGrid({
  days,
  month,
  postsByDay,
  openSlotsByDay,
  assetsById,
  canWrite,
  clock,
  todayKey,
  tall,
  onOpenPost,
  onNewOnDay,
  onNewAt,
}: {
  days: string[];
  /** Which month counts as "this one" ("2026-10"), for dimming the spill-over days. */
  month: string | null;
  postsByDay: Map<string, Post[]>;
  openSlotsByDay: Map<string, Date[]>;
  assetsById: Map<string, MediaAsset>;
  canWrite: boolean;
  clock: string;
  /** Today on the business's clock, not this computer's. */
  todayKey: string;
  /** A week has one row, so its cells can afford real height. */
  tall?: boolean;
  onOpenPost: (post: Post, event: OpenEvent) => void;
  onNewOnDay: (day: string) => void;
  onNewAt: (at: Date) => void;
}) {
  return (
    // `flex-1`, NOT `h-full`. This card is a flex ITEM of a column flex parent, and
    // `height: 100%` there resolves against a containing block that flex sizing does
    // not make definite — so it silently falls back to CONTENT height and the card
    // stops partway down the pane however much room it is given. Measured: with the
    // parent at 1402px the `h-full` card stayed 706px; as `flex-1` it takes all 1402.
    // Growing into a flex parent is always `flex-1`; a percentage is the bug.
    <div className="border-base-300 flex flex-1 flex-col overflow-hidden rounded-xl border">
      <div className="border-base-300 grid shrink-0 grid-cols-7 border-b">
        {WEEKDAYS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-semibold">
            {label}
          </div>
        ))}
      </div>
      {/* `minmax(<floor>, 1fr)` per row, not `grid-rows-6`/`auto`.
          `auto` was why the card stopped partway down the pane: rows took only the
          height their chips needed and the rest of the pane went to waste.
          Tailwind's `grid-rows-6` is `repeat(6, minmax(0, 1fr))`, which fixes that but
          swaps in a worse bug — a 0 floor lets a short pane squeeze rows below the
          cell's own `min-h-28`, and the cells then spill over each other.
          Spelling the floor into the track keeps both properties: share the surplus
          when there is room, refuse to go below a legible row when there is not, and
          let the pane scroll at that point. The floors match DayCell's min-h-28 and
          the week view's taller cell. */}
      <div
        className={`grid flex-1 grid-cols-7 ${
          tall
            ? '[grid-template-rows:minmax(16rem,1fr)]'
            : '[grid-template-rows:repeat(6,minmax(7rem,1fr))]'
        }`}
      >
        {days.map((day) => {
          return (
            <DayCell
              key={day}
              day={day}
              inMonth={month === null || monthOf(day) === month}
              isToday={day === todayKey}
              dayPosts={postsByDay.get(day) ?? []}
              openSlots={openSlotsByDay.get(day) ?? []}
              assetsById={assetsById}
              canWrite={canWrite}
              clock={clock}
              onOpenPost={onOpenPost}
              onNewOnDay={onNewOnDay}
              onNewAt={onNewAt}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Unscheduled drafts tray ──────────────────────────────────────────────── */

function DraftCard({
  post,
  assetsById,
  canWrite,
  onOpen,
}: {
  post: Post;
  assetsById: Map<string, MediaAsset>;
  canWrite: boolean;
  onOpen: (event: OpenEvent) => void;
}) {
  // A draft has no date; drag one onto a day to schedule it there.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: post.id,
    disabled: !canWrite,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      title={
        canWrite
          ? `${excerpt(post.body, 120)} · drag onto a day to schedule`
          : excerpt(post.body, 120)
      }
      className={`border-base-300 hover:bg-base-200 flex w-44 shrink-0 items-center gap-2 rounded-lg border p-2 text-left ${
        canWrite ? 'cursor-grab' : 'cursor-pointer'
      } ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      {...listeners}
    >
      <PostThumb post={post} assetsById={assetsById} size="sm" />
      <span className="min-w-0 flex-1 text-sm break-words">{excerpt(post.body, 40)}</span>
    </button>
  );
}

function DraftsTray({
  drafts,
  assetsById,
  canWrite,
  onOpenPost,
}: {
  drafts: Post[];
  assetsById: Map<string, MediaAsset>;
  canWrite: boolean;
  onOpenPost: (post: Post, event: OpenEvent) => void;
}) {
  if (drafts.length === 0) return null;
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Heading level={3} className="text-sm font-semibold">
          Unscheduled drafts
        </Heading>
        <Text className="text-sm">{drafts.length}</Text>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {drafts.map((post) => (
          <DraftCard
            key={post.id}
            post={post}
            assetsById={assetsById}
            canWrite={canWrite}
            onOpen={(event) => {
              onOpenPost(post, event);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── The surface ──────────────────────────────────────────────────────────── */

export function PostsCalendar({
  posts,
  assetsById,
  slots,
  canWrite,
  nothingConnected,
  onOpenPost,
  onNewOnDay,
  onNewAt,
  onReschedule,
  reader,
}: CalendarProps) {
  const [view, setView] = useState<'month' | 'week'>('month');
  const clock = reader.zone ?? reader.device;
  const todayKey = todayOn(clock);
  // Null follows today on the business's clock, so the opening month is HER month even
  // when her zone arrives a moment after the first paint. A day once someone steps.
  const [picked, setPicked] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // The cursor means "the month" or "the start of the week" depending on the view, so
  // switching views has to re-anchor it — otherwise Week opens on the 1st of a month
  // that may be four weeks from where the person was looking.
  const anchor = (day: string, on: 'month' | 'week') =>
    on === 'week' ? startOfWeek(day) : startOfMonth(day);
  const cursor = anchor(picked ?? todayKey, view);
  const changeView = (next: 'month' | 'week') => {
    if (picked !== null) setPicked(anchor(picked, next));
    setView(next);
  };

  // 6px before a drag begins, so a tap still opens the post (matches the workbench's
  // other drag surfaces). Pointer-only: the equivalent keyboard path is opening the
  // post and using its schedule field.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activePost = activeId ? (posts.find((p) => p.id === activeId) ?? null) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const post = posts.find((p) => p.id === String(active.id));
    if (!post) return;
    onReschedule(post, String(over.id));
  };

  const postsByDay = useMemo(() => {
    const byDay = byDayOn(posts, postInstant, clock);
    // Within a day, order by the moment it goes out / went out.
    for (const list of byDay.values()) {
      list.sort((a, b) => {
        const at = a.publishedAt ?? a.scheduledAt ?? '';
        const bt = b.publishedAt ?? b.scheduledAt ?? '';
        return at.localeCompare(bt);
      });
    }
    return byDay;
  }, [posts, clock]);

  const drafts = useMemo(
    () => posts.filter((post) => post.status === 'draft' && !post.scheduledAt),
    [posts]
  );

  const days = useMemo(
    () => (view === 'month' ? monthGrid(cursor) : weekDays(cursor)),
    [view, cursor]
  );

  /**
   * The posting times on screen that have nothing in them.
   *
   * A slot counts as filled by anything within an hour and a half of it — a rhythm, not
   * a stopwatch, and the same window the server-side filler uses, so what the calendar
   * shows as free is exactly what would be filled.
   */
  const openSlotsByDay = useMemo(() => {
    const out = new Map<string, Date[]>();
    if (days.length === 0 || slots.length === 0) return out;

    const firstStart = dayStartOn(days[0]!, clock);
    if (!firstStart) return out;
    const from = new Date(firstStart.getTime() - 1);
    const spanDays = days.length;
    const scheduled = posts
      .map((p) => postInstant(p))
      .filter((iso): iso is string => iso !== null)
      .map((iso) => Date.parse(iso));

    for (const slot of slots) {
      if (!slot.enabled) continue;
      for (const at of slotOccurrences(
        { weekday: slot.weekday, minuteOfDay: slot.minuteOfDay, timezone: slot.timezone },
        from,
        spanDays
      )) {
        const taken = scheduled.some((t) => Math.abs(t - at.getTime()) <= OCCUPIED_WINDOW_MS);
        if (taken) continue;
        const key = dayOn(at.toISOString(), clock);
        if (!key) continue;
        const list = out.get(key);
        if (list) list.push(at);
        else out.set(key, [at]);
      }
    }
    for (const list of out.values()) list.sort((a, b) => a.getTime() - b.getTime());
    return out;
  }, [days, slots, posts, clock]);

  const rangeLabel = nameRange(view, cursor);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event: DragStartEvent) => {
        setActiveId(String(event.active.id));
      }}
      onDragCancel={() => {
        setActiveId(null);
      }}
      onDragEnd={handleDragEnd}
    >
      {/* Full width, not a centred reading column. A calendar is a GRID, and a capped
          column spent the pane's width on empty gutters while squeezing seven day cells
          into 72rem — the wider the pane, the more each day gets, which is the whole
          reason someone docks this one wide. `flex-1` + `min-h-0` so the grid inside can
          claim the leftover height rather than sitting in a short card. */}
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Heading level={2} className="text-lg font-semibold">
            {rangeLabel}
          </Heading>
          <div className="flex-1" />
          {/* Month plans, week works. A social manager checks the shape of the month
              and then lives in this week — the same grid, seven cells, room to see what
              is actually in each day. */}
          <ToggleGroup
            color="module"
            size="sm"
            value={[view]}
            aria-label="How much to show"
            onValueChange={(value: string[]) => {
              const next = value[value.length - 1];
              if (next === 'month' || next === 'week') changeView(next);
            }}
          >
            <ToggleGroupItem value="month">Month</ToggleGroupItem>
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
          </ToggleGroup>
          <Button
            size="sm"
            variant="ghost"
            aria-label={view === 'month' ? 'Previous month' : 'Previous week'}
            onClick={() => {
              setPicked(stepCursor(cursor, view, -1));
            }}
          >
            <Icon glyph={faChevronLeft} className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPicked(null);
            }}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={view === 'month' ? 'Next month' : 'Next week'}
            onClick={() => {
              setPicked(stepCursor(cursor, view, 1));
            }}
          >
            <Icon glyph={faChevronRight} className="size-4" aria-hidden />
          </Button>
        </div>

        {canWrite ? (
          <Text className="shrink-0 text-sm">
            {/* Three states, not two. "Click any day" is the right invitation for
                a business with somewhere to post and the wrong one for a business
                with nothing connected, who gets the composer's "there is nowhere
                for a post to go" and a trip back here. */}
            {nothingConnected
              ? 'Connect an account first and your posts appear here, on the days they go out.'
              : posts.length === 0
                ? 'No posts yet. Click any day to write your first one.'
                : 'Click any day to write a post dated to it. Drag a post to another day to reschedule it, or drag a draft up from below onto a day to schedule it.'}
          </Text>
        ) : null}

        {/* Whose clock the days and times are on. Held back while the business's zone is
            still loading, so it never names the wrong one (piggles persona issue 990). */}
        {reader.zone === undefined ? null : (
          <Text className="shrink-0 text-sm">
            {timesNote(reader.zone, reader.device, new Date())}
          </Text>
        )}

        {/* A grid is always the view — it never degrades into a list. On a pane too
            narrow for seven legible columns it scrolls sideways instead. */}
        <div className="-mx-1 flex min-h-0 flex-1 flex-col overflow-x-auto px-1">
          <div className="flex min-w-[44rem] flex-1 flex-col">
            <CalendarGrid
              days={days}
              month={view === 'month' ? monthOf(cursor) : null}
              postsByDay={postsByDay}
              openSlotsByDay={openSlotsByDay}
              assetsById={assetsById}
              canWrite={canWrite}
              clock={clock}
              todayKey={todayKey}
              tall={view === 'week'}
              onOpenPost={onOpenPost}
              onNewOnDay={onNewOnDay}
              onNewAt={onNewAt}
            />
          </div>
        </div>

        <DraftsTray
          drafts={drafts}
          assetsById={assetsById}
          canWrite={canWrite}
          onOpenPost={onOpenPost}
        />
      </div>

      {/* The lifted post follows the pointer; a portal keeps it above the grid. */}
      <DragOverlay dropAnimation={null}>
        {activePost ? (
          <div className="border-module bg-base-100 flex w-52 items-center gap-2 rounded-lg border p-2">
            <PostThumb post={activePost} assetsById={assetsById} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {excerpt(activePost.body, 40)}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   THE SURFACE — the module's default landing. A social manager opens the app
   to this: the month laid out, drag to reschedule, tap a day to write.
   ══════════════════════════════════════════════════════════════════════════ */

export function SocialCalendarSurface({ ctx }: { ctx: SurfaceContext }) {
  const board = useSocialBoard(ctx);
  const { posts, canWrite, all } = board;
  // The standing posting times, so an empty Tuesday LOOKS empty rather than blank.
  const slots = usePostingSlots();

  if (posts.isError) {
    return (
      <div className={PANE_SHELL}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            icon={<Icon glyph={faServer} className="size-6" aria-hidden />}
            title="Could not load your posts"
            description={socialErrorMessage(
              posts.error,
              'This is a problem reaching the server. Nothing about your posts has changed.'
            )}
            onRetry={() => {
              void posts.refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Controls for what is going out, and when"
        primary={
          canWrite ? (
            <Button
              color="module"
              size="sm"
              className="ml-auto shrink-0 whitespace-nowrap"
              title="Write a new post: hold Shift to open alongside, Alt for a new window"
              onClick={(event) => {
                board.openNew(event);
              }}
            >
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              New post
            </Button>
          ) : null
        }
        refresh={
          <RefreshButton
            isFetching={posts.isFetching}
            updatedAt={posts.data ? posts.dataUpdatedAt : undefined}
            onRefresh={() => {
              void posts.refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {posts.isPending ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneWaiting />
          </Card>
        ) : (
          // The calendar is ALWAYS the view — an empty month is still a calendar you
          // click into to write your first post. The zero-posts guidance rides inside
          // it as a hint, not a screen that replaces the grid.
          //
          // `min-h-full` rather than `h-full`: the grid takes every pixel the pane has
          // when there is room, and grows past it (letting this container scroll) when
          // the pane is too short for six legible rows. `h-full` would cap it and crush
          // the rows instead.
          <div className="flex min-h-full flex-col p-4">
            <PostsCalendar
              posts={all}
              assetsById={board.assetsById}
              slots={slots.data ?? []}
              canWrite={canWrite}
              nothingConnected={board.nothingConnected}
              onOpenPost={board.openPost}
              onNewOnDay={board.newOnDay}
              onNewAt={board.newAt}
              onReschedule={board.onReschedule}
              reader={board.reader}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default SocialCalendarSurface;
