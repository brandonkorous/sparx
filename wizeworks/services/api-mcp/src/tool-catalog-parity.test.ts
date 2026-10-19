// Every tool this server publishes is one the owner can switch off.
//
// The Permissions screen reads api-rest's TOOL_CATALOG, which projects the same
// tool arrays this server registers plus a hand mirror of the tools defined here.
// Its comment promised "no parallel hardcoded list", and it had quietly lost
// media, content, social, wholesale and campaign tools and every api-mcp-local
// one: about a hundred tools an AI app could call that the owner could not block
// (sparx persona issue 297). This compares the two name lists, both ways.

import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG } from '../../api-rest/src/lib/ai/tool-catalog.js';
import { ALL_MCP_TOOLS } from './tool-registry.js';

describe('the Permissions catalog and the published tools', () => {
  const published = new Set(ALL_MCP_TOOLS.map((t) => t.name));
  const catalog = new Set(TOOL_CATALOG.map((t) => t.name));

  it('lists every tool this server publishes', () => {
    expect([...published].filter((name) => !catalog.has(name))).toEqual([]);
  });

  it('lists no tool this server does not publish', () => {
    expect([...catalog].filter((name) => !published.has(name))).toEqual([]);
  });

  it('gives each tool the scope it is published with', () => {
    const scopes = new Map(ALL_MCP_TOOLS.map((t) => [t.name, t.scope]));
    expect(TOOL_CATALOG.filter((t) => scopes.get(t.name) !== t.scope).map((t) => t.name)).toEqual(
      []
    );
  });
});
