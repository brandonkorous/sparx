'use client';

// The live per-destination preview (docs/133 §8) — what this post will ACTUALLY look
// like on one account, updating as you type.
//
// This is the composer's whole reason for existing. A tenant writes once and it fans
// out to accounts with wildly different rules: Instagram cannot post without a picture,
// Threads cuts off at 500 characters, a Pinterest Pin is a tall 2:3 image, a Short is
// vertical video. Told as a list of warnings, that is homework. SHOWN — cropped to the
// real shape, with the words that will actually survive the limit — it is obvious.
//
// Deliberately NOT a pixel clone of anyone's UI: it is a faithful preview of OUR post
// (subject framing, aspect, what gets cut, how the link is treated), not an imitation
// of a competitor's chrome.
//
// Two house rules shape the implementation:
//   - No inline `style`. The aspect ratio and the focal-point crop are both DYNAMIC,
//     so each resolves to one of a FIXED set of static Tailwind classes (Tailwind
//     cannot JIT a runtime-interpolated class). The focal point quantizes to the
//     nearest ninth, which is imperceptible at preview size.
//   - Faded text only where it is deliberately not meant to be read: here, exactly one
//     place — the tail of a caption that the platform will CUT. That is struck through
//     in the error tone, because seeing which words die is the point.

import Image from 'next/image';
import { Badge, Text } from '@wizeworks/silicaui-react';
import { faImageSlash, faLink, faPlay, faVideo } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { MediaAsset } from '../cms/media';
import type { PlatformConstraints, SocialPlatform } from './data';

/* ── Shape + framing ──────────────────────────────────────────────────────── */

/** The platform's PRIMARY aspect (its first advertised ratio) as a static Tailwind
 *  class. Data-driven off the catalog's constraints, so a platform that changes its
 *  preferred shape changes here for free. */
const ASPECT_CLASS: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-video',
  '1.91:1': 'aspect-[1.91/1]',
  '2:3': 'aspect-[2/3]',
  '4:3': 'aspect-[4/3]',
};

export function aspectClassFor(constraints: PlatformConstraints | undefined): string {
  const ratio = constraints?.aspectRatios?.[0];
  return (ratio ? ASPECT_CLASS[ratio] : undefined) ?? 'aspect-square';
}

/** The human label for that shape ("1:1"), so the crop is legible as a decision. */
export function aspectLabelFor(constraints: PlatformConstraints | undefined): string | null {
  return constraints?.aspectRatios?.[0] ?? null;
}

/** Quantize a 0..1 focal point to the nearest of the nine standard object-positions.
 *  Static classes only — Tailwind cannot compile an interpolated arbitrary value, and
 *  an inline style is banned. Nine buckets is plenty to keep a subject in frame. */
export function focalClassFor(x: number, y: number): string {
  const col = x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'center';
  const row = y < 1 / 3 ? 'top' : y > 2 / 3 ? 'bottom' : 'center';
  if (col === 'center' && row === 'center') return 'object-center';
  if (col === 'center') return row === 'top' ? 'object-top' : 'object-bottom';
  if (row === 'center') return col === 'left' ? 'object-left' : 'object-right';
  if (col === 'left') return row === 'top' ? 'object-left-top' : 'object-left-bottom';
  return row === 'top' ? 'object-right-top' : 'object-right-bottom';
}

function isVideo(asset: MediaAsset): boolean {
  return asset.mimeType.startsWith('video/');
}

/* ── Words that survive ───────────────────────────────────────────────────── */

export interface CaptionSplit {
  /** What the platform will actually publish. */
  kept: string;
  /** What it will cut (empty when the caption fits). */
  cut: string;
}

/** Split a caption at the platform's character limit so the preview can SHOW the cut
 *  rather than describe it. */
export function splitCaption(text: string, maxLength: number | undefined): CaptionSplit {
  if (!maxLength || text.length <= maxLength) return { kept: text, cut: '' };
  return { kept: text.slice(0, maxLength), cut: text.slice(maxLength) };
}

/* ── How each platform treats the link ────────────────────────────────────── */

export type LinkTreatment = 'card' | 'inline' | 'cta' | 'destination';

/** Mirrors what the ADAPTERS actually do with `link`, so the preview never promises a
 *  treatment the publish path won't deliver (packages/social/src/adapters/*). */
export function linkTreatmentFor(platform: SocialPlatform, hasMedia: boolean): LinkTreatment {
  switch (platform) {
    case 'google_business':
      return 'cta'; // a LEARN_MORE call-to-action button
    case 'pinterest':
      return 'destination'; // the Pin itself links out
    case 'facebook_page':
    case 'linkedin':
    case 'threads':
      // With media there is no link field, so it rides in the text; without media the
      // platform renders a real link/article card.
      return hasMedia ? 'inline' : 'card';
    default:
      return 'inline'; // Instagram / TikTok / YouTube — no clickable link in a caption
  }
}

function hostOf(link: string): string {
  try {
    return new URL(link).host.replace(/^www\./, '');
  } catch {
    return link;
  }
}

/* ── The preview ──────────────────────────────────────────────────────────── */

