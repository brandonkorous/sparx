import { describe, it, expect } from 'vitest';
import { BuilderNodeSchema } from '../node';
import {
  PLATFORM_CATALOG,
  CATALOG_CATEGORIES,
  catalogForSurface,
  catalogGroupsForSurface,
  findCatalogEntry,
} from './index';

const KEY_RE = /^[a-z][a-z0-9_]*$/;

function collectIds(node: { id: string; children?: unknown[] }, into: string[]): void {
  into.push(node.id);
  for (const c of (node.children ?? []) as { id: string; children?: unknown[] }[]) {
    collectIds(c, into);
  }
}

describe('platform component catalog', () => {
  it('is substantial and covers every category', () => {
    // Guards against the assembly forgetting to spread a category (a silent gap).
    expect(PLATFORM_CATALOG.length).toBeGreaterThanOrEqual(60);
    const present = new Set(PLATFORM_CATALOG.map((e) => e.category));
    for (const category of CATALOG_CATEGORIES) {
      expect(present.has(category), `no catalog entries in category "${category}"`).toBe(true);
    }
  });

  it('every entry tree validates against BuilderNodeSchema', () => {
    for (const e of PLATFORM_CATALOG) {
      const r = BuilderNodeSchema.safeParse(e.tree);
      expect(
        r.success,
        `entry "${e.key}" tree invalid: ${r.success ? '' : JSON.stringify(r.error.issues, null, 2)}`
      ).toBe(true);
    }
  });

  it('keys are unique and kebab/snake-valid', () => {
    const seen = new Set<string>();
    for (const e of PLATFORM_CATALOG) {
      expect(KEY_RE.test(e.key), `bad key "${e.key}"`).toBe(true);
      expect(seen.has(e.key), `duplicate key "${e.key}"`).toBe(false);
      seen.add(e.key);
    }
  });

  it('every entry declares a known category and at least one surface', () => {
    for (const e of PLATFORM_CATALOG) {
      expect(CATALOG_CATEGORIES).toContain(e.category);
      expect(e.surfaces.length).toBeGreaterThan(0);
    }
  });

  it('node ids are unique within each entry tree', () => {
    for (const e of PLATFORM_CATALOG) {
      const ids: string[] = [];
      collectIds(e.tree, ids);
      expect(new Set(ids).size, `entry "${e.key}" has duplicate node ids`).toBe(ids.length);
    }
  });

  it('groups for the page surface skip empty categories and preserve order', () => {
    const groups = catalogGroupsForSurface('page');
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.entries.length).toBeGreaterThan(0);
    const order = groups.map((g) => g.category);
    const expectedOrder = CATALOG_CATEGORIES.filter((c) => order.includes(c));
    expect(order).toEqual(expectedOrder);
  });

  it('surface filtering and lookup work', () => {
    const page = catalogForSurface('page');
    expect(page.length).toBeGreaterThan(0);
    const first = PLATFORM_CATALOG[0]!;
    expect(findCatalogEntry(first.key)?.key).toBe(first.key);
    expect(findCatalogEntry('definitely_not_a_key')).toBeUndefined();
  });
});
