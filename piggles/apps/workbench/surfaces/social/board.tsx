'use client';

// The shared spine behind the two social workspaces — Calendar and Posts. They are
// separate top-level panels (a social manager lives in the Calendar all day; the list
// is for search + triage), but they read the SAME posts and drive the SAME actions, so
// the data, the counts, and the open/new/reschedule handlers live here once and both
// surfaces call `useSocialBoard(ctx)`. A segmented switch hops between them.

import { useMemo } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useViewer } from '../../lib/api/shell-data';
import type { MediaAsset } from '../cms/media';
import {
  canCompose,
  catalogByPlatform,
  socialErrorMessage,
  useReschedulePost,
  useSocialOverview,
  useSocialPosts,
  type CatalogEntry,
  type Post,
  type PostStatus,
} from './data';
import { formatWhen, useAvatarByTargetId, usePostThumbnails } from './post-visuals';

/* ── Lifecycle grouping (shared by the list groups + the pipeline strip) ────── */

export interface Group {
  key: string;
  title: string;
  statuses: PostStatus[];
}

// Ordered by what an operator most wants to see first.
export const GROUPS: Group[] = [
  { key: 'review', title: 'Needs a look', statuses: ['pending_approval', 'failed'] },
  { key: 'queued', title: 'Scheduled', statuses: ['scheduled', 'publishing'] },
  { key: 'drafts', title: 'Drafts', statuses: ['draft'] },
  { key: 'sent', title: 'Posted', statuses: ['published', 'partially_published'] },
];

/* ── Open-target + schedule-seed helpers ──────────────────────────────────── */

export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** A day at 9am, in the `datetime-local` shape the composer's schedule field reads —
 *  so tapping a calendar day opens a post already dated to it. */
function seedScheduleValue(day: Date, keepTime = false): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Tapping a DAY carries no hour, so 9am is a sensible opening bid. Tapping a posting
  // TIME carries a real one — throwing it away would ignore the thing that was clicked.
  const time = keepTime ? `${pad(day.getHours())}:${pad(day.getMinutes())}` : '09:00';
  return `${String(day.getFullYear())}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}`;
}

/* ── The shared board ─────────────────────────────────────────────────────── */

export function useSocialBoard(ctx: SurfaceContext) {
  const viewer = useViewer();
  const posts = useSocialPosts();
  const overview = useSocialOverview();
  const toast = useToast();
  const reschedule = useReschedulePost();

  const canWrite = canCompose(viewer.data?.role);
  const all = useMemo(() => posts.data ?? [], [posts.data]);

  // Resolve every post's lead picture + account avatars ONCE, shared by both views.
  const assetsById = usePostThumbnails(all);
  const avatarByTargetId = useAvatarByTargetId(overview.data?.connections ?? []);
  const catalogMap = useMemo(
    () => catalogByPlatform(overview.data?.catalog ?? []),
    [overview.data]
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const group of GROUPS) {
      out[group.key] = all.filter((post) => group.statuses.includes(post.status)).length;
    }
    return out;
  }, [all]);

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('social.composer', { id: 'new' }, { target: targetFor(event) });
  };

  const openPost = (post: Post, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('social.composer', { id: post.id }, { target: targetFor(event) });
  };

  const newOnDay = (day: Date) => {
    // Seed the composer's schedule with the tapped day; opens alongside so the
    // calendar stays in view (falls back to a tab on compact).
    ctx.open(
      'social.composer',
      { id: 'new', schedule: seedScheduleValue(day) },
      { target: 'beside' }
    );
  };

  /** Start a post at an EXACT moment — clicking one of the standing posting times the
   *  calendar draws as free. Same seam as `newOnDay`, just without discarding the hour
   *  the person actually pointed at. */
  const newAt = (at: Date) => {
    ctx.open(
      'social.composer',
      { id: 'new', schedule: seedScheduleValue(at, true) },
      { target: 'beside' }
    );
  };

  const onReschedule = (post: Post, day: Date) => {
    // Keep the post's time-of-day, just move the date. A draft (no time yet) defaults
    // to 9am. If that lands in the past (dropped on an earlier part of today), nudge to
    // an hour out so the server — which requires a future time — accepts it.
    const base = post.scheduledAt ? new Date(post.scheduledAt) : null;
    const when = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      base ? base.getHours() : 9,
      base ? base.getMinutes() : 0,
      0,
      0
    );
    // Dropped back on the day it already sits on — nothing to do.
    if (base?.getTime() === when.getTime()) return;
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    if (when.getTime() <= Date.now()) when.setTime(soon.getTime());
    const iso = when.toISOString();
    reschedule.mutate(
      { id: post.id, scheduledAt: iso },
      {
        onSuccess: () => {
          toast.add({ title: `Rescheduled to ${formatWhen(iso)}`, type: 'success' });
        },
        onError: (error) => {
          toast.add({
            title: 'Could not reschedule',
            description: socialErrorMessage(error, 'Nothing was changed. Please try again.'),
            type: 'error',
          });
        },
      }
    );
  };

  return {
    viewer,
    posts,
    overview,
    canWrite,
    all,
    assetsById,
    avatarByTargetId,
    catalogMap,
    counts,
    openNew,
    openPost,
    newOnDay,
    newAt,
    onReschedule,
  };
}

export type SocialBoard = ReturnType<typeof useSocialBoard>;
export type { MediaAsset, CatalogEntry, Post };
