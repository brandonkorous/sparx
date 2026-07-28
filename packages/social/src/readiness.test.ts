import { describe, expect, it } from 'vitest';

import { judgeSocialReadiness, type ReadinessInput } from './readiness.js';
import type { SocialAccessProbe } from './types.js';

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    status: 'active',
    required: ['pages_manage_posts', 'pages_read_engagement'],
    granted: ['pages_manage_posts', 'pages_read_engagement'],
    grantedSource: 'platform',
    probe: null,
    platformName: 'Facebook Page',
    ...over,
  };
}

const pending: SocialAccessProbe = {
  grantedScopes: null,
  appReview: 'pending',
  detail: 'TikTok will only accept private posts from this account right now.',
};

describe('judgeSocialReadiness', () => {
  it('is ready when the grant holds everything asked for', () => {
    const v = judgeSocialReadiness(input());
    expect(v.verdict).toBe('ready');
    expect(v.missing).toEqual([]);
  });

  it('names exactly what is missing, so the answer is actionable', () => {
    const v = judgeSocialReadiness(input({ granted: ['pages_manage_posts'] }));
    expect(v.verdict).toBe('permissions_missing');
    expect(v.missing).toEqual(['pages_read_engagement']);
    expect(v.headline).toBe('Missing 1 permission');
  });

  it('offers BOTH causes for a missing permission rather than guessing one', () => {
    const v = judgeSocialReadiness(input({ granted: [] }));
    // A missing scope is either an unapproved app or a token predating the scope, and
    // asserting either one alone sends someone down the wrong path for weeks.
    expect(v.detail).toMatch(/has not approved/i);
    expect(v.detail).toMatch(/connected before/i);
  });

  // Precedence matters more than any individual verdict: a revoked account reported as
  // "waiting on the platform" is someone waiting on Meta for a problem Meta cannot fix.
  it('puts a dead connection ahead of every permission question', () => {
    const v = judgeSocialReadiness(input({ status: 'expired', granted: [], probe: pending }));
    expect(v.verdict).toBe('reconnect_required');
  });

  it('puts a platform still reviewing ahead of the scope diff', () => {
    const v = judgeSocialReadiness(input({ granted: [], probe: pending }));
    expect(v.verdict).toBe('awaiting_review');
    expect(v.detail).toBe(pending.detail);
  });

  it('says so plainly when the platform reports nothing, instead of passing it as ready', () => {
    const v = judgeSocialReadiness(input({ granted: [], required: [], grantedSource: 'none' }));
    expect(v.verdict).toBe('unverifiable');
    expect(v.detail).toMatch(/publishing a post/i);
  });

  it('distinguishes a live confirmation from a recollection', () => {
    expect(judgeSocialReadiness(input({ grantedSource: 'platform' })).detail).toMatch(/confirms/i);
    expect(judgeSocialReadiness(input({ grantedSource: 'stored' })).detail).toMatch(
      /when it was connected/i
    );
  });

  // Seen live on 2026-07-28: a green "Ready" sitting directly above an amber "this result
  // cannot be trusted". Every permission really was present, so nothing else fired — and
  // the badge is what gets scanned, so it must not promise what the caveat withdraws.
  it('refuses to call a caveated result ready, even with every permission present', () => {
    const v = judgeSocialReadiness(
      input({
        probe: {
          grantedScopes: ['pages_manage_posts', 'pages_read_engagement'],
          appReview: 'unknown',
          detail: 'Meta reports 2 permissions on this connection.',
          caveat: 'This account has a role on the sparx developer app.',
        },
      })
    );
    expect(v.verdict).toBe('unverifiable');
    expect(v.headline).toBe('Cannot be confirmed');
  });

  it('still reports a clean, uncaveated grant as ready', () => {
    const v = judgeSocialReadiness(
      input({
        probe: {
          grantedScopes: null,
          appReview: 'unknown',
          detail: 'Meta reports 2 permissions on this connection.',
        },
      })
    );
    expect(v.verdict).toBe('ready');
  });

  it('does not treat an extra granted permission as a problem', () => {
    const v = judgeSocialReadiness(input({ granted: [...input().granted, 'business_management'] }));
    expect(v.verdict).toBe('ready');
  });
});
