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
import { Button, EmptyState, Heading, Text } from '@wizeworks/silicaui-react';
import { ChevronLeft, ChevronRight, Plus, ServerCrash } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { MediaAsset } from '../cms/media';
import { PostThumb, excerpt, formatTime, postDate } from './post-visuals';
import { useSocialBoard } from './board';
import { isEditablePost, postStatusMeta, socialErrorMessage, type Post } from './data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

interface CalendarProps {
  posts: Post[];
  assetsById: Map<string, MediaAsset>;
  canWrite: boolean;
  onOpenPost: (post: Post, event: OpenEvent) => void;
  onNewOnDay: (day: Date) => void;
  /** Drop a post onto a day → (re)schedule it there. Only fired for editable posts
   *  (a published one is pinned to when it went out). */
  onReschedule: (post: Post, day: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Status → a decorative dot colour (not text, so a tone class is fine here). */
const TONE_DOT: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  neutral: 'bg-base-content/40',
};

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

/** `2026-07-24` → a local Date at midnight — the inverse of dayKey, for turning a
 *  drop target's id back into the day the post was dropped on. */
function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The 42 cells (6 stable weeks) of the month around `cursor`, Sunday-first. */
function buildGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

/* ── One post, as a calendar chip ─────────────────────────────────────────── */

function DayChip({
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
      title={`${excerpt(post.body, 80)} — ${meta.label}${movable ? ' · drag to reschedule' : ''}`}
      className={`hover:bg-base-300 bg-base-200 flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left ${
        movable ? 'cursor-grab' : 'cursor-pointer'
      } ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[meta.tone]}`} aria-hidden />
      <PostThumb post={post} assetsById={assetsById} size="xs" />
      <span className="min-w-0 flex-1 truncate text-xs">
        {iso ? <span className="font-semibold">{formatTime(iso)} </span> : null}
        {excerpt(post.body, 32)}
      </span>
    </button>
  );
}

/* ── The month grid ───────────────────────────────────────────────────────── */

function DayCell({
  day,
  inMonth,
  isToday,
  dayPosts,
  assetsById,
  canWrite,
  onOpenPost,
  onNewOnDay,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  dayPosts: Post[];
  assetsById: Map<string, MediaAsset>;
  canWrite: boolean;
  onOpenPost: (post: Post, event: OpenEvent) => void;
  onNewOnDay: (day: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day) });
  const shown = dayPosts.slice(0, 3);
  const overflow = dayPosts.length - shown.length;
  const dayLabel = day.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

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
            {day.getDate()}
          </span>
          {canWrite ? (
            <span
              className="text-module opacity-0 transition-opacity group-hover/day:opacity-100"
              aria-hidden
            >
              <Plus className="size-4" />
            </span>
          ) : null}
        </div>
        {shown.map((post) => (
          <div key={post.id} className="pointer-events-auto">
            <DayChip
              post={post}
              assetsById={assetsById}
              canWrite={canWrite}
              onOpen={(event) => {
                onOpenPost(post, event);
              }}
            />
          </div>
        ))}
        {overflow > 0 ? <span className="px-1 text-xs font-medium">+{overflow} more</span> : null}
      </div>
    </div>
  );
}

