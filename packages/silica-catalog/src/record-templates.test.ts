// The guard that would have caught the missing `cms.blog_post` default.
//
// That bug shipped because the resolution chain ended in `return null` — a legal
// answer that means "no default for this type", indistinguishable from "someone forgot
// this type". These tests make the distinction checkable: every ROUTED record type must
// have a template, and every template must produce a real tree.

import { describe, expect, it } from 'vitest';
import { toHtml } from '@wizeworks/silicaui-html';

import {
  RECORD_TEMPLATES,
  RECORD_TEMPLATE_LABELS,
  ROUTED_RECORD_TYPES,
  recordTemplate,
} from './record-templates';

/** Every host-core key mounted anywhere in a subtree. */
function hostKeys(node: unknown, out: string[] = []): string[] {
  const n = node as { kind?: string; component?: string; children?: unknown[] };
  if (n?.kind === 'host' && n.component) out.push(n.component);
  for (const c of n?.children ?? []) if (c && typeof c === 'object') hostKeys(c, out);
  return out;
}

describe('RECORD_TEMPLATES — every routed record type has a default', () => {
  it('covers every routed record type', () => {
    for (const type of ROUTED_RECORD_TYPES) {
      expect(RECORD_TEMPLATES[type], `no default template for routed type "${type}"`).toBeTypeOf(
        'function'
      );
    }
  });

  it('has no template for a type the platform does not route', () => {
    // Not pedantry: an orphan entry means either a dead composite or — worse — a route
    // someone removed while leaving the template behind, so the pair drifts apart.
    for (const type of Object.keys(RECORD_TEMPLATES)) {
      expect(ROUTED_RECORD_TYPES, `"${type}" has a template but no route`).toContain(type);
    }
  });

  it('labels every template', () => {
    for (const type of ROUTED_RECORD_TYPES) {
      expect(RECORD_TEMPLATE_LABELS[type]).toBeTruthy();
    }
  });

  // A composite that returns an empty wrapper passes a "is it a function" check and
  // still ships a blank page — so assert each template actually puts something on the
  // page. Two legitimate ways to do that, and the first draft of this test only knew
  // about one: the category and service templates are ENTIRELY a pinned host core, which
  // lowers to an empty `<div data-sui-host>` and gets its content from React at runtime.
  // Requiring markup would have failed them for being correct.
  it('every template either renders real markup or mounts a host core', () => {
    for (const type of ROUTED_RECORD_TYPES) {
      const tree = RECORD_TEMPLATES[type]();
      const html = toHtml(tree);
      const substantial = html.length > 200;
      const mountsCore = hostKeys(tree).length > 0;
      expect(
        substantial || mountsCore,
        `"${type}" renders neither markup nor a host core — it would ship a blank page`
      ).toBe(true);
    }
  });

  it('mints a FRESH tree per call (factories, never shared singletons)', () => {
    // A shared tree would be mutated in place by id-stamping on insert, so two records
    // rendered in one process would fight over the same node ids.
    for (const type of ROUTED_RECORD_TYPES) {
      expect(RECORD_TEMPLATES[type]()).not.toBe(RECORD_TEMPLATES[type]());
    }
  });

  describe('recordTemplate()', () => {
    it('resolves a routed type to a labelled tree', () => {
      const t = recordTemplate('cms.blog_post');
      expect(t?.label).toBe('Blog post');
      expect(t?.root).toBeTruthy();
    });

    it('returns null for an unknown type rather than throwing', () => {
      // A stale client asking for a type we removed must degrade, not 500.
      expect(recordTemplate('commerce.nonsense')).toBeNull();
    });
  });
});
