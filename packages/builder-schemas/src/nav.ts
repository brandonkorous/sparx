// Navigation links for the Builder `NavMenu` node (docs/57).
//
// Navigation is SITE CHROME owned by the Builder, not the CMS module — a
// header/footer is something every site has, regardless of which modules it
// runs. The `NavMenu` node carries its own links in `props.links` (per-site, in
// the layout tree); this module is the single normalizer both the storefront
// renderer and the dashboard editor read through, so the three historical
// shapes resolve identically in one place:
//
//   1. structured `NavLink[]`            — the node-owned source of truth (docs/57);
//   2. a bound array of `{label,url}`    — the legacy CMS menu (site.primaryNav);
//   3. a hand-typed `"Label|/url"` string — the original unbound fallback.
//
// Zod-free plain TS (like binding.ts): a computed/normalized shape, not a
// persisted contract validated at a trust boundary.

export interface NavLink {
  label: string;
  /** Freeform target: '/about' | '/products/x' | 'https://…' | '#'. */
  href: string;
  openInNewTab?: boolean;
  /** One level of dropdown children. Carried for forward-compat; P1 renders flat. */
  children?: NavLink[];
}

/** Coerce one raw item (a structured link, or a legacy `{label,url}` row) into a
 *  NavLink — or null when it has no usable label. Accepts both `href`/`url` and
 *  `openInNewTab`/`open_in_new_tab` so legacy CMS rows pass through unchanged. */
function toNavLink(raw: unknown): NavLink | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.trim() : '';
  if (!label) return null;
  const href =
    (typeof o.href === 'string' && o.href.trim()) ||
    (typeof o.url === 'string' && o.url.trim()) ||
    '#';
  const openInNewTab = o.openInNewTab === true || o.open_in_new_tab === true;
  const children = Array.isArray(o.children)
    ? o.children.map(toNavLink).filter((l): l is NavLink => l !== null)
    : undefined;
  return {
    label,
    href: href || '#',
    ...(openInNewTab ? { openInNewTab: true } : {}),
    ...(children && children.length > 0 ? { children } : {}),
  };
}

/** Parse the legacy hand-typed `links` string — one `Label` or `Label|/url` per
 *  line — into structured NavLinks. */
export function parseNavLinks(raw: string): NavLink[] {
  return (raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split('|');
      return { label: (label ?? '').trim(), href: (href ?? '#').trim() || '#' };
    })
    .filter((l) => l.label !== '');
}

/**
 * Normalize a `NavMenu` node's links into a structured `NavLink[]`, from any of
 * the three historical shapes (docs/57). Priority — node-owned wins:
 *   1. `props.links` as a non-empty structured array (the source of truth);
 *   2. a non-empty bound array (the legacy CMS menu, during the transition);
 *   3. `props.links` as a legacy hand-typed string.
 * Empty everywhere → `[]` (the node renders nothing).
 */
export function coerceNavLinks(linksProp: unknown, boundValue?: unknown): NavLink[] {
  if (Array.isArray(linksProp)) {
    const structured = linksProp.map(toNavLink).filter((l): l is NavLink => l !== null);
    if (structured.length > 0) return structured;
  }
  if (Array.isArray(boundValue)) {
    const bound = boundValue.map(toNavLink).filter((l): l is NavLink => l !== null);
    if (bound.length > 0) return bound;
  }
  if (typeof linksProp === 'string') {
    return parseNavLinks(linksProp);
  }
  return [];
}
