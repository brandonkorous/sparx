'use client';

// The Layers tree — the structural view of the page. Every node shows its
// name, a binding chip (color-coded by the module that supplies the data) and a
// ↻ badge when it iterates. Clicking selects; the same selection drives the
// canvas and inspector.

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@sparx/ui';
import type { BindingCatalog } from '@sparx/builder-schemas';

import { type BuilderNode } from './model';
import { NO_SCOPE, cardinalityForPath, moduleColor, moduleForPath } from './binding-catalog';
import { getDef } from './registry';

function bindMeta(
  node: BuilderNode,
  catalog: BindingCatalog
): { path: string; color: string; repeats: boolean } | null {
  if (!node.binding) return null;
  const path = node.binding.path;
  const color = moduleColor(moduleForPath(catalog, path));
  // Best-effort cardinality for the ↻ badge (item.* can't be resolved here, so
  // it never shows the badge — its own iteration comes from an ancestor).
  const repeats = path.startsWith('item')
    ? false
    : cardinalityForPath(catalog, NO_SCOPE, path) === 'array';
  return { path, color, repeats };
}

function Row({
  node,
  depth,
  catalog,
  selectedId,
  onSelect,
  onRemove,
  isRoot,
}: {
  node: BuilderNode;
  depth: number;
  catalog: BindingCatalog;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  isRoot: boolean;
}) {
  const def = getDef(node.type);
  if (!def) return null;
  const Icon = def.icon;
  const bind = bindMeta(node, catalog);

  return (
    <>
      <div
        className={cn('bx-layer', node.id === selectedId && 'bx-layer--on')}
        style={{ paddingLeft: 8 + depth * 14 }}
        role="button"
        tabIndex={0}
        aria-pressed={node.id === selectedId}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
      >
        <Icon className="bx-layer__icon" aria-hidden />
        <span className="bx-layer__name">{node.box.name ?? def.label}</span>
        {bind ? (
          <span className="bx-layer__chip" style={{ color: bind.color }}>
            <span className="bx-layer__dot" style={{ background: bind.color }} />
            {bind.path}
          </span>
        ) : null}
        {bind?.repeats ? <span className="bx-layer__repeat">↻</span> : null}
        {!isRoot ? (
          <button
            type="button"
            className="bx-layer__remove"
            aria-label="Remove layer"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(node.id);
            }}
          >
            <X aria-hidden />
          </button>
        ) : null}
      </div>
      {(node.children ?? []).map((child) => (
        <Row
          key={child.id}
          node={child}
          depth={depth + 1}
          catalog={catalog}
          selectedId={selectedId}
          onSelect={onSelect}
          onRemove={onRemove}
          isRoot={false}
        />
      ))}
    </>
  );
}

export function LayersPanel({
  tree,
  catalog,
  selectedId,
  onSelect,
  onRemove,
}: {
  tree: BuilderNode;
  catalog: BindingCatalog;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="bx-layers">
      <Row
        node={tree}
        depth={0}
        catalog={catalog}
        selectedId={selectedId}
        onSelect={onSelect}
        onRemove={onRemove}
        isRoot
      />
    </div>
  );
}
