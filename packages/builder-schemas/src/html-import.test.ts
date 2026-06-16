import { describe, expect, it } from 'vitest';

import {
  importHtmlNodes,
  reportHasChanges,
  summarizeReport,
  type DomNode,
} from './html-import';
import { rawTagOf, safeElementAttrs } from './element';
import type { BuilderNode } from './node';

// ── Tiny DOM fixture builder ──────────────────────────────────────────────────
// A hand-built tree that satisfies the structural DomNode shape the parser walks
// (a real browser Element satisfies the same shape, exercised by the dashboard).

function el(
  tagName: string,
  attrs: Record<string, string> = {},
  children: DomNode[] = []
): DomNode {
  return {
    nodeType: 1,
    tagName,
    attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    childNodes: children,
  };
}
function text(textContent: string): DomNode {
  return { nodeType: 3, textContent };
}

// A deterministic id factory so assertions are stable.
function counterIds() {
  let n = 0;
  return (type: string) => `${type}-${(n += 1)}`;
}

function run(roots: DomNode[], opts?: Parameters<typeof importHtmlNodes>[1]) {
  return importHtmlNodes(roots, { makeId: counterIds(), ...opts });
}

describe('importHtmlNodes — tags', () => {
  it('emits el:<tag> nodes for whitelisted tags, nesting preserved', () => {
    const { nodes } = run([
      el('section', { class: 'py-10' }, [el('div', {}, [el('h1', {}, [text('Hi')])])]),
    ]);
    expect(nodes).toHaveLength(1);
    const section = nodes[0]!;
    expect(section.type).toBe('el:section');
    expect(section.class).toBe('py-10');
    const div = section.children![0]!;
    expect(div.type).toBe('el:div');
    const h1 = div.children![0]!;
    expect(h1.type).toBe('el:h1');
    expect(h1.props.text).toBe('Hi');
  });

  it('drops denied tags entirely (script/style/iframe/object/embed/link/meta)', () => {
    for (const bad of ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base']) {
      const { nodes, report } = run([el('div', {}, [el(bad, {}, [text('x')])])]);
      // The div survives; the denied child is gone (with no smuggled grandchild text).
      expect(nodes[0]!.type).toBe('el:div');
      expect(nodes[0]!.children ?? []).toHaveLength(0);
      expect(report.droppedTags.some((d) => d.tag === bad)).toBe(true);
    }
  });

  it('drops an unknown/non-whitelisted tag (e.g. <marquee>)', () => {
    const { nodes, report } = run([el('marquee', {}, [text('hey')])]);
    expect(nodes).toHaveLength(0);
    expect(report.droppedTags).toContainEqual({ tag: 'marquee', count: 1 });
  });

  it('lifts the element children of a denied WRAPPER in place', () => {
    // <center> is not whitelisted; its <p> child must survive, lifted up.
    const { nodes } = run([el('center', {}, [el('p', {}, [text('kept')])])]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.type).toBe('el:p');
    expect(nodes[0]!.props.text).toBe('kept');
  });

  it('lifts through nested denied wrappers', () => {
    const { nodes } = run([el('font', {}, [el('center', {}, [el('span', {}, [text('deep')])])])]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.type).toBe('el:span');
  });
});

