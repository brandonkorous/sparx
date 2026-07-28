'use client';

// Shared visual bits for the social surfaces — the pieces that make a post READ as a
// post instead of a table row. The Posts list and the Calendar both lean on these, so
// a post looks the same wherever it shows up.
//
// Social is pictures-first, so every post carries its lead image (or, for a text-only
// post, a module-tinted card that says so at a glance) and the little cluster of the
// accounts it lands on. Those two things — the picture and where it goes — are what an
// operator actually scans for.

import { useMemo } from 'react';
import Image from 'next/image';
import { Avatar } from '@wizeworks/silicaui-react';
import { MessageSquareText, Video } from 'lucide-react';
import { PlatformMark } from '../../components/platform-mark';
import { useMediaAssets, type MediaAsset } from '../cms/media';
import { focalClassFor } from './post-preview';
import {
  platformName,
  targetStatusMeta,
  type CatalogEntry,
  type Post,
  type PostTarget,
  type SocialPlatform,
} from './data';

/* ── Shared time + text helpers (one voice across list and calendar) ───────── */

/** A post's first words, tidied for a single-line preview. */
export function excerpt(body: string, max = 120): string {
  const first = body.trim().split('\n')[0] ?? '';
  if (first.length > max) return `${first.slice(0, max - 1)}…`;
  return first || 'Untitled post';
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Just the clock part, for a calendar chip where the day is already implied. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** The one date that matters for a post, plus a verb — the line under its words. */
export function whenLine(post: Post): string {
  if (post.publishedAt) return `Posted ${formatWhen(post.publishedAt)}`;
  if (post.scheduledAt) return `Goes out ${formatWhen(post.scheduledAt)}`;
  return `Saved ${formatWhen(post.createdAt)}`;
}

/** The date a post lives on in a calendar — when it went out, else when it is due.
 *  A draft has neither and belongs in the unscheduled tray, not on a day. */
export function postDate(post: Post): Date | null {
  const iso = post.publishedAt ?? post.scheduledAt;
  return iso ? new Date(iso) : null;
}

/* ── Resolving the lead picture for a set of posts ────────────────────────── */

/** Resolve the FIRST media asset of every post in one request, keyed by asset id.
 *  A list or a calendar page holds many posts; this fetches all their lead images
 *  together rather than one query per row. */
export function usePostThumbnails(posts: Post[]): Map<string, MediaAsset> {
  const leadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const post of posts) {
      const first = post.mediaAssetIds[0];
      if (first) ids.add(first);
    }
    return [...ids];
  }, [posts]);

  const assets = useMediaAssets(leadIds);

  return useMemo(() => {
    const byId = new Map<string, MediaAsset>();
    for (const asset of assets.data ?? []) byId.set(asset.id, asset);
    return byId;
  }, [assets.data]);
}

function isVideoAsset(asset: MediaAsset): boolean {
  return asset.mimeType.startsWith('video/');
}

/* ── The lead picture ─────────────────────────────────────────────────────── */

type ThumbSize = 'xs' | 'sm' | 'md';

const THUMB_SIZE: Record<ThumbSize, string> = {
  xs: 'size-6',
  sm: 'size-11',
  md: 'size-16',
};

const THUMB_GLYPH: Record<ThumbSize, string> = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
};

/**
 * A post's lead visual: its first picture cropped square, a still-processing shim,
 * a video marker, or — for a text-only post — a module-tinted card with a message
 * mark, so a wordy post is instantly distinct from a picture one. Never an empty grey
 * box; a post always shows as SOMETHING.
 */
