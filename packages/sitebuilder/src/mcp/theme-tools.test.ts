// The saved-theme (custom theme) MCP surface: the tools an agent needs to give a
// site a first-class named theme instead of a bare preset with overrides. Pins the
// tool names, scopes, and confirmation gating (delete is destructive).

import { describe, expect, it } from 'vitest';

import { sitebuilderMcpTools } from './index';

describe('saved-theme MCP tools', () => {
  it('exposes the custom-theme authoring surface', () => {
    const names = sitebuilderMcpTools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_saved_themes',
        'create_saved_theme',
        'update_saved_theme',
        'apply_saved_theme',
        'delete_saved_theme',
      ])
    );
  });

  it('scopes the reader to read:builder and the writers to write:builder', () => {
    const byName = new Map(sitebuilderMcpTools.map((t) => [t.name, t]));
    expect(byName.get('list_saved_themes')?.scope).toBe('read:builder');
    expect(byName.get('create_saved_theme')?.scope).toBe('write:builder');
    expect(byName.get('update_saved_theme')?.scope).toBe('write:builder');
    expect(byName.get('apply_saved_theme')?.scope).toBe('write:builder');
    expect(byName.get('delete_saved_theme')?.scope).toBe('write:builder');
  });

  it('gates delete behind confirmation, leaves authoring/apply un-gated', () => {
    const byName = new Map(sitebuilderMcpTools.map((t) => [t.name, t]));
    expect(byName.get('delete_saved_theme')?.confirmation).toBe(true);
    expect(byName.get('create_saved_theme')?.confirmation).toBe(false);
    expect(byName.get('apply_saved_theme')?.confirmation).toBe(false);
  });
});