describe('importHtmlNodes — attributes', () => {
  it('keeps allow-listed attrs, drops on* handlers and raw style', () => {
    const { nodes, report } = run([
      el('a', {
        href: '/products',
        onclick: 'steal()',
        style: 'position:fixed',
        'data-x': 'nope',
      }),
    ]);
    const a = nodes[0]!;
    expect(a.props.href).toBe('/products');
    expect(a.props).not.toHaveProperty('style');
    // on* + style + unknown data-* all stripped + reported.
    const attrs = report.droppedAttrs.map((d) => d.attr);
    expect(attrs).toContain('onclick');
    expect(attrs).toContain('style');
    expect(attrs).toContain('data-x');
  });

  it('forces rel=noopener noreferrer on target=_blank and reports it', () => {
    const { nodes, report } = run([el('a', { href: 'https://x.test', target: '_blank' })]);
    const a = nodes[0]!;
    // The prop bag carries target; the renderer's safeElementAttrs forces rel.
    const out = safeElementAttrs({ type: a.type, props: a.props });
    expect(out.rel).toBe('noopener noreferrer');
    expect(report.forcedRel).toBe(1);
  });

  it('rejects dangerous href schemes at render time (javascript:/data:)', () => {
    const { nodes } = run([el('a', { href: 'javascript:alert(1)' })]);
    const a = nodes[0]!;
    // The prop is carried, but safeElementAttrs scheme-checks it out.
    const out = safeElementAttrs({ type: a.type, props: a.props });
    expect(out.href).toBeUndefined();
  });

  it('maps native/aria attribute spellings to prop keys (for, aria-label, viewBox)', () => {
    const { nodes } = run([
      el('label', { for: 'email', 'aria-label': 'Email' }),
      el('svg', { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' }),
    ]);
    expect(nodes[0]!.props.for).toBe('email');
    expect(nodes[0]!.props.ariaLabel).toBe('Email');
    expect(nodes[1]!.props.viewBox).toBe('0 0 24 24');
  });

  it('normalizes a bare boolean attribute so the renderer coerces it', () => {
    const { nodes } = run([el('input', { type: 'checkbox', disabled: '' })]);
    const out = safeElementAttrs({ type: nodes[0]!.type, props: nodes[0]!.props });
    expect(out.disabled).toBe(true);
  });
});

describe('importHtmlNodes — classes', () => {
  it('drops classes the injected validator denies, keeps the rest', () => {
    // Mimic the surface-compile allowlist: deny url()/fixed/z-[…]/content-[…].
    const isClassAllowed = (t: string) =>
      !/url\(/i.test(t) && !/^!?fixed$/.test(t) && !/^!?-?z-\[/.test(t) && !/^!?content-\[/.test(t);
    const { nodes, report } = run(
      [el('div', { class: 'flex gap-4 fixed z-[9999] bg-[url(x)] content-["x"]' })],
      { isClassAllowed }
    );
    expect(nodes[0]!.class).toBe('flex gap-4');
    const dropped = report.droppedClasses.map((d) => d.token);
    expect(dropped).toContain('fixed');
    expect(dropped).toContain('z-[9999]');
    expect(dropped).toContain('bg-[url(x)]');
    expect(dropped).toContain('content-["x"]');
  });

  it('keeps every class when no validator is injected (cap still guards the tree)', () => {
    const { nodes } = run([el('div', { class: 'fixed z-[9999]' })]);
    expect(nodes[0]!.class).toBe('fixed z-[9999]');
  });
});

describe('importHtmlNodes — text handling', () => {
  it('puts inline text on the text prop for text tags', () => {
    const { nodes } = run([el('p', {}, [text('Hello world')])]);
    expect(nodes[0]!.props.text).toBe('Hello world');
    expect(nodes[0]!.children).toBeUndefined();
  });

  it('wraps bare text in a container into a span text node', () => {
    const { nodes } = run([el('div', {}, [text('loose text')])]);
    const div = nodes[0]!;
    expect(div.children).toHaveLength(1);
    expect(div.children![0]!.type).toBe('el:span');
    expect(div.children![0]!.props.text).toBe('loose text');
  });

  it('preserves mixed content (text beside element children) without loss', () => {
    const { nodes } = run([el('p', {}, [el('strong', {}, [text('bold')]), text('and rest')])]);
    const p = nodes[0]!;
    expect(p.children).toHaveLength(2);
    expect(p.children![0]!.type).toBe('el:strong');
    expect(p.children![1]!.type).toBe('el:span');
    expect(p.children![1]!.props.text).toBe('and rest');
  });

  it('wraps a top-level bare text run in a span', () => {
    const { nodes } = run([text('orphan')]);
    expect(nodes[0]!.type).toBe('el:span');
    expect(nodes[0]!.props.text).toBe('orphan');
  });

  it('collapses insignificant whitespace', () => {
    const { nodes } = run([el('p', {}, [text('  a\n   b  ')])]);
    expect(nodes[0]!.props.text).toBe('a b');
  });
});

describe('importHtmlNodes — ids + report', () => {
  it('mints a fresh id for every emitted node', () => {
    const { nodes } = run([el('div', {}, [el('span', {}, [text('a')]), el('span', {}, [text('b')])])]);
    const ids: string[] = [];
    const collect = (n: BuilderNode) => {
      ids.push(n.id);
      n.children?.forEach(collect);
    };
    nodes.forEach(collect);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it('every emitted node has a real raw-element type', () => {
    const { nodes } = run([el('article', {}, [el('h2', {}, [text('T')])])]);
    const ok = (n: BuilderNode): boolean =>
      rawTagOf(n.type) !== null && (n.children ?? []).every(ok);
    expect(nodes.every(ok)).toBe(true);
  });

  it('counts emitted nodes and exposes change flags', () => {
    const { report } = run([
      el('div', { class: 'flex' }, [el('script', {}, [text('x')]), el('p', {}, [text('ok')])]),
    ]);
    expect(report.emitted).toBe(2); // div + p (script dropped)
    expect(reportHasChanges(report)).toBe(true);
    expect(report.droppedTags).toContainEqual({ tag: 'script', count: 1 });
  });

  it('reportHasChanges is false for a clean import', () => {
    const { report } = run([el('section', { class: 'p-4' }, [el('p', {}, [text('clean')])])]);
    expect(reportHasChanges(report)).toBe(false);
    expect(summarizeReport(report)).toContain('2 elements imported');
  });

  it('summarizeReport lists the headline drops', () => {
    const { report } = run([
      el('div', { onclick: 'x', class: 'fixed' }, [el('iframe', {})]),
    ], {
      isClassAllowed: (t) => t !== 'fixed',
    });
    const s = summarizeReport(report);
    expect(s).toMatch(/tag/);
    expect(s).toMatch(/attribute/);
    expect(s).toMatch(/class/);
  });
});
