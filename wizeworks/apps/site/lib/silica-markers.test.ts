// Silica markers that arrive AFTER the page first loaded still get wired (sparx
// persona issue 086).
//
// The storefront wires silica forms and widgets once per address. When the page
// at the same address is re-rendered from the server (a refresh after signing
// in, a revalidation), new markers land in the document and nothing wired them:
// "Add to quote request" then did a bare form GET that reloaded the page as
// `?accountId=…`. `hasUnwiredMarkers` is the test the runtime's observer runs on
// each batch of added nodes.

import { describe, expect, it } from 'vitest';

import { hasUnwiredMarkers, type MarkerNode } from './silica-markers';

function node(
  opts: { behavior?: boolean; wired?: boolean; inner?: MarkerNode[] } = {}
): MarkerNode {
  const self: MarkerNode = {
    nodeType: 1,
    matches: (sel: string) =>
      sel === '[data-sui-behavior]:not([data-sui-hydrated])'
        ? Boolean(opts.behavior) && !opts.wired
        : false,
    querySelector: (sel: string) =>
      (opts.inner ?? []).find((n) => n.matches?.(sel) === true) ?? null,
  };
  return self;
}

const text: MarkerNode = { nodeType: 3 };

describe('hasUnwiredMarkers', () => {
  it('is true for an added form that has not been wired', () => {
    expect(hasUnwiredMarkers([{ addedNodes: [node({ behavior: true })] }])).toBe(true);
  });

  it('is true for one inside an added section', () => {
    expect(hasUnwiredMarkers([{ addedNodes: [node({ inner: [node({ behavior: true })] })] }])).toBe(
      true
    );
  });

  it('is false for nodes already wired, plain nodes and text', () => {
    expect(
      hasUnwiredMarkers([
        { addedNodes: [node({ behavior: true, wired: true }), node(), text] },
        { addedNodes: [] },
      ])
    ).toBe(false);
  });
});
