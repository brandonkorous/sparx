// Every tool's scope must be one a tenant can actually be granted.
//
// THE BUG THIS EXISTS TO PREVENT. The CMS tools shipped declaring `read:cms` /
// `write:cms`, and api-mcp mapped those scopes to the `cms` module gate — but the
// grantable-scope catalog in @sparx/auth never learned about them. Nothing failed
// loudly: the tools registered fine, `tools/list` advertised them, and typecheck was
// green, because each package declares its own scope union. The only symptom was at
// runtime, per tenant: the API-key dialog renders the catalog, so the scope could
// never be ticked, and OAuth's allowed-scope set derives from the same catalog, so
// authorize rejected it. Both auth paths were dead at once and the entire content
// surface was unreachable — on a platform whose first premise is that content and
// commerce are equally first-class.
//
// A scope that no one can hold is a tool that no one can call, so assert the join.

import { describe, expect, it } from 'vitest';
import { MCP_BUSINESS_SCOPES, grantableScopesForRole } from '@sparx/auth';

import { ALL_MCP_TOOLS } from './tool-registry.js';

describe('MCP tool scopes', () => {
  it('registers at least one tool (guards against an empty registry passing vacuously)', () => {
    expect(ALL_MCP_TOOLS.length).toBeGreaterThan(0);
  });

  it('only declares scopes that exist in the grantable catalog', () => {
    const grantable = new Set<string>(MCP_BUSINESS_SCOPES);
    const orphaned = [
      ...new Set(ALL_MCP_TOOLS.filter((t) => !grantable.has(t.scope)).map((t) => t.scope)),
    ].sort();

    // Named in the failure so the fix is obvious: add them to MCP_SCOPE_CATALOG.
    expect(orphaned, `scopes required by tools but absent from MCP_SCOPE_CATALOG`).toEqual([]);
  });

  it('leaves every catalog scope reachable by some staff role', () => {
    const reachable = new Set<string>([
      ...grantableScopesForRole('owner'),
      ...grantableScopesForRole('admin'),
      ...grantableScopesForRole('editor'),
      ...grantableScopesForRole('viewer'),
    ]);
    const unreachable = MCP_BUSINESS_SCOPES.filter((s) => !reachable.has(s));
    expect(unreachable, 'catalog scopes no role can grant').toEqual([]);
  });

  it('keeps every tool callable by an owner', () => {
    // The broadest role must cover the whole surface; anything it cannot reach is
    // a tool no human can invoke, whatever the catalog says.
    const ownerScopes = new Set<string>(grantableScopesForRole('owner'));
    const unreachable = [
      ...new Set(ALL_MCP_TOOLS.filter((t) => !ownerScopes.has(t.scope)).map((t) => t.name)),
    ].sort();
    expect(unreachable, 'tools an owner cannot call').toEqual([]);
  });

  it('never grants a write scope to a viewer', () => {
    const viewerWrites = grantableScopesForRole('viewer').filter((s) => s.startsWith('write:'));
    expect(viewerWrites).toEqual([]);
  });
});
