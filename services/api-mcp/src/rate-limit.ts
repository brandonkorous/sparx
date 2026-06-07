// Per-tenant rate limits for the MCP transport (abuse prevention).
//
// Sparx is MODULE-based, not plan-tiered: a tenant pays per module, not for a
// Starter/Pro/Enterprise plan. So MCP ELIGIBILITY is gated by the `ai` module
// (see auth.ts), NOT by a plan. This limiter is purely a safety cap against
// runaway loops / scrapers — one flat per-tenant quota for every MCP-eligible
// tenant, plus a tighter cap on write `tools/call`s to blunt bulk-action
// mistakes. (Earlier this read `tenant.plan` and rejected "starter" outright —
// a vestige of docs/07 §7's pre-module plan model; removed.)
//
// Phase 1 implementation uses in-process token buckets. The api-mcp HPA is
// capped at 2 replicas, so cross-pod drift is small and acceptable. Redis-backed
// counters land when we exceed one replica's throughput; the bucket API is
// shaped so the storage can swap without touching the policy.

import type { McpAuthContext } from './auth.js';

export interface Quota {
  perMinute: number;
  perDay: number;
}

// One flat quota for every MCP-eligible (AI-module) tenant. Tune here — there
// are no per-tenant tiers to thread through.
const MCP_QUOTA: Quota = { perMinute: 60, perDay: 5_000 };
const WRITE_PER_MINUTE = 10;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

interface Bucket {
  count: number;
  resetAt: number;
}

interface TenantBuckets {
  minute: Bucket;
  day: Bucket;
  writeMinute: Bucket;
}

const buckets = new Map<string, TenantBuckets>();

function freshBucket(windowMs: number, now: number): Bucket {
  return { count: 0, resetAt: now + windowMs };
}

function getOrCreate(tenantId: string, now: number): TenantBuckets {
  let b = buckets.get(tenantId);
  if (!b) {
    b = {
      minute: freshBucket(MS_PER_MINUTE, now),
      day: freshBucket(MS_PER_DAY, now),
      writeMinute: freshBucket(MS_PER_MINUTE, now),
    };
    buckets.set(tenantId, b);
    return b;
  }
  if (now >= b.minute.resetAt) b.minute = freshBucket(MS_PER_MINUTE, now);
  if (now >= b.day.resetAt) b.day = freshBucket(MS_PER_DAY, now);
  if (now >= b.writeMinute.resetAt) b.writeMinute = freshBucket(MS_PER_MINUTE, now);
  return b;
}

export class RateLimitError extends Error {
  readonly code = 'RATE_LIMITED' as const;
  readonly retryAfterSeconds: number;
  readonly limit: number;
  readonly window: 'minute' | 'day';
  readonly scope: 'tenant' | 'tenant_writes';
  constructor(
    message: string,
    opts: {
      retryAfterSeconds: number;
      limit: number;
      window: 'minute' | 'day';
      scope: RateLimitError['scope'];
    }
  ) {
    super(message);
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.limit = opts.limit;
    this.window = opts.window;
    this.scope = opts.scope;
  }
}

interface EnforceArgs {
  auth: McpAuthContext;
  /** True when this HTTP call is a tools/call dispatching a write-scope tool.
   *  Determined by the route handler using the request body + the tool
   *  registry. */
  isWriteCall: boolean;
}

/** Consume one slot for the tenant — and additionally one write slot when the
 *  dispatched tool is a write — or throw RateLimitError. Eligibility (the `ai`
 *  module) is enforced upstream in auth.ts; this is only the abuse cap. */
export function enforceRateLimit(args: EnforceArgs): void {
  const now = Date.now();
  const t = getOrCreate(args.auth.tenantId, now);

  if (t.minute.count >= MCP_QUOTA.perMinute) {
    throw new RateLimitError(`Rate limit exceeded: ${MCP_QUOTA.perMinute} requests/minute.`, {
      retryAfterSeconds: Math.max(1, Math.ceil((t.minute.resetAt - now) / 1000)),
      limit: MCP_QUOTA.perMinute,
      window: 'minute',
      scope: 'tenant',
    });
  }
  if (t.day.count >= MCP_QUOTA.perDay) {
    throw new RateLimitError(`Daily quota exceeded: ${MCP_QUOTA.perDay} requests/day.`, {
      retryAfterSeconds: Math.max(1, Math.ceil((t.day.resetAt - now) / 1000)),
      limit: MCP_QUOTA.perDay,
      window: 'day',
      scope: 'tenant',
    });
  }
  if (args.isWriteCall && t.writeMinute.count >= WRITE_PER_MINUTE) {
    throw new RateLimitError(`Write rate limit exceeded: ${WRITE_PER_MINUTE} write calls/minute.`, {
      retryAfterSeconds: Math.max(1, Math.ceil((t.writeMinute.resetAt - now) / 1000)),
      limit: WRITE_PER_MINUTE,
      window: 'minute',
      scope: 'tenant_writes',
    });
  }

  t.minute.count += 1;
  t.day.count += 1;
  if (args.isWriteCall) t.writeMinute.count += 1;
}

/** Test-only — clears in-memory buckets between cases. */
export function __resetRateLimitState(): void {
  buckets.clear();
}
