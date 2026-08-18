// Locks the SCRIPTED-writer op synthesis (docs/126 §4.5).
//
// These ops are what makes an agent's MCP write fold into a co-editor's open canvas via
// `applyRemoteOps` instead of only on their next reload. Their shapes must match what the
// silicaui reducer expects — a wrong `target` scope or `kind` would be recorded but never
// apply, so the change would silently fail to relay. The reducer keys page-collection and
// theme ops on `{ scope: 'site' }` (they are not tree-node edits), which is the one thing
// most likely to drift, so it is asserted explicitly.

import { describe, expect, it } from 'vitest';

import type { SilicaNode, SilicaTheme } from '@wizeworks/builder-schemas';

import { newOpBatch, pageCreateOp, pageDeleteOp, savedThemesSetOp, themeSetOp } from './silica-ops';

const root = { kind: 'element', tag: 'div' } as unknown as SilicaNode;
const theme = { name: 't', tokens: { '--x': '1' } } as unknown as SilicaTheme;

describe('silica op synthesis', () => {
  it('page.create carries the whole page under the site target', () => {
    const page = { id: 'p1', name: 'Home', slug: '', root };
    expect(pageCreateOp(page)).toEqual({
      target: { scope: 'site' },
      kind: 'page.create',
      page,
    });
  });

  it('page.delete names the page under the site target', () => {
    expect(pageDeleteOp('p2')).toEqual({
      target: { scope: 'site' },
      kind: 'page.delete',
      pageId: 'p2',
    });
  });

  it('theme.set carries the whole theme', () => {
    expect(themeSetOp(theme)).toEqual({ target: { scope: 'site' }, kind: 'theme.set', theme });
  });

  it('savedThemes.set carries the library (including empty to clear it)', () => {
    expect(savedThemesSetOp([])).toEqual({
      target: { scope: 'site' },
      kind: 'savedThemes.set',
      savedThemes: [],
    });
    expect(savedThemesSetOp([theme]).savedThemes).toEqual([theme]);
  });

  it('every synthesized op targets the site scope (not a page/frame/symbol tree)', () => {
    const ops = [
      pageCreateOp({ id: 'p', name: 'n', slug: '', root }),
      pageDeleteOp('p'),
      themeSetOp(theme),
      savedThemesSetOp([]),
    ];
    for (const op of ops) expect(op.target).toEqual({ scope: 'site' });
  });
});

describe('newOpBatch', () => {
  it('mints a unique, mcp-prefixed idempotency key each call', () => {
    const a = newOpBatch();
    const b = newOpBatch();
    expect(a).toMatch(/^mcp-/);
    expect(a).not.toBe(b);
  });
});
