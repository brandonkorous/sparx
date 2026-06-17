// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  PLATFORM_CATALOG,
  SX_BEHAVIOR_NAMES,
  SX_ROLE_NAMES,
  findCatalogEntry,
} from '@sparx/builder-schemas';
import { behaviorAttrs, SX_ROLES, sxAttrs } from './attrs';
import { hydrateBehaviors } from './index';
import { BEHAVIOR_NAMES } from './types';

interface TreeNode {
  props?: Record<string, unknown>;
  children?: TreeNode[];
}
function walk(node: TreeNode, visit: (n: TreeNode) => void): void {
  visit(node);
  for (const c of node.children ?? []) walk(c, visit);
}

describe('behaviorAttrs / sxAttrs (the sanctioned data-sx-* lowering)', () => {
  it('lowers a behavior prop to its root + param attributes', () => {
    expect(behaviorAttrs({ type: 'carousel', autoplay: false, interval: 5 })).toEqual({
      'data-sx-carousel': '',
      'data-sx-autoplay': 'false',
      'data-sx-interval': '5',
    });
  });

  it('kebab-cases camelCase params', () => {
    expect(behaviorAttrs({ type: 'marquee', pauseOnHover: true })).toEqual({
      'data-sx-marquee': '',
      'data-sx-pause-on-hover': 'true',
    });
  });

  it('drops an unknown behavior type (closed vocabulary)', () => {
    expect(behaviorAttrs({ type: 'evil', onload: 'alert(1)' })).toEqual({});
    expect(behaviorAttrs(null)).toEqual({});
    expect(behaviorAttrs('carousel')).toEqual({});
  });

  it('emits a structural role only from the closed SX_ROLES set', () => {
    expect(sxAttrs({ props: { sxRole: 'slide' } })).toEqual({ 'data-sx-slide': '' });
    expect(sxAttrs({ props: { sxRole: 'script' } })).toEqual({});
  });

  it('combines a behavior root and a role on one node', () => {
    expect(sxAttrs({ props: { behavior: { type: 'tabs' }, sxRole: 'panel' } })).toEqual({
      'data-sx-tabs': '',
      'data-sx-panel': '',
    });
  });
});

describe('hydrateBehaviors (DOM wiring)', () => {
  it('wires a disclosure: clicking a trigger toggles its panel', () => {
    document.body.innerHTML = `
      <div data-sx-disclosure>
        <div data-sx-item>
          <button data-sx-trigger>Q</button>
          <div data-sx-panel>A</div>
        </div>
      </div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const cleanup = hydrateBehaviors(root, { edit: false });
    const trigger = root.querySelector<HTMLElement>('[data-sx-trigger]')!;
    const panel = root.querySelector<HTMLElement>('[data-sx-panel]')!;
    expect(panel.hidden).toBe(true);
    trigger.click();
    expect(panel.hidden).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    trigger.click();
    expect(panel.hidden).toBe(true);
    cleanup();
  });

  it('wires tabs: clicking a tab reveals its index-matched panel', () => {
    document.body.innerHTML = `
      <div data-sx-tabs>
        <button data-sx-tab>One</button>
        <button data-sx-tab>Two</button>
        <div data-sx-panel>P1</div>
        <div data-sx-panel>P2</div>
      </div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const cleanup = hydrateBehaviors(root, { edit: false });
    const t2 = root.querySelectorAll<HTMLElement>('[data-sx-tab]')[1]!;
    const panels = root.querySelectorAll<HTMLElement>('[data-sx-panel]');
    const p1 = panels[0]!;
    const p2 = panels[1]!;
    expect(p1.hidden).toBe(false);
    expect(p2.hidden).toBe(true);
    t2.click();
    expect(p1.hidden).toBe(true);
    expect(p2.hidden).toBe(false);
    expect(t2.getAttribute('aria-selected')).toBe('true');
    cleanup();
  });

  it('cleanup detaches listeners (a click after teardown is inert)', () => {
    document.body.innerHTML = `
      <div data-sx-menu><button data-sx-trigger>Menu</button><nav data-sx-panel>links</nav></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const cleanup = hydrateBehaviors(root, { edit: false });
    const trigger = root.querySelector<HTMLElement>('[data-sx-trigger]')!;
    trigger.click();
    expect(root.getAttribute('data-open')).toBe('true');
    cleanup();
    root.setAttribute('data-open', 'false');
    trigger.click(); // listener gone → no toggle
    expect(root.getAttribute('data-open')).toBe('false');
  });
});

// The catalog authors behaviors against MIRRORED vocabularies in @sparx/builder-schemas
// (the lower package can't import this runtime). If the runtime renames or drops a
// behavior/role, the catalog would author a `data-sx-*` nothing reads — silently inert.
// These pin the two vocabularies together and prove every behavior the catalog ships
// actually lowers to a marker the runtime recognises (docs/98 Pillar 6).
describe('catalog ↔ runtime behavior vocabulary', () => {
  it('the schema-side mirrors match the runtime closed sets exactly', () => {
    expect([...SX_BEHAVIOR_NAMES].sort()).toEqual([...BEHAVIOR_NAMES].sort());
    expect([...SX_ROLE_NAMES].sort()).toEqual([...SX_ROLES].sort());
  });

  it('every behavior + role used in the catalog lowers to a recognised marker', () => {
    let behaviorRoots = 0;
    let roleMarkers = 0;
    for (const e of PLATFORM_CATALOG) {
      walk(e.tree, (n) => {
        const behavior = n.props?.behavior;
        if (behavior) {
          behaviorRoots++;
          const attrs = behaviorAttrs(behavior);
          const type = (behavior as { type?: string }).type;
          expect(BEHAVIOR_NAMES).toContain(type);
          expect(attrs[`data-sx-${type}`]).toBe(''); // not silently dropped
        }
        const role = n.props?.sxRole;
        if (typeof role === 'string') {
          roleMarkers++;
          expect(SX_ROLES as readonly string[]).toContain(role);
          expect(sxAttrs(n)[`data-sx-${role}`]).toBe('');
        }
      });
    }
    // The interactive composites exist, so the catalog really exercises the runtime.
    expect(behaviorRoots).toBeGreaterThanOrEqual(7);
    expect(roleMarkers).toBeGreaterThan(behaviorRoots);
  });

  it('the carousel hero lowers to a full, wired slider', () => {
    const hero = findCatalogEntry('carousel_hero');
    expect(hero).toBeDefined();
    const roles: string[] = [];
    let rootAttrs: Record<string, string> = {};
    walk(hero!.tree, (n) => {
      if (n.props?.behavior) rootAttrs = behaviorAttrs(n.props.behavior);
      if (typeof n.props?.sxRole === 'string') roles.push(n.props.sxRole);
    });
    expect(rootAttrs).toMatchObject({ 'data-sx-carousel': '', 'data-sx-autoplay': 'true' });
    expect(roles.filter((r) => r === 'slide')).toHaveLength(3);
    expect(roles.filter((r) => r === 'dot')).toHaveLength(3);
    expect(roles).toContain('track');
    expect(roles).toContain('prev');
    expect(roles).toContain('next');
  });
});
