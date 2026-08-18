// A Segment spans the tenant; a Customer belongs to a site. `audienceScope` is the
// predicate that keeps a multi-site tenant's Site A campaign from mailing Site B's
// customers — the failure mode that looks fine in every code path and only shows up in
// someone's inbox. Locked down here because both the send and the audience estimate
// depend on it agreeing with the CRM customer list.

import { describe, expect, it } from 'vitest';

import { audienceScope } from '../src/services/audience-scope';

describe('audienceScope', () => {
  it('does not filter a tenant-wide broadcast (every single-site tenant)', () => {
    expect(audienceScope(null)).toEqual({});
  });

  it('scopes a site-bound broadcast to that site plus the unattributed customers', () => {
    // The SAME predicate the CRM customer list applies, so "who this site shows me"
    // and "who this site's broadcast reaches" can never disagree.
    expect(audienceScope('site-a')).toEqual({
      customer: { OR: [{ propertyId: null }, { propertyId: 'site-a' }] },
    });
  });

  it('never matches another site — the whole point', () => {
    const scope = audienceScope('site-a');
    const ors = scope.customer && 'OR' in scope.customer ? scope.customer.OR : undefined;
    const ids = (ors as { propertyId: string | null }[]).map((o) => o.propertyId);
    expect(ids).not.toContain('site-b');
  });
});
