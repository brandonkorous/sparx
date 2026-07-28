// "When should I post?" answered from the tenant's OWN history (docs/social-audit
// slice 20).
//
// Every competitor ships this as an industry average, which is a horoscope: it tells a
// diesel-parts distributor in Utah the same thing it tells a bakery in Lisbon. The only
// figure worth acting on is the one drawn from this business's own audience, so this
// reads the posts they have actually published and the numbers those posts actually got.
//
// Two honesty rules, because a confident wrong answer is worse than no answer:
//   · a bucket needs a MINIMUM number of posts before it is reported at all — one lucky
//     Tuesday is not a pattern;
//   · when there isn't enough history, it says so and recommends nothing.

import { withTenant } from '@sparx/db';

import type { SocialContext } from './context.js';
import { zonedDateParts } from './cadence.js';

/** Fewer posts than this in a bucket and we don't claim to know anything about it. */
const MIN_POSTS_PER_BUCKET = 3;

/** How far back to look. Older than this and the audience has probably changed. */
const WINDOW_DAYS = 180;

export interface BestTimeBucket {
  /** 0 = Sunday … 6 = Saturday, in the tenant's chosen zone. */
  weekday: number;
  /** Local hour, 0–23. */
  hour: number;
  posts: number;
  /** Mean engagements (likes + comments + shares) per post in this bucket. */
  averageEngagements: number;
}

export interface BestTimeReport {
  timezone: string;
  /** Total published posts the report is drawn from. */
  sampleSize: number;
  /** True when there is enough history to recommend anything at all. */
  confident: boolean;
  /** Best buckets first. Empty when `confident` is false. */
  buckets: BestTimeBucket[];
}

interface PublishedRow {
  publishedAt: Date;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

/** Engagements for one post-destination — a null metric is genuinely unknown, so it
 *  contributes nothing rather than counting as zero. */
function engagementsOf(row: PublishedRow): number {
  return (row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0);
}

/**
 * Group this tenant's published posts by local weekday + hour and rank the buckets by
 * mean engagement.
 *
 * Reads the LATEST metric snapshot per destination (a post's numbers climb for days, so
 * the newest reading is the real one) and joins it to when that destination published.
 */
export async function getBestTimeToPost(
  ctx: SocialContext,
  timezone: string,
  propertyId: string | null = null
): Promise<BestTimeReport> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPostTarget.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: 'published',
        publishedAt: { gte: since },
        ...(propertyId ? { post: { propertyId } } : {}),
      },
      select: { publishedAt: true, id: true },
    })
  );
  if (rows.length === 0) {
    return { timezone, sampleSize: 0, confident: false, buckets: [] };
  }

  const latest = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialPostMetric.findMany({
      where: { tenantId: ctx.tenantId, postTargetId: { in: rows.map((r) => r.id) } },
      orderBy: { collectedAt: 'desc' },
      select: { postTargetId: true, likes: true, comments: true, shares: true },
    })
  );
  // Ordered newest-first, so the FIRST reading seen for a destination is its latest.
  const newest = new Map<string, (typeof latest)[number]>();
  for (const metric of latest) {
    if (!newest.has(metric.postTargetId)) newest.set(metric.postTargetId, metric);
  }

  const buckets = new Map<
    string,
    { weekday: number; hour: number; posts: number; total: number }
  >();
  let sampleSize = 0;

  for (const row of rows) {
    if (!row.publishedAt) continue;
    const metric = newest.get(row.id);
    // No numbers back yet — it can't say anything about what time works.
    if (!metric) continue;

    const parts = zonedDateParts(row.publishedAt, timezone);
    const hour =
      Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          hour12: false,
        }).format(row.publishedAt)
      ) % 24;

    const key = `${String(parts.weekday)}:${String(hour)}`;
    const bucket = buckets.get(key) ?? { weekday: parts.weekday, hour, posts: 0, total: 0 };
    bucket.posts += 1;
    bucket.total += engagementsOf({
      publishedAt: row.publishedAt,
      likes: metric.likes,
      comments: metric.comments,
      shares: metric.shares,
    });
    buckets.set(key, bucket);
    sampleSize += 1;
  }

  const ranked = [...buckets.values()]
    .filter((b) => b.posts >= MIN_POSTS_PER_BUCKET)
    .map((b) => ({
      weekday: b.weekday,
      hour: b.hour,
      posts: b.posts,
      averageEngagements: Math.round((b.total / b.posts) * 10) / 10,
    }))
    .sort((a, b) => b.averageEngagements - a.averageEngagements);

  return {
    timezone,
    sampleSize,
    confident: ranked.length > 0,
    buckets: ranked.slice(0, 12),
  };
}
