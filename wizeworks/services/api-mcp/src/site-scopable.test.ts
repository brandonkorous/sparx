// The site-scopable allowlist must name tools that actually exist.
//
// THE BUG THIS EXISTS TO PREVENT. `SITE_SCOPABLE_TOOL_NAMES` is derived from the
// sitebuilder / builder / media tool arrays, which cannot go stale — rename a
// tool there and the derived set renames with it. The commerce REPORT entries
// are different: they are listed BY NAME, because only commerce's reporting half
// is site-aware and adding the whole array would falsely declare products, carts
// and fitment scopable too.
//
// A by-name list is exactly the thing that rots silently. Rename
// `get_conversion_funnel` and nothing fails: typecheck is green (it is a string),
// the server boots, `tools/list` is unchanged, and the only symptom is that a
// site-scoped credential starts REFUSING a report that would have worked. That is
// the safe direction to fail in, which is precisely why nobody would notice.
//
// So assert the join in both directions: every name is real, and the list is not
// empty (an empty list would pass every "is it real" check vacuously).

import { describe, expect, it } from 'vitest';
import { commerceMcpTools } from '@wizeworks/commerce';

import {
  ALL_MCP_TOOLS,
  isSiteScopableTool,
  SITE_SCOPABLE_COMMERCE_REPORTS,
} from './tool-registry.js';

describe('site-scopable commerce reports', () => {
  it('names at least one report (an empty list would pass everything below vacuously)', () => {
    expect(SITE_SCOPABLE_COMMERCE_REPORTS.length).toBeGreaterThan(0);
  });

  it('names only tools that exist in the commerce registry', () => {
    const commerceNames = new Set(
      (commerceMcpTools as unknown as { name: string }[]).map((t) => t.name)
    );
    const missing = SITE_SCOPABLE_COMMERCE_REPORTS.filter((n) => !commerceNames.has(n));
    expect(missing).toEqual([]);
  });

  it('marks each of them site-scopable through the public predicate', () => {
    for (const name of SITE_SCOPABLE_COMMERCE_REPORTS) {
      expect(isSiteScopableTool(name)).toBe(true);
    }
  });

  it('leaves the rest of commerce refused under a site-scoped credential', () => {
    // Not an exhaustive claim about commerce — a guard that the allowlist did not
    // quietly become "all of commerce", which is the failure that would hand a
    // site key another business's catalog instead of a refusal.
    const listed = new Set<string>(SITE_SCOPABLE_COMMERCE_REPORTS);
    const unlisted = (commerceMcpTools as unknown as { name: string }[])
      .map((t) => t.name)
      .filter((n) => !listed.has(n));
    expect(unlisted.length).toBeGreaterThan(0);
    for (const name of unlisted) expect(isSiteScopableTool(name)).toBe(false);
  });

  it('keeps every listed report registered on the server', () => {
    const registered = new Set(ALL_MCP_TOOLS.map((t) => t.name));
    const unregistered = SITE_SCOPABLE_COMMERCE_REPORTS.filter((n) => !registered.has(n));
    expect(unregistered).toEqual([]);
  });
});
