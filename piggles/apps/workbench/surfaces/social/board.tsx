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
import { useReaderClock } from '../../lib/business-timezone';
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
import { useAvatarByTargetId, usePostThumbnails } from './post-visuals';
import { rescheduleOn, seedForDay, seedForInstant, whenOn } from './social-clock';

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

/* ── Open-target helper ─────────────────────────────────────────────────────── */

export function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/* ── The shared board ─────────────────────────────────────────────────────── */

export function useSocialBoard(ctx: SurfaceContext) {
  const viewer = useViewer();
  const posts = useSocialPosts();
  const overview = useSocialOverview();
  const toast = useToast();
  const reschedule = useReschedulePost();
  // Every time on both views reads on the business's clock, and a day on the calendar is
  // a day on that clock too (piggles persona issue 990). This computer's only when the
  // business has none, and the screens say so.
  const reader = useReaderClock();
  const clock = reader.zone ?? reader.device;

  const canWrite = canCompose(viewer.data?.role);
  const all = useMemo(() => posts.data ?? [], [posts.data]);

  // Resolve every post's lead picture + account avatars ONCE, shared by both views.
  const assetsById = usePostThumbnails(all);
  const avatarByTargetId = useAvatarByTargetId(overview.data?.connections ?? []);
  const catalogMap = useMemo(
    () => catalogByPlatform(overview.data?.catalog ?? []),
    [overview.data]
  );

  /**
   * Has this business connected anything at all?
   *
   * Derived HERE because both views need it and both were writing their first-run
   * copy without it — the calendar said "click any day to write your first one"
   * and the queue offered "New post", over an account with nowhere for a post to
   * go. Neither was lying, and both cost the very first visit a wasted click:
   * the composer opens, explains there is no destination, and sends you back.
   *
   * `isSuccess` and not `?? []`. While the list is loading nobody knows yet, and
   * an empty array read as "nothing connected" would greet every shop with the
   * first-run sentence on every cold open.
   */
  const nothingConnected = overview.isSuccess && overview.data.connections.length === 0;

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

  const newOnDay = (day: string) => {
    // Seed the composer's schedule with the tapped day; opens alongside so the
    // calendar stays in view (falls back to a tab on compact).
    ctx.open('social.composer', { id: 'new', schedule: seedForDay(day) }, { target: 'beside' });
  };

  /** Start a post at an EXACT moment — clicking one of the standing posting times the
   *  calendar draws as free. Same seam as `newOnDay`, just without discarding the hour
   *  the person actually pointed at. */
  const newAt = (at: Date) => {
    ctx.open(
      'social.composer',
      { id: 'new', schedule: seedForInstant(at.toISOString(), clock) },
      { target: 'beside' }
    );
  };

  const onReschedule = (post: Post, day: string) => {
    // Keep the post's time of day on the business's clock, just move the date. A draft
    // (no time yet) defaults to 9am; a time already gone is nudged to an hour out, so
    // the server, which requires a future time, accepts it.
    const iso = rescheduleOn(post.scheduledAt, day, clock);
    // Dropped back on the day it already sits on: nothing to do.
    if (iso === null) return;
    reschedule.mutate(
      { id: post.id, scheduledAt: iso },
      {
        onSuccess: () => {
          toast.add({ title: `Rescheduled to ${whenOn(iso, clock)}`, type: 'success' });
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
    nothingConnected,
    reader,
    clock,
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
