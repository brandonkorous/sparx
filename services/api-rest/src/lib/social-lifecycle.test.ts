import { describe, expect, it } from 'vitest';

import { postRequiresApproval, readRequireApproval } from './social-lifecycle.js';

// The approval gate defaults ON (docs/133 §15.3): nothing reaches a live brand
// account unreviewed unless a human deliberately turned it off. These two pures
// carry that decision, so pin the default-ON semantics + the precedence order.

describe('readRequireApproval', () => {
  it('defaults ON when the flag is unset', () => {
    expect(readRequireApproval(undefined)).toBe(true);
    expect(readRequireApproval(null)).toBe(true);
    expect(readRequireApproval({})).toBe(true);
    expect(readRequireApproval({ modules: {} })).toBe(true);
    expect(readRequireApproval({ modules: { social: {} } })).toBe(true);
    expect(readRequireApproval({ modules: { social: { enabled: true } } })).toBe(true);
  });

  it('is ON unless explicitly false', () => {
    expect(readRequireApproval({ modules: { social: { requireApproval: true } } })).toBe(true);
    expect(readRequireApproval({ modules: { social: { requireApproval: false } } })).toBe(false);
    // A non-boolean is not "explicitly off" — stays ON.
    expect(readRequireApproval({ modules: { social: { requireApproval: 'no' } } })).toBe(true);
  });

  it('reads the social slot without disturbing sibling modules', () => {
    const settings = {
      modules: { email: { enabled: true }, social: { enabled: true, requireApproval: false } },
    };
    expect(readRequireApproval(settings)).toBe(false);
  });
});

describe('postRequiresApproval', () => {
  it('falls back to the tenant default when the post has no override', () => {
    expect(postRequiresApproval(null, true)).toBe(true);
    expect(postRequiresApproval(null, false)).toBe(false);
    expect(postRequiresApproval({}, true)).toBe(true);
    expect(postRequiresApproval({ source: 'automation' }, false)).toBe(false);
  });

  it('lets an explicit per-post override win over the tenant default', () => {
    // Auto-approving automation: force the gate off even when the tenant requires it.
    expect(postRequiresApproval({ requireApproval: false }, true)).toBe(false);
    // Force review on a one-off even when the tenant default is off.
    expect(postRequiresApproval({ requireApproval: true }, false)).toBe(true);
  });

  it('ignores a non-boolean override and uses the default', () => {
    expect(postRequiresApproval({ requireApproval: 'yes' }, false)).toBe(false);
    expect(postRequiresApproval([1, 2, 3], true)).toBe(true);
  });
});
