// tools/list offers only the tools this connection can actually run (sparx
// persona issue 212). A read-only key's client was offered every write tool,
// then refused each one it tried with "forbidden: requires scope …", and the
// same for a module the tenant has not turned on.

import { describe, expect, it } from 'vitest';

import { toolsToList } from './tool-listing.js';

const tool = (name: string, scope: string) => ({ name, scope });
const tools = [
  tool('get_products', 'read:commerce'),
  tool('update_product', 'write:commerce'),
  tool('list_bookings', 'read:scheduling'),
  tool('search_all', 'read:search'),
];
const moduleOf = (scope: string) =>
  scope.endsWith(':scheduling')
    ? 'scheduling'
    : scope.endsWith(':commerce')
      ? 'commerce'
      : undefined;

describe('toolsToList', () => {
  it('leaves out a tool whose scope the key was not granted', () => {
    const listed = toolsToList(tools, {
      scopes: new Set(['read:commerce', 'read:scheduling', 'read:search']),
      disabled: new Set(),
      activeModules: new Set(['commerce', 'scheduling']),
      moduleOf,
    });
    expect(listed.map((t) => t.name)).toEqual(['get_products', 'list_bookings', 'search_all']);
  });

  it('leaves out a tool for a module the tenant has not turned on', () => {
    const listed = toolsToList(tools, {
      scopes: new Set(['read:commerce', 'write:commerce', 'read:scheduling', 'read:search']),
      disabled: new Set(),
      activeModules: new Set(['commerce']),
      moduleOf,
    });
    expect(listed.map((t) => t.name)).toEqual(['get_products', 'update_product', 'search_all']);
  });

  it('leaves out a tool the tenant switched off', () => {
    const listed = toolsToList(tools, {
      scopes: new Set(['read:commerce', 'write:commerce', 'read:scheduling', 'read:search']),
      disabled: new Set(['update_product']),
      activeModules: new Set(['commerce', 'scheduling']),
      moduleOf,
    });
    expect(listed.map((t) => t.name)).toEqual(['get_products', 'list_bookings', 'search_all']);
  });
});

describe('the server', () => {
  it('registers through toolsToList, not every tool', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const server = readFileSync(fileURLToPath(new URL('./server.ts', import.meta.url)), 'utf8');
    expect(server).toMatch(/for \(const tool of toolsToList\(ALL_MCP_TOOLS,/);
  });
});
