// Social post performance reads (docs/implementation/social.md "Measure"). Read-only over
// social_post_metrics — the snapshots the social-worker writes on a social.metrics.collect
// event. Two shapes drive the Insights surface: one post's numbers per destination (with a
// history for a trend), and a window rollup (per-account totals + the best posts).
//
// Nulls stay nulls in the PER-POST view (a platform that can't report reach must not read
// as 0 reach); in the aggregate rollups a null simply contributes 0 to a sum.

import { withTenant } from '@wizeworks/db';
import type { SocialContext } from './social-context.js';

export interface MetricSnapshot {
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  reach: number | null;
  collectedAt: string;
}

export interface PostTargetMetrics {
  postTargetId: string;
  socialTargetId: string;
  targetName: string;
  platform: string;
  permalink: string | null;
  /** The most recent snapshot (numbers keep climbing for days), or null if never pulled. */
  latest: MetricSnapshot | null;
  /** Oldest → newest, for a trend line. */
  history: MetricSnapshot[];
}

export interface PostMetricsView {
  postId: string;
  targets: PostTargetMetrics[];
}

interface MetricRow {
  postTargetId: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  impressions: number | null;
  reach: number | null;
  collectedAt: Date;
}

function toSnapshot(m: MetricRow): MetricSnapshot {
  return {
    likes: m.likes,
    comments: m.comments,
    shares: m.shares,
    impressions: m.impressions,
    reach: m.reach,
    collectedAt: m.collectedAt.toISOString(),
  };
}

/** Excerpt a post's first line for a compact label. */
function excerpt(body: string): string {
  const first = body.trim().split('\n')[0] ?? '';
  return first.length > 80 ? `${first.slice(0, 79)}…` : first || 'Untitled post';
}

/** One post's per-destination performance, with each destination's snapshot history. */
export async function getPostMetrics(
  ctx: SocialContext,
  postId: string
): Promise<PostMetricsView | null> {
  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const post = await tx.socialPost.findFirst({ where: { id: postId }, select: { id: true } });
    if (!post) return null;

    const [targets, metrics] = await Promise.all([
      tx.socialPostTarget.findMany({
        where: { postId },
        select: {
          id: true,
          socialTargetId: true,
          targetName: true,
          platform: true,
          permalink: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      tx.socialPostMetric.findMany({
        where: { postId },
        orderBy: { collectedAt: 'asc' },
        select: {
          postTargetId: true,
          likes: true,
          comments: true,
          shares: true,
          impressions: true,
          reach: true,
          collectedAt: true,
        },
      }),
    ]);

    const byTarget = new Map<string, MetricSnapshot[]>();
    for (const m of metrics) {
      const list = byTarget.get(m.postTargetId) ?? [];
      list.push(toSnapshot(m));
      byTarget.set(m.postTargetId, list);
    }

    return {
      postId,
      targets: targets.map((t) => {
        const history = byTarget.get(t.id) ?? [];
        return {
          postTargetId: t.id,
          socialTargetId: t.socialTargetId,
          targetName: t.targetName,
          platform: t.platform,
          permalink: t.permalink,
          latest: history.length > 0 ? (history[history.length - 1] ?? null) : null,
          history,
        };
      }),
    };
  });
}

/* ── Window rollup ────────────────────────────────────────────────────────── */

export interface InsightsAccount {
  socialTargetId: string;
  name: string;
  platform: string;
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
}

export interface InsightsTopPost {
  postId: string;
  postTargetId: string;
  excerpt: string;
  publishedAt: string | null;
  platform: string;
  targetName: string;
  permalink: string | null;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  engagements: number;
}

export interface SocialInsightsView {
  windowDays: number;
  totals: { posts: number; engagements: number; reach: number; impressions: number };
  accounts: InsightsAccount[];
  topPosts: InsightsTopPost[];
}

interface LatestMetric {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
}

const ZERO: LatestMetric = { likes: 0, comments: 0, shares: 0, impressions: 0, reach: 0 };

/** Per-account totals + top posts over the last `windowDays`. Aggregates the LATEST
 *  snapshot of each published destination (a post's numbers as they stand now). */
export async function getSocialInsights(
  ctx: SocialContext,
  windowDays: number
): Promise<SocialInsightsView> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  return withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const posts = await tx.socialPost.findMany({
      where: { publishedAt: { gte: since } },
      select: {
        id: true,
        body: true,
        publishedAt: true,
        targets: {
          select: {
            id: true,
            socialTargetId: true,
            targetName: true,
            platform: true,
            permalink: true,
            status: true,
          },
        },
      },
    });

    const postTargetIds = posts.flatMap((p) => p.targets.map((t) => t.id));
    const metrics =
      postTargetIds.length > 0
        ? await tx.socialPostMetric.findMany({
            where: { postTargetId: { in: postTargetIds } },
            orderBy: { collectedAt: 'desc' },
            select: {
              postTargetId: true,
              likes: true,
              comments: true,
              shares: true,
              impressions: true,
              reach: true,
            },
          })
        : [];

    // Desc order → the first row seen per target is its newest snapshot.
    const latest = new Map<string, LatestMetric>();
    for (const m of metrics) {
      if (latest.has(m.postTargetId)) continue;
      latest.set(m.postTargetId, {
        likes: m.likes ?? 0,
        comments: m.comments ?? 0,
        shares: m.shares ?? 0,
        impressions: m.impressions ?? 0,
        reach: m.reach ?? 0,
      });
    }

    const accounts = new Map<string, InsightsAccount>();
    const topPosts: InsightsTopPost[] = [];
    let totalEngagements = 0;
    let totalReach = 0;
    let totalImpressions = 0;

    for (const p of posts) {
      for (const t of p.targets) {
        if (t.status !== 'published') continue;
        const m = latest.get(t.id) ?? ZERO;
        const engagements = m.likes + m.comments + m.shares;
        totalEngagements += engagements;
        totalReach += m.reach;
        totalImpressions += m.impressions;

        const acc = accounts.get(t.socialTargetId) ?? {
          socialTargetId: t.socialTargetId,
          name: t.targetName,
          platform: t.platform,
          posts: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          impressions: 0,
          reach: 0,
        };
        acc.posts += 1;
        acc.likes += m.likes;
        acc.comments += m.comments;
        acc.shares += m.shares;
        acc.impressions += m.impressions;
        acc.reach += m.reach;
        accounts.set(t.socialTargetId, acc);

        topPosts.push({
          postId: p.id,
          postTargetId: t.id,
          excerpt: excerpt(p.body),
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
          platform: t.platform,
          targetName: t.targetName,
          permalink: t.permalink,
          ...m,
          engagements,
        });
      }
    }

    topPosts.sort((a, b) => b.engagements - a.engagements);

    return {
      windowDays,
      totals: {
        posts: posts.length,
        engagements: totalEngagements,
        reach: totalReach,
        impressions: totalImpressions,
      },
      accounts: [...accounts.values()].sort(
        (a, b) => b.likes + b.comments + b.shares - (a.likes + a.comments + a.shares)
      ),
      topPosts: topPosts.slice(0, 10),
    };
  });
}
