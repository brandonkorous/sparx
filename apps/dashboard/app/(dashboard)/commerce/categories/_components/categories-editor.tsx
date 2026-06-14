'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';

import { Badge, Stack, Text } from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

export interface CategoryNode {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parentId: string | null;
  path: string;
  position: number;
  featured: boolean;
  productCount: number;
  depth: number;
  children: CategoryNode[];
}

interface TreeProps {
  tree: CategoryNode[];
}

// Read-only navigational tree. Each row links into the category's detail view
// (drawer / modal / full page per the user's preference) where rename, reslug,
// reparent, reorder, and delete live — no inline editing, to keep the surface
// uniform with every other entity. Chevrons expand/collapse; clicking the name
// opens the detail. Drag-to-reorder is a future enhancement (today reorder is
// the Position field in the detail view).

export function CategoriesEditor({ tree }: TreeProps) {
  return (
    <Stack gap={0}>
      {tree.map((node) => (
        <TreeNode key={node.id} node={node} />
      ))}
    </Stack>
  );
}

function TreeNode({ node }: { node: CategoryNode }) {
  const [expanded, setExpanded] = React.useState(node.depth <= 1);
  const hasChildren = node.children.length > 0;

  return (
    <Stack
      gap={0}
      className="border-b border-[var(--color-border-default)] last:border-b-0"
      style={{ paddingLeft: `${node.depth * 1.5}rem` }}
    >
      <Stack direction="row" align="center" gap={2} className="py-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" aria-hidden />
        )}

        <EntityRowLink
          href={`/commerce/categories/${node.id}`}
          entityType="category"
          entityId={node.id}
          className="flex flex-1 items-center gap-2 rounded px-1 py-1 hover:bg-[var(--color-bg-subtle)]"
        >
          <Text size="sm" weight="medium">
            {node.name}
          </Text>
          <Text size="xs" variant="muted">
            /{node.handle}
          </Text>
        </EntityRowLink>

        {node.featured && (
          <Badge variant="outline" className="text-xs">
            <Star className="mr-1 h-3 w-3" />
            featured
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {node.productCount} product{node.productCount === 1 ? '' : 's'}
        </Badge>
      </Stack>

      {expanded && hasChildren && (
        <Stack gap={0}>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
