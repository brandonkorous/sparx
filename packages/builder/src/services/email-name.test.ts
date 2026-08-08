// Two mechanisms write a tenant's emails and neither knows about the other:
// `provisionDefaultEmails` writes the keyed platform set, and a blueprint install writes
// its own property-scoped copies. Both legitimately ship a "Welcome". The switcher is one
// flat list of NAMES, so a tenant that installed a single blueprint had two rows reading
// "Welcome" and no way to tell which one an automation actually sends. Found by opening
// the switcher in production on a tenant that had FOUR.

import { describe, expect, it } from 'vitest';

import { nextFreeName } from './email-service';

describe('nextFreeName', () => {
  it('leaves a name alone when nothing has claimed it', () => {
    expect(nextFreeName(new Set(['Welcome']), 'Win-back', 'Coastal Studio')).toBe('Win-back');
  });

  it('says where the row came from rather than counting', () => {
    // The author's real question is "which one is this?", which is the question "where
    // did it come from?". `Welcome 2` answers neither.
    expect(nextFreeName(new Set(['Welcome']), 'Welcome', 'Coastal Studio')).toBe(
      'Welcome (Coastal Studio)'
    );
  });

  it('counts only when the SAME blueprint is installed twice', () => {
    const taken = new Set(['Welcome', 'Welcome (Coastal Studio)']);
    expect(nextFreeName(taken, 'Welcome', 'Coastal Studio')).toBe('Welcome (Coastal Studio 2)');
  });

  it('falls back to a bare counter when there is no blueprint to name', () => {
    expect(nextFreeName(new Set(['Welcome']), 'Welcome')).toBe('Welcome 2');
    expect(nextFreeName(new Set(['Welcome', 'Welcome 2']), 'Welcome')).toBe('Welcome 3');
  });

  it('keeps the result inside the name column', () => {
    // `CreateEmailInput` caps `name` at 255; a long blueprint name must clamp rather than
    // fail the insert and take the whole install down with it.
    const desired = 'W'.repeat(240);
    const out = nextFreeName(new Set([desired]), desired, 'A Very Long Blueprint Name Indeed');
    expect(out.length).toBeLessThanOrEqual(255);
    expect(out).not.toBe(desired);
  });

  it('never returns a name that was already taken', () => {
    // The property that actually matters, asserted over a crowded tenant rather than a
    // single collision.
    const taken = new Set(['Welcome', 'Welcome (Studio)', 'Welcome (Studio 2)', 'Welcome 2']);
    const out = nextFreeName(taken, 'Welcome', 'Studio');
    expect(taken.has(out)).toBe(false);
  });

  it('does not leave a trailing space when a clamp lands mid-suffix', () => {
    const desired = 'W'.repeat(250);
    const out = nextFreeName(new Set([desired]), desired, 'Studio');
    expect(out).toBe(out.trimEnd());
  });
});
