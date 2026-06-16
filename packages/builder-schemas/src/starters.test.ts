import { describe, it, expect } from 'vitest';
import { BuilderNodeSchema } from './node';
import { STARTER_PAGES, STARTER_LAYOUT, blankPageTree } from './starters';

// The starters are hand-authored seed trees (the layout's navbar zones, the page
// starters). They are seeded verbatim into BuilderPage/BuilderLayout rows, so a
// malformed tree would only surface at a tenant's first load — validate here.

function collectIds(node: { id: string; children?: unknown[] }, into: string[]): void {
  into.push(node.id);
  for (const c of (node.children ?? []) as { id: string; children?: unknown[] }[]) {
    collectIds(c, into);
  }
}

describe('builder starters', () => {
  it('every starter page tree validates against BuilderNodeSchema', () => {
    for (const p of STARTER_PAGES) {
      const r = BuilderNodeSchema.safeParse(p.tree);
      expect(r.success, `page "${p.key}": ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(
        true
      );
    }
  });

  it('the starter site layout validates and contains exactly one Outlet', () => {
    const r = BuilderNodeSchema.safeParse(STARTER_LAYOUT.tree);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
    const outlets: string[] = [];
    const walk = (n: { type: string; children?: unknown[] }): void => {
      if (n.type === 'Outlet') outlets.push(n.type);
      for (const c of (n.children ?? []) as { type: string; children?: unknown[] }[]) walk(c);
    };
    walk(STARTER_LAYOUT.tree);
    expect(outlets).toHaveLength(1);
  });

  it('the starter header is the navbar component with navbar-start/center/end zones', () => {
    // docs/98 §5: the header is the `navbar` component — a <nav class="navbar">
    // with three navbar-start / navbar-center / navbar-end zones, NOT a rigid
    // guided Section and NOT generic flex divs.
    const root = STARTER_LAYOUT.tree;
    const nav = root.children?.find((c) => c.type === 'el:nav');
    expect(nav, 'layout has a <nav> navbar').toBeDefined();
    expect(nav?.class, 'nav carries the navbar class').toContain('navbar');
    const zones = nav?.children ?? [];
    expect(zones.length, 'navbar has three zones').toBe(3);
    expect(zones[0]?.class).toContain('navbar-start');
    expect(zones[1]?.class).toContain('navbar-center');
    expect(zones[2]?.class).toContain('navbar-end');
  });

  it('the default header centers the wordmark (in navbar-center, no variant)', () => {
    // There is ONE navbar; centering the brand is just putting the Wordmark in
    // the navbar-center zone. This guards that default.
    const nav = STARTER_LAYOUT.tree.children?.find((c) => c.type === 'el:nav');
    const [start, center] = nav?.children ?? [];
    const has = (zone: typeof center, type: string): boolean =>
      (zone?.children ?? []).some((c) => c.type === type);
    expect(center?.class, 'center zone is navbar-center').toContain('navbar-center');
    expect(has(center, 'Wordmark'), 'Wordmark is in the navbar-center zone').toBe(true);
    expect(has(start, 'NavMenu'), 'nav links live in the navbar-start zone').toBe(true);
  });

  it('blank page tree validates with unique ids', () => {
    const tree = blankPageTree();
    expect(BuilderNodeSchema.safeParse(tree).success).toBe(true);
    const ids: string[] = [];
    collectIds(tree, ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
