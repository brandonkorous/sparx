'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, FolderTree, Star } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

export interface CategoryNode {
  id: string;
  name: string;
  handle: string;
  parentId: string | null;
  path: string;
  position: number;
  featured: boolean;
  productCount: number;
  updatedAt: string;
  depth: number;
  children: CategoryNode[];
  /** Set only on FILTERED (flat) results from the endpoint — the parent's name,
   *  for the "under {parent}" context the flattened-away hierarchy would lose. */
  parentName?: string | null;
}

// One flattened, visible row. `hasChildren` drives the chevron; `parentName`
// gives the card view its "under X" context (cards can't carry the indent).
interface Row {
  node: CategoryNode;
  hasChildren: boolean;
  parentName: string | null;
}

interface CategoriesTableProps {
  tree: CategoryNode[];
  view: 'table' | 'card';
  /** Active search term — drives flat-vs-tree rendering. The endpoint already
   *  filtered: when set, `tree` is the flat matches (docs/34 §7.1). */
  q?: string;
  /** The featured quick filter: 'yes' | 'no'. Same contract as `q`. */
  featured?: string;
}

// Categories list — the standard Collection/List substrate (docs/34 §7) adapted
// for a TREE. `SelectionList` renders the responsive table↔card chrome and the
// row→detail link exactly like every other list; the hierarchy lives in the Name
// column (depth indent + expand/collapse chevrons). We flatten the *visible*
// (expanded) tree and hand the flat rows to SelectionList — which only ever sees
// a flat list, so it stays a generic primitive. Read-only: rename / reslug /
// reparent / reorder / delete all live in the detail view.
//
// Search + the featured filter run server-side (docs/34 §7.1): when either is
// active the endpoint returns FLAT matches (each carrying `parentName`), so the
// hierarchy steps aside for a plain result list — a half-tree reads worse.
export function CategoriesTable({ tree, view, q, featured }: CategoriesTableProps) {
  // Default: expand the first two levels (parity with the old tree's depth<=1).
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const init = new Set<string>();
    (function seed(nodes: CategoryNode[]) {
      for (const n of nodes) {
        if (n.depth <= 1) init.add(n.id);
        seed(n.children);
      }
    })(tree);
    return init;
  });

  const toggle = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // When search or the featured filter is active the endpoint already returned
  // FLAT matches, so the hierarchy steps aside (a half-tree reads worse).
  const filtering = (q ?? '').trim().length > 0 || featured === 'yes' || featured === 'no';

  // Flatten to the visible rows. Filtering → the server's flat matches as-is,
  // each with its `parentName` for the "under {parent}" context. Otherwise → the
  // expand-aware tree (a node's children show only when it's expanded; card view
  // ignores expansion since cards carry no chevron).
  const rows = React.useMemo<Row[]>(() => {
    if (filtering) {
      return tree.map((node) => ({
        node,
        hasChildren: false,
        parentName: node.parentName ?? null,
      }));
    }
    const out: Row[] = [];
    (function walk(nodes: CategoryNode[], parentName: string | null) {
      for (const n of nodes) {
        out.push({ node: n, hasChildren: n.children.length > 0, parentName });
        if (view === 'card' || expanded.has(n.id)) walk(n.children, n.name);
      }
    })(tree, null);
    return out;
  }, [tree, expanded, view, filtering]);

  // Matches the collections list's featured badge (accent · soft · sm) — a real
  // highlight hue, not a bland outline pill, and consistent across the two
  // commerce lists that carry a `featured` flag.
  const featuredBadge = (
    <Badge color="accent" variant="soft" size="sm">
      <Star className="mr-1 h-3 w-3" />
      featured
    </Badge>
  );

  const columns: SelectionColumn<Row>[] = [
    {
      header: 'Name',
      cell: ({ node, hasChildren, parentName }) => {
        const isOpen = expanded.has(node.id);
        return (
          <div
            className="flex flex-row items-center gap-2"
            style={filtering ? undefined : { paddingLeft: `${node.depth * 1.25}rem` }}
          >
            {!filtering &&
              (hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(node.id)}
                  aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                  aria-expanded={isOpen}
                  className="text-base-content/60 hover:text-base-content focus-visible:ring-primary shrink-0 rounded-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="inline-block h-4 w-4 shrink-0" aria-hidden />
              ))}
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-row items-center gap-2">
                <EntityRowLink
                  href={`/commerce/categories/${node.id}`}
                  entityType="category"
                  entityId={node.id}
                  className="hover:text-module text-sm font-medium hover:underline"
                >
                  {node.name}
                </EntityRowLink>
                {node.featured && featuredBadge}
              </div>
              <p className="text-base-content/70 text-xs">
                /{node.handle}
                {filtering && parentName ? ` · under ${parentName}` : ''}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Priority',
      align: 'right',
      cell: ({ node }) => <p className="text-sm">{node.position}</p>,
    },
    {
      header: 'Products',
      align: 'right',
      cell: ({ node }) => <p className="text-sm">{node.productCount}</p>,
    },
    {
      header: 'Updated',
      cell: ({ node }) => (
        <p className="text-base-content/70 text-sm">
          {new Date(node.updatedAt).toLocaleDateString()}
        </p>
      ),
    },
  ];

  const card: SelectionCard<Row> = {
    title: ({ node }) => (
      <EntityRowLink
        href={`/commerce/categories/${node.id}`}
        entityType="category"
        entityId={node.id}
        className="hover:text-module truncate text-sm font-medium hover:underline"
      >
        {node.name}
      </EntityRowLink>
    ),
    subtitle: ({ node, parentName }) => (
      <p className="text-base-content/70 text-xs">
        /{node.handle}
        {parentName ? ` · under ${parentName}` : ' · top level'}
      </p>
    ),
    badge: ({ node }) => (node.featured ? featuredBadge : null),
    body: ({ node }) => (
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-base-content/70 text-xs">priority {node.position}</p>
        <p className="text-sm tabular-nums">
          {node.productCount} product{node.productCount === 1 ? '' : 's'}
        </p>
      </div>
    ),
  };

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<FolderTree className="h-5 w-5" />}
          title="No categories match"
          description="Adjust the search or the featured filter to broaden the results."
        />
      </Card>
    );
  }

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(r) => r.node.id}
      getRowLabel={(r) => r.node.name}
      entityLabelPlural="categories"
      columns={columns}
      card={card}
    />
  );
}
