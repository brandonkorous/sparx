// Locks the pinned-core foundation (docs/122 Phase 2) against the real silica engine:
// a `hostCore` authors a `kind:"host"` node whose `component` is a registered key, and
// `toHtml` lowers it to the empty `data-sui-host` mount point the storefront walk swaps
// for the real component. `functionalShell` brackets the core in an editable section.

import { describe, expect, it } from 'vitest';
import { toHtml, type Node } from '@wizeworks/silicaui-html';

import { HOST_COMPONENTS, HOST_KEYS, functionalShell, hostCore } from './host-nodes';

/** The first host node found in a subtree (depth-first). */
function firstHost(node: Node): Node | undefined {
  if (node.kind === 'host') return node;
  const kids = (node as { children?: Node[] }).children ?? [];
  for (const c of kids) {
    const found = firstHost(c);
    if (found) return found;
  }
  return undefined;
}

describe('hostCore — a pinned functional region', () => {
  it('authors a host node carrying the registered component key + its default wrapper', () => {
    const node = hostCore(HOST_KEYS.commerceCart);
    expect(node.kind).toBe('host');
    expect((node as { component: string }).component).toBe('commerce.cart');
    // the registry's defaultClass rides the wrapper (LITERAL, so Tailwind safelists it)
    const meta = HOST_COMPONENTS.find((c) => c.key === HOST_KEYS.commerceCart)!;
    expect((node as { class?: string }).class).toBe(meta.defaultClass);
  });

  it('lowers to an EMPTY data-sui-host mount point (no baked content)', () => {
    const html = toHtml(hostCore(HOST_KEYS.commerceCart));
    expect(html).toContain('data-sui-host="commerce.cart"');
    // empty mount — the real component is injected at render time, never in the tree
    expect(html).toMatch(/<div[^>]*data-sui-host="commerce\.cart"[^>]*><\/div>/);
  });
});

describe('functionalShell — the default editable shell', () => {
  it('brackets the pinned core under an editable heading in one section', () => {
    const shell = functionalShell(HOST_KEYS.commerceCart, { heading: 'Your cart' });
    expect(shell.kind).toBe('element');
    const host = firstHost(shell);
    expect(host?.kind).toBe('host');
    expect((host as { component: string }).component).toBe('commerce.cart');
    const html = toHtml(shell);
    expect(html).toContain('Your cart'); // editable heading
    expect(html).toContain('data-sui-host="commerce.cart"'); // pinned core
  });

  it('omits the heading when none is given (bare pinned core in a section)', () => {
    const html = toHtml(functionalShell(HOST_KEYS.commerceCart));
    expect(html).toContain('data-sui-host="commerce.cart"');
    expect(html).not.toContain('<h1');
  });
});

describe('HOST_COMPONENTS registry', () => {
  it('every entry has a registered, unique key and a non-empty label/icon', () => {
    const keys = HOST_COMPONENTS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length); // unique
    for (const c of HOST_COMPONENTS) {
      expect(c.key).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.icon).toBeTruthy();
      expect(c.defaultClass).toBeTruthy();
    }
  });
});
