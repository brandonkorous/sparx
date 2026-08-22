// Connection readiness — "can this connected account actually do everything sparx is
// going to ask of it?" (docs/social-audit).
//
// This exists because every one of these platforms ships its API in two tiers. A newly
// registered app can call a permission only for accounts that hold a role on the
// developer app; using it on a real tenant's Page, profile or channel needs the platform
// to approve the app first — Meta's App Review, TikTok's audit, Pinterest's standard
// access. None of them expose that approval as an API. So the only honest test is to
// look at what a LIVE grant holds and compare it to what the adapter asks for.
//
// Two sources, in order of trust:
//   1. {@link SocialAdapter.probeAccess} — the platform, asked right now. Beats anything
//      stored: a person can strip one permission from their account settings weeks after
//      connecting, and nothing in sparx would know.
//   2. `social_connections.scopes` — what the platform reported at connect time.
//
// A platform that reports neither is `unverifiable`, and says so. That is a real answer
// and a much better one than a green tick that means "we never checked".

import { withTenant } from '@wizeworks/db';

import type { SocialAccessProbe, SocialPlatform } from './types.js';
import type { SocialContext } from './context.js';
import { getSocialAdapter } from './registry.js';
import { decryptSocialToken } from './crypto.js';
import { paramsFromSocialMetadata } from './metadata.js';

/** What the tenant should DO about this connection. */
export type SocialReadinessVerdict =
  /** Everything sparx needs, confirmed. */
  | 'ready'
  /** The grant is missing permissions sparx asks for — reconnect, or the platform withheld them. */
  | 'permissions_missing'
  /** The platform is still holding sparx's app to its unapproved limits. */
  | 'awaiting_review'
  /** The connection itself is expired or revoked; nothing else matters until it's fixed. */
  | 'reconnect_required'
  /** The platform tells us nothing about permissions, so a real post is the only proof. */
  | 'unverifiable';

export interface SocialConnectionReadiness {
  connectionId: string;
  platform: string;
  displayName: string | null;
  /** The connection row's own status (active / expired / revoked). */
  status: string;
  verdict: SocialReadinessVerdict;
  /** One line, written for someone who has never heard the phrase "Advanced Access". */
  headline: string;
  detail: string;
  /** Set when something about THIS account makes the result unrepresentative — most
   *  often that it holds a role on sparx's own developer app. */
  caveat: string | null;
  required: string[];
  granted: string[];
  missing: string[];
  /** Where `granted` came from, so the UI can say "checked just now" vs "recorded when
   *  you connected" rather than implying both are equally fresh. */
  grantedSource: 'platform' | 'stored' | 'none';
  checkedAt: string;
}

interface ReadinessRow {
  id: string;
  platform: string;
  status: string;
  displayName: string | null;
  externalId: string | null;
  accessTokenEnc: string | null;
  scopes: string[];
  metadata: unknown;
}

/** Ask the adapter what the platform says about this grant. Never throws — a platform
 *  outage must degrade the answer to "could not check", not fail the whole page. */
async function probe(row: ReadinessRow): Promise<SocialAccessProbe | null> {
  const adapter = getSocialAdapter(row.platform as SocialPlatform);
  if (!adapter?.probeAccess || !row.accessTokenEnc) return null;
  try {
    return await adapter.probeAccess({
      externalId: row.externalId ?? '',
      accessToken: decryptSocialToken(row.accessTokenEnc),
      params: paramsFromSocialMetadata(row.metadata),
    });
  } catch {
    return null;
  }
}

export interface ReadinessInput {
  /** The connection row's own status (active / expired / revoked). */
  status: string;
  required: string[];
  granted: string[];
  grantedSource: SocialConnectionReadiness['grantedSource'];
  probe: SocialAccessProbe | null;
  platformName: string;
}

/** Resolve one connection into a verdict + the plain sentence that goes with it. Pure and
 *  exported so the precedence between "dead grant", "platform still reviewing" and
 *  "missing permissions" is unit-tested — getting that order wrong is how a revoked
 *  account gets reported as a review problem and someone waits on Meta for nothing. */