function MonthGrid({
  cursor,
  postsByDay,
  assetsById,
  canWrite,
  onOpenPost,
  onNewOnDay,
}: {
  cursor: Date;
  postsByDay: Map<string, Post[]>;
  assetsById: Map<string, MediaAsset>;
  canWrite: boolean;
  onOpenPost: (post: Post, event: OpenEvent) => void;
  onNewOnDay: (day: Date) => void;
}) {
  const cells = useMemo(() => buildGrid(cursor), [cursor]);
  const month = cursor.getMonth();
  const todayKey = dayKey(new Date());

  return (
    <div className="border-base-300 overflow-hidden rounded-xl border">
      <div className="border-base-300 grid grid-cols-7 border-b">
        {WEEKDAYS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-semibold">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const key = dayKey(day);
          return (
            <DayCell
              key={key}
              day={day}
              inMonth={day.getMonth() === month}
              isToday={key === todayKey}
              dayPosts={postsByDay.get(key) ?? []}
              assetsById={assetsById}
              canWrite={canWrite}
              onOpenPost={onOpenPost}
              onNewOnDay={onNewOnDay}
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
    <div className="flex flex-col gap-2">
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
  canWrite,
  onOpenPost,
  onNewOnDay,
  onReschedule,
}: CalendarProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [activeId, setActiveId] = useState<string | null>(null);

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
    const day = parseDayKey(String(over.id));
    onReschedule(post, day);
  };

  const postsByDay = useMemo(() => {
    const byDay = new Map<string, Post[]>();
    for (const post of posts) {
      const date = postDate(post);
      if (!date) continue;
      const key = dayKey(date);
      const list = byDay.get(key);
      if (list) list.push(post);
      else byDay.set(key, [post]);
    }
    // Within a day, order by the moment it goes out / went out.
    for (const list of byDay.values()) {
      list.sort((a, b) => {
        const at = a.publishedAt ?? a.scheduledAt ?? '';
        const bt = b.publishedAt ?? b.scheduledAt ?? '';
        return at.localeCompare(bt);
      });
    }
    return byDay;
  }, [posts]);

  const drafts = useMemo(
    () => posts.filter((post) => post.status === 'draft' && !post.scheduledAt),
    [posts]
  );

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex items-center gap-2">
          <Heading level={2} className="text-lg font-semibold">
            {monthLabel}
          </Heading>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            aria-label="Previous month"
            onClick={() => {
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
            }}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCursor(startOfMonth(new Date()));
            }}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Next month"
            onClick={() => {
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
            }}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>

        {canWrite ? (
          <Text className="text-sm">
            {posts.length === 0
              ? 'No posts yet — click any day to write your first one.'
              : 'Click any day to write a post dated to it. Drag a post to another day to reschedule it — or drag a draft up from below onto a day to schedule it.'}
          </Text>
        ) : null}

        {/* The month grid is always the view. On a pane too narrow for seven legible
            columns it scrolls sideways rather than collapsing to a list. */}
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="min-w-[44rem]">
            <MonthGrid
              cursor={cursor}
              postsByDay={postsByDay}
              assetsById={assetsById}
              canWrite={canWrite}
              onOpenPost={onOpenPost}
              onNewOnDay={onNewOnDay}
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

  if (posts.isError) {
    return (
      <div className={PANE_SHELL}>
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState
            icon={<ServerCrash className="size-6" aria-hidden />}
            title="Could not load your posts"
            description={socialErrorMessage(
              posts.error,
              'This is a problem reaching the server. Nothing about your posts has changed.'
            )}
            actions={
              <Button
                size="sm"
                color="module"
                onClick={() => {
                  void posts.refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Calendar controls" wrap>
        {canWrite ? (
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0 whitespace-nowrap"
            title="Write a new post — hold Shift to open alongside, Alt for a new window"
            onClick={(event) => {
              board.openNew(event);
            }}
          >
            <Plus className="size-4" aria-hidden />
            New post
          </Button>
        ) : null}
        <RefreshButton
          className={canWrite ? undefined : 'ml-auto'}
          isFetching={posts.isFetching}
          updatedAt={posts.data ? posts.dataUpdatedAt : undefined}
          onRefresh={() => {
            void posts.refetch();
          }}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {posts.isPending ? (
          <p className="p-4 text-sm" role="status">
            Loading…
          </p>
        ) : (
          // The calendar is ALWAYS the view — an empty month is still a calendar you
          // click into to write your first post. The zero-posts guidance rides inside
          // it as a hint, not a screen that replaces the grid.
          <div className="p-4">
            <PostsCalendar
              posts={all}
              assetsById={board.assetsById}
              canWrite={canWrite}
              onOpenPost={board.openPost}
              onNewOnDay={board.newOnDay}
              onReschedule={board.onReschedule}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default SocialCalendarSurface;
