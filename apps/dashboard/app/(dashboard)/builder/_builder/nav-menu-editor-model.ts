// Pure node ⇄ editable-rows transforms for the NavMenu quick-editor (docs/57
// rebuild). Kept UI-free so the round-trip — read a NavMenu's NavItem children
// into flat editable rows, write rows back as a fresh child list — is independently
// testable, and the modal file stays just the React surface.

import { coerceNavLinks } from '@sparx/builder-schemas';

import { type BuilderNode, makeId } from './model';

export interface EditRow {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
  children: EditRow[];
}

function toRow(node: BuilderNode): EditRow {
  const p = node.props ?? {};
  return {
    id: node.id,
    label: typeof p.label === 'string' ? p.label : '',
    href: typeof p.href === 'string' ? p.href : '',
    openInNewTab: p.openInNewTab === true,
    children: (node.children ?? []).filter((c) => c.type === 'NavItem').map(toRow),
  };
}

/** The NavMenu's NavItem children as editable rows. With none, seed from the
 *  legacy `props.links[]` so the first save migrates the menu. */
export function readRows(node: BuilderNode): EditRow[] {
  const navItems = (node.children ?? []).filter((c) => c.type === 'NavItem');
  if (navItems.length > 0) return navItems.map(toRow);
  return coerceNavLinks(node.props.links).map((l) => ({
    id: makeId('NavItem'),
    label: l.label,
    href: l.href,
    openInNewTab: l.openInNewTab === true,
    children: [],
  }));
}

/** Drop rows with no label (a blank in-progress row is meaningless once saved),
 *  recursively. */
function prune(rows: EditRow[]): EditRow[] {
  return rows
    .filter((r) => r.label.trim().length > 0)
    .map((r) => ({ ...r, children: prune(r.children) }));
}

function fromRow(row: EditRow, byId: Map<string, BuilderNode>): BuilderNode {
  const existing = byId.get(row.id);
  const props: Record<string, unknown> = { ...(existing?.props ?? {}) };
  props.label = row.label.trim();
  if (row.href.trim()) props.href = row.href.trim();
  else delete props.href;
  if (row.openInNewTab) props.openInNewTab = true;
  else delete props.openInNewTab;
  // A container-native NavItem never carries the legacy flat-links prop.
  delete props.links;
  const children = row.children.map((c) => fromRow(c, byId));
  const node: BuilderNode = { id: row.id, type: 'NavItem', props };
  if (existing?.class) node.class = existing.class;
  if (existing?.name) node.name = existing.name;
  if (children.length > 0) node.children = children;
  return node;
}

/** Rebuild the NavMenu with `rows` as its NavItem children — preserving each
 *  existing node's id/class/name, minting fresh ids for new rows, and clearing the
 *  legacy `props.links`. */
export function applyRows(node: BuilderNode, rows: EditRow[]): BuilderNode {
  const byId = new Map<string, BuilderNode>();
  const index = (n: BuilderNode) => {
    byId.set(n.id, n);
    (n.children ?? []).forEach(index);
  };
  (node.children ?? []).forEach(index);
  const nextProps = { ...node.props };
  delete nextProps.links;
  return { ...node, props: nextProps, children: prune(rows).map((r) => fromRow(r, byId)) };
}

export function newRow(withChild: boolean): EditRow {
  return {
    id: makeId('NavItem'),
    label: '',
    href: withChild ? '' : '/',
    openInNewTab: false,
    children: withChild ? [newRow(false)] : [],
  };
}

/** Swap row `i` with its neighbour in `dir` (a no-op past either end). */
export function reorder(rows: EditRow[], i: number, dir: -1 | 1): EditRow[] {
  const j = i + dir;
  if (j < 0 || j >= rows.length) return rows;
  const next = rows.slice();
  const tmp = next[i]!;
  next[i] = next[j]!;
  next[j] = tmp;
  return next;
}
