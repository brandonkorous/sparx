// Whether a batch of DOM additions brought silica markers nobody has wired yet
// (sparx persona issue 086). The storefront runtime (`components/silica-behaviors`)
// wires the page's markers once per address; a server re-render at the same
// address (a refresh after signing in, a revalidation) puts fresh markers into
// the document that the once-per-address pass never sees. Its observer calls
// this on each batch and wires again when it says so. Wiring is idempotent, so
// a false alarm costs one cheap pass.

/** The few DOM members this reads, so it can be tested without a browser. */
export interface MarkerNode {
  nodeType: number;
  matches?: (selector: string) => boolean;
  querySelector?: (selector: string) => MarkerNode | null;
}

/** The attribute `hydrate` stamps on every marker it has wired. */
export const WIRED_ATTR = 'data-sui-hydrated';

/** A behavior marker the runtime has not wired. */
export const UNWIRED_MARKER = `[data-sui-behavior]:not([${WIRED_ATTR}])`;

const ELEMENT_NODE = 1;

export function hasUnwiredMarkers(
  records: Iterable<{ addedNodes: Iterable<MarkerNode> | ArrayLike<MarkerNode> }>
): boolean {
  for (const record of records) {
    for (const added of Array.from(record.addedNodes)) {
      if (added.nodeType !== ELEMENT_NODE) continue;
      if (added.matches?.(UNWIRED_MARKER)) return true;
      if (added.querySelector?.(UNWIRED_MARKER)) return true;
    }
  }
  return false;
}
