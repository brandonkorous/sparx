'use client';

// Where a category sits in the menu — the one field that is a tree rather than a
// value. It cannot offer a category's own descendants, because filing a category
// under one of its own children has no bottom.

import { useMemo, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  SearchInput,
  Text,
} from '@wizeworks/silicaui-react';
import { useCategoryTree, type CategoryNode } from './categories-data';

/* ── The parent picker ──────────────────────────────────────────────────── */

interface FlatCategory {
  id: string;
  name: string;
  trail: string[];
  path: string;
}

/** Depth-first, parents before children, carrying each node's path so the picker
 *  can rule out a category's own subtree (you cannot file a category under one of
 *  its own descendants). */
function flattenWithPath(nodes: CategoryNode[] | undefined): FlatCategory[] {
  const out: FlatCategory[] = [];
  const walk = (list: CategoryNode[], trail: string[]) => {
    for (const node of list) {
      const here = [...trail, node.name];
      out.push({ id: node.id, name: node.name, trail: here, path: node.path });
      walk(node.children, here);
    }
  };
  walk(nodes ?? [], []);
  return out;
}

export function ParentPicker({
  selfId,
  selfPath,
  value,
  onChange,
}: {
  selfId: string | null;
  selfPath: string | null;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const tree = useCategoryTree();
  const [search, setSearch] = useState('');

  const all = useMemo(() => flattenWithPath(tree.data), [tree.data]);

  // A category cannot be its own parent, nor sit under one of its descendants —
  // that would make a loop the tree cannot represent.
  const choosable = useMemo(
    () =>
      all.filter((category) => {
        if (selfId && category.id === selfId) return false;
        if (selfPath && (category.path === selfPath || category.path.startsWith(`${selfPath}.`))) {
          return false;
        }
        return true;
      }),
    [all, selfId, selfPath]
  );

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === '') return choosable;
    return choosable.filter((category) =>
      category.trail.join(' › ').toLowerCase().includes(needle)
    );
  }, [choosable, search]);

  const chosen = value ? all.find((category) => category.id === value) : null;

  return (
    <Field>
      <FieldLabel>Sits inside</FieldLabel>
      <FieldControl
        render={
          <div className="flex flex-col gap-2">
            {tree.isError ? (
              <Text>
                Your categories could not be loaded. This one will be left at the top level.
              </Text>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Text as="span" className="text-sm">
                    {chosen ? (
                      <>
                        Inside <span className="font-semibold">{chosen.trail.join(' › ')}</span>
                      </>
                    ) : (
                      'At the top level of your menu'
                    )}
                  </Text>
                  {chosen ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      onClick={() => {
                        onChange(null);
                      }}
                    >
                      Move to top level
                    </Button>
                  ) : null}
                </div>

                {choosable.length > 8 ? (
                  <div className="max-w-sm min-w-0">
                    <SearchInput
                      size="sm"
                      aria-label="Search categories"
                      placeholder="Search categories…"
                      value={search}
                      onValueChange={setSearch}
                    />
                  </div>
                ) : null}

                <div className="border-base-300 max-h-56 overflow-y-auto rounded border p-1">
                  <ParentRow
                    label="Top level (no parent)"
                    selected={value === null}
                    onSelect={() => {
                      onChange(null);
                    }}
                  />
                  {matches.length === 0 ? (
                    <Text className="p-2 text-sm">No category matches “{search.trim()}”.</Text>
                  ) : (
                    matches.map((category) => (
                      <ParentRow
                        key={category.id}
                        selected={value === category.id}
                        onSelect={() => {
                          onChange(category.id);
                        }}
                      >
                        {category.trail.slice(0, -1).map((ancestor) => (
                          <span key={ancestor}>{ancestor} › </span>
                        ))}
                        <span className="font-semibold">{category.name}</span>
                      </ParentRow>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        }
      />
      <FieldDescription>
        Choose a category to nest this one inside it, or leave it at the top level. Moving a
        category brings everything underneath it along.
      </FieldDescription>
    </Field>
  );
}

/** One row in the parent list — a real button, aria-pressed for the current
 *  choice, full ink because the trail is meant to be read. */
function ParentRow({
  label,
  children,
  selected,
  onSelect,
}: {
  label?: string;
  children?: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`flex w-full items-center rounded px-2 py-2 text-left ${
        selected ? 'bg-module text-module-content' : 'hover:bg-base-200'
      }`}
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1">{children ?? label}</span>
    </button>
  );
}