export function PostThumb({
  post,
  assetsById,
  size = 'md',
}: {
  post: Post;
  assetsById: Map<string, MediaAsset>;
  size?: ThumbSize;
}) {
  const box = `${THUMB_SIZE[size]} relative shrink-0 overflow-hidden rounded-lg`;
  const glyph = THUMB_GLYPH[size];
  const leadId = post.mediaAssetIds[0];

  // Text-only post — a deliberate, on-brand tile, not a blank.
  if (!leadId) {
    return (
      <span
        className={`${box} bg-module bg-soft text-module flex items-center justify-center`}
        aria-hidden
      >
        <MessageSquareText className={glyph} />
      </span>
    );
  }

  const asset = assetsById.get(leadId);
  const extra = post.mediaAssetIds.length - 1;

  if (asset && isVideoAsset(asset)) {
    return (
      <span className={`${box} bg-base-200 text-base-content flex items-center justify-center`}>
        <Video className={glyph} aria-hidden />
      </span>
    );
  }

  return (
    <span className={`${box} bg-base-200`}>
      {asset?.url ? (
        <Image
          src={asset.url}
          alt={asset.filename}
          fill
          sizes={size === 'md' ? '64px' : '44px'}
          className={`object-cover ${focalClassFor(asset.focalX, asset.focalY)}`}
          unoptimized={!asset.canOptimize}
        />
      ) : (
        <span className="flex h-full items-center justify-center">
          <MessageSquareText className={`${glyph} opacity-40`} aria-hidden />
        </span>
      )}
      {extra > 0 && size !== 'xs' ? (
        <span className="bg-base-100/90 absolute right-0.5 bottom-0.5 rounded px-1 text-xs font-semibold">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

/* ── Where it goes: the account avatars ───────────────────────────────────── */

/** How big the platform badge sits relative to the face it corners.
 *
 *  Proportional rather than fixed, so one rule covers the 24px avatar on a list row and
 *  the 40px one on a destination card. Half the face is generous for a badge, and
 *  deliberately so: in the list it lands at ~12px, where the GLYPH is already too small to
 *  read and the brand COLOUR is doing the identifying. A ring in the surface colour keeps
 *  it from reading as part of the picture underneath. */
const BADGE = 'absolute -right-0.5 -bottom-0.5 size-[52%] ring-2 ring-base-100';

/**
 * One account, as a face wearing its platform.
 *
 * Two things identify a destination and a profile picture only carries one of them. A
 * business whose Facebook Page, Instagram and Pinterest all wear the same logo — which is
 * most businesses, and is exactly what a consistent brand looks like — showed three
 * identical circles, so "where it goes" answered *whose* but never *where*. The badge
 * closes that without spending a row on it.
 *
 * The face stays the larger, primary element: the account is the thing being chosen or
 * reported on, and the network is the qualifier.
 */
export function AccountAvatar({
  platform,
  name,
  src,
  title,
  size = 'xs',
}: {
  platform: SocialPlatform;
  /** The account's own name — its initial is the fallback when there is no picture. */
  name: string;
  src?: string | null;
  /** Hover text for the whole stack; the badge itself stays decorative. */
  title?: string;
  size?: 'xs' | 'sm' | 'md';
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar size={size} src={src ?? undefined} alt={title ?? name} title={title}>
        {name.replace(/^@/, '').charAt(0).toUpperCase()}
      </Avatar>
      <PlatformMark platform={platform} className={BADGE} />
    </span>
  );
}

/**
 * The accounts a post lands on, as their profile pictures — the "to:" line of a post,
 * shown the way a person recognizes an account: by its face. Each carries a plain-words
 * title (account · platform · how it did), so hovering any face names it and its result;
 * the row's own status badge carries the overall outcome.
 */
export function DestinationAvatars({
  targets,
  avatarByTargetId,
  catalogMap,
  max = 5,
  size = 'xs',
}: {
  targets: PostTarget[];
  avatarByTargetId: Map<string, string | null>;
  catalogMap: Map<string, CatalogEntry>;
  max?: number;
  size?: 'xs' | 'sm';
}) {
  if (targets.length === 0) return null;
  const shown = targets.slice(0, max);
  const overflow = targets.length - shown.length;

  // Spaced rather than overlapped (the AvatarGroup this replaced tucked each face under
  // the next). An overlap would bury the badge of every avatar but the last, which is the
  // one piece of information the stack was added to carry.
  return (
    <span className="flex items-center gap-1">
      {shown.map((target) => (
        <AccountAvatar
          key={target.id}
          platform={target.platform}
          name={target.targetName}
          src={avatarByTargetId.get(target.socialTargetId)}
          size={size}
          title={`${target.targetName} · ${platformName(target.platform, catalogMap)} · ${targetStatusMeta(target.status).label}`}
        />
      ))}
      {overflow > 0 ? (
        <Avatar
          size={size}
          color="neutral"
          alt={`and ${overflow} more`}
          title={`and ${overflow} more`}
        >
          +{overflow}
        </Avatar>
      ) : null}
    </span>
  );
}

/** The connections overview → a {socialTargetId → avatar url} map, so any surface can
 *  show the real account picture behind a post's target (which only stores the name). */
export function useAvatarByTargetId(
  connections: { avatarUrl: string | null; targets: { id: string; avatarUrl: string | null }[] }[]
): Map<string, string | null> {
  return useMemo(() => {
    const out = new Map<string, string | null>();
    for (const connection of connections) {
      for (const target of connection.targets) {
        out.set(target.id, target.avatarUrl ?? connection.avatarUrl);
      }
    }
    return out;
  }, [connections]);
}