export function judgeSocialReadiness({
  status,
  required,
  granted,
  grantedSource,
  probe: accessProbe,
  platformName,
}: ReadinessInput): Pick<SocialConnectionReadiness, 'verdict' | 'headline' | 'detail' | 'missing'> {
  const missing = required.filter((s) => !granted.includes(s));

  // A dead grant outranks everything: no permission question is worth answering about a
  // connection that cannot make a call at all.
  if (status !== 'active') {
    return {
      verdict: 'reconnect_required',
      headline: 'Needs reconnecting',
      detail: `This ${platformName} connection is ${status}. Reconnect the account before reading anything else here.`,
      missing,
    };
  }

  if (accessProbe?.appReview === 'pending') {
    return {
      verdict: 'awaiting_review',
      headline: 'Waiting on the platform',
      detail: accessProbe.detail,
      missing,
    };
  }

  if (missing.length > 0) {
    return {
      verdict: 'permissions_missing',
      headline: `Missing ${missing.length} permission${missing.length === 1 ? '' : 's'}`,
      detail:
        `${platformName} has not given this connection: ${missing.join(', ')}. ` +
        'Either the platform has not approved sparx for them yet, or this account was connected before they were added — reconnecting the account will tell you which.',
      missing,
    };
  }

  if (grantedSource === 'none') {
    return {
      verdict: 'unverifiable',
      headline: 'Cannot be checked from here',
      detail: `${platformName} does not report which permissions a connection holds, so the only real proof is publishing a post to it.`,
      missing,
    };
  }

  // A caveat means the platform's answer does not generalise — most often that this
  // account holds a role on sparx's own developer app and was therefore handed every
  // permission regardless of review. The permissions really are all present, so nothing
  // above fired, and calling that "Ready" in green is precisely the false confidence this
  // check exists to prevent: the badge is what gets scanned, and it must not promise
  // something the caveat underneath immediately withdraws.
  if (accessProbe?.caveat) {
    return {
      verdict: 'unverifiable',
      headline: 'Cannot be confirmed',
      detail: `${accessProbe.detail} That is not proof of anything on its own — see below.`,
      missing,
    };
  }

  return {
    verdict: 'ready',
    headline: 'Ready',
    detail:
      grantedSource === 'platform'
        ? `${platformName} confirms this connection holds everything needed.`
        : `This connection was granted everything needed when it was connected.`,
    missing,
  };
}

async function readinessFor(
  row: ReadinessRow,
  checkedAt: string
): Promise<SocialConnectionReadiness> {
  const adapter = getSocialAdapter(row.platform as SocialPlatform);
  const platformName = adapter?.name ?? row.platform;
  const required = adapter?.requiredScopes() ?? [];
  const accessProbe = await probe(row);

  const live = accessProbe?.grantedScopes ?? null;
  const granted = live ?? row.scopes;
  const grantedSource: SocialConnectionReadiness['grantedSource'] = live
    ? 'platform'
    : row.scopes.length > 0
      ? 'stored'
      : 'none';

  return {
    connectionId: row.id,
    platform: row.platform,
    displayName: row.displayName,
    status: row.status,
    ...judgeSocialReadiness({
      status: row.status,
      required,
      granted,
      grantedSource,
      probe: accessProbe,
      platformName,
    }),
    caveat: accessProbe?.caveat ?? null,
    required,
    granted,
    grantedSource,
    checkedAt,
  };
}

/**
 * Readiness for every connected account on a site (or the whole tenant when
 * `propertyId` is null), newest problem first so the one thing needing attention is at
 * the top rather than buried under the healthy ones.
 *
 * Runs the platform probes concurrently: this is a page load, and eight sequential
 * round-trips to eight different companies is a page nobody waits for.
 */
export async function checkSocialReadiness(
  ctx: SocialContext,
  propertyId: string | null = null
): Promise<SocialConnectionReadiness[]> {
  const rows = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialConnection.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        platform: true,
        status: true,
        displayName: true,
        externalId: true,
        accessTokenEnc: true,
        scopes: true,
        metadata: true,
      },
    })
  );

  const checkedAt = new Date().toISOString();
  const results = await Promise.all(rows.map((r) => readinessFor(r, checkedAt)));

  const RANK: Record<SocialReadinessVerdict, number> = {
    reconnect_required: 0,
    awaiting_review: 1,
    permissions_missing: 2,
    unverifiable: 3,
    ready: 4,
  };
  return results.sort((a, b) => RANK[a.verdict] - RANK[b.verdict]);
}

/** Readiness for one connection. Same check as {@link checkSocialReadiness}, for the
 *  detail view and the `check_social_connection` MCP tool. */
export async function checkSocialConnectionReadiness(
  ctx: SocialContext,
  connectionId: string
): Promise<SocialConnectionReadiness | null> {
  const row = await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.socialConnection.findFirst({
      where: { id: connectionId, tenantId: ctx.tenantId },
      select: {
        id: true,
        platform: true,
        status: true,
        displayName: true,
        externalId: true,
        accessTokenEnc: true,
        scopes: true,
        metadata: true,
      },
    })
  );
  if (!row) return null;
  return readinessFor(row, new Date().toISOString());
}