export interface PostPreviewProps {
  platform: SocialPlatform;
  /** "Instagram" — the platform's display name from the catalog. */
  platformLabel: string;
  /** The page/profile this lands on. */
  destinationName: string;
  avatarUrl?: string | null;
  constraints: PlatformConstraints | undefined;
  /** The wording that reaches THIS destination (override applied by the caller). */
  text: string;
  link?: string;
  firstComment?: string;
  /** Resolved assets, in order. */
  media: MediaAsset[];
}

export function PostPreview({
  platform,
  platformLabel,
  destinationName,
  avatarUrl,
  constraints,
  text,
  link,
  firstComment,
  media,
}: PostPreviewProps) {
  const aspect = aspectClassFor(constraints);
  const aspectLabel = aspectLabelFor(constraints);
  const maxMedia = constraints?.maxMediaCount ?? 0;
  const used = maxMedia > 0 ? media.slice(0, maxMedia) : [];
  const dropped = Math.max(0, media.length - used.length);
  const lead = used[0];
  const needsMedia = (constraints?.requiresMedia ?? false) && media.length === 0;
  const { kept, cut } = splitCaption(text, constraints?.maxTextLength);
  const treatment = linkTreatmentFor(platform, media.length > 0);

  return (
    <article className="border-base-300 bg-base-100 flex flex-col overflow-hidden rounded-xl border">
      {/* who it posts as */}
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className="bg-base-300 relative size-8 shrink-0 overflow-hidden rounded-full">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="32px" className="object-cover" unoptimized />
          ) : (
            <span className="flex h-full items-center justify-center text-sm font-semibold">
              {destinationName.replace(/^@/, '').charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{destinationName}</span>
          <span className="text-sm">{platformLabel}</span>
        </span>
        {aspectLabel && (media.length > 0 || needsMedia) ? (
          <Badge variant="soft" size="sm">
            {aspectLabel}
          </Badge>
        ) : null}
      </header>

      {/* the picture, in this platform's shape */}
      {needsMedia ? (
        <div
          className={`border-error/40 bg-error/5 text-error m-3 flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed ${aspect}`}
        >
          <Icon glyph={faImageSlash} className="size-6" aria-hidden />
          <Text className="text-error px-4 text-center text-sm font-medium">
            {platformLabel} will not post without a picture or video.
          </Text>
        </div>
      ) : lead ? (
        <div className={`bg-base-200 relative w-full ${aspect}`}>
          {isVideo(lead) ? (
            <span className="flex h-full flex-col items-center justify-center gap-1.5">
              <Icon glyph={faVideo} className="size-7" aria-hidden />
              <span className="text-sm font-medium">{lead.filename}</span>
            </span>
          ) : lead.url ? (
            <>
              <Image
                src={lead.url}
                alt={lead.filename}
                fill
                sizes="(max-width: 1024px) 100vw, 420px"
                className={`object-cover ${focalClassFor(lead.focalX, lead.focalY)}`}
                unoptimized={!lead.canOptimize}
              />
              {media.some(isVideo) && !isVideo(lead) ? (
                <span className="bg-base-100/90 absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-sm">
                  <Icon glyph={faPlay} className="size-3.5" aria-hidden />
                </span>
              ) : null}
            </>
          ) : (
            <span className="flex h-full items-center justify-center text-sm">
              Still processing…
            </span>
          )}
          {used.length > 1 ? (
            <span className="bg-base-100/90 absolute top-2 right-2 rounded-full px-2 py-0.5 text-sm font-medium">
              1 / {used.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* the words that survive */}
      <div className="flex flex-col gap-2 px-3 py-2.5">
        {text.trim() === '' ? (
          <Text className="text-sm italic">Your words will appear here.</Text>
        ) : (
          <Text className="text-sm break-words whitespace-pre-wrap">
            {kept}
            {cut ? <span className="text-error line-through">{cut}</span> : null}
          </Text>
        )}

        {cut ? (
          <Text className="text-error text-sm font-medium">
            {cut.length.toLocaleString()} {cut.length === 1 ? 'character' : 'characters'} past the
            limit here — the struck-through words will not be posted.
          </Text>
        ) : null}

        {link && treatment === 'card' ? (
          <span className="border-base-300 bg-base-200 flex items-center gap-2 rounded-lg border px-3 py-2">
            <Icon glyph={faLink} className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{hostOf(link)}</span>
          </span>
        ) : null}
        {link && treatment === 'cta' ? (
          <span className="border-base-300 inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium">
            Learn more
          </span>
        ) : null}
        {link && treatment === 'destination' ? (
          <Text className="text-sm">Tapping this Pin opens {hostOf(link)}.</Text>
        ) : null}
        {link && treatment === 'inline' ? <Text className="text-sm break-all">{link}</Text> : null}

        {firstComment?.trim() ? (
          <span className="border-base-300 mt-1 border-t pt-2">
            <Text className="text-sm">
              <span className="font-semibold">First comment · </span>
              {firstComment}
            </Text>
          </span>
        ) : null}

        {dropped > 0 ? (
          <Text className="text-warning text-sm">
            Takes {maxMedia} {maxMedia === 1 ? 'item' : 'items'} — the other{' '}
            {dropped === 1 ? 'one will' : `${dropped} will`} not be included here.
          </Text>
        ) : null}
      </div>
    </article>
  );
}
