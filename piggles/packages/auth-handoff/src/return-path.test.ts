// Where somebody lands after signing in, when the link may spell it either way.
//
// The defect these pin: the invitation page's buttons write `callbackURL`, the
// account app's sign-in page read `next`, and nothing anywhere reconciled them.
// So "Sign in to join" signed the person in and did not join them, and "I'm
// new: create an account" put them through setting up a business of their own.
// Neither failed. Both landed somewhere plausible with the invitation quietly
// gone (issue 881).
//
// Every case below is written so the WRONG implementation fails it:
//   · reading only `next`          → the callbackURL cases go red
//   · reading only `callbackURL`   → the next cases go red
//   · preferring callbackURL       → the "both present" case goes red
//   · skipping safeInternalPath    → the open-redirect cases go red
//   · throwing instead of falling back → the tampered cases go red

import { describe, expect, it } from 'vitest';
import { returnPath } from './origins';

describe('returnPath - the destination survives the sign-in', () => {
  it('reads the spelling this product writes', () => {
    expect(returnPath({ next: '/account' })).toBe('/account');
  });

  it('reads the spelling Better Auth and the console write', () => {
    // The exact link the invitation page builds.
    expect(returnPath({ callbackURL: '/accept-invite?invitation=abc' })).toBe(
      '/accept-invite?invitation=abc'
    );
  });

  it('prefers our own spelling when a link carries both', () => {
    // A URL holding both was built by us around one built by somebody else, so
    // ours is the outer intent.
    expect(returnPath({ next: '/ours', callbackURL: '/theirs' })).toBe('/ours');
  });

  it('falls through to the other spelling when ours is present but empty', () => {
    // `?next=&callbackURL=/x` is what a half-built link looks like. An empty
    // string is not an answer, so it must not shadow the real one.
    expect(returnPath({ next: '', callbackURL: '/accept-invite?invitation=abc' })).toBe(
      '/accept-invite?invitation=abc'
    );
  });

  it('lands on the fallback when the link says nothing', () => {
    expect(returnPath({})).toBe('/');
    // Signup passes its own: an ordinary new customer still goes to setup.
    expect(returnPath({}, '/onboarding')).toBe('/onboarding');
  });

  it('refuses to send anyone to another site', () => {
    // This value becomes a redirect and arrives in a URL anybody can edit. A
    // page that looks like getpiggles.com and lands elsewhere is the shape a
    // phishing link wants most.
    expect(returnPath({ next: 'https://evil.example/steal' })).toBe('/');
    expect(returnPath({ callbackURL: '//evil.example/steal' })).toBe('/');
    expect(returnPath({ next: '/\\evil.example' })).toBe('/');
  });

  it('still signs a tampered link in, rather than failing', () => {
    // Falling back, never throwing: somebody who followed a mangled link should
    // end up signed in on the home page, not looking at an error.
    expect(returnPath({ callbackURL: 'javascript:alert(1)' }, '/onboarding')).toBe('/onboarding');
  });

  it('takes the first value when a parameter is repeated', () => {
    // `?next=/a&next=/b` arrives as an array. Picking the last one would let an
    // appended parameter override the one the link was built with.
    expect(returnPath({ next: ['/first', '/second'] })).toBe('/first');
  });
});
