'use client';

// The scope picker. Everything above it on the page is fixed context; this is
// the only part where a decision gets made.
//
// The card is a viewport-bounded flex column: toolbar and the Allow/Cancel
// footer stay pinned, only the middle scrolls. An owner sees 25 permissions
// across 12 apps, which overflows a laptop viewport several times over — and an
// Allow button somebody has to scroll to find is a button they will click
// without reading what is above it.

import * as React from 'react';
import { Badge, Button, Switch, Text } from '@wizeworks/silicaui-react';
import type { McpScopeMeta } from '@wizeworks/auth';

export interface ConsentFormProps {
  /** Hidden authorize params echoed back to the submit route. */
  params: Record<string, string>;
  /** Permissions this person's role may grant (already role-capped). */
  catalog: McpScopeMeta[];
  /** Pre-checked (what the app asked for ∩ what this role may give). */
  defaultSelected: string[];
  /** Piggles' name for each module, so the groups read as the apps people know. */
  groupLabel: (module: string) => string;
}

export function ConsentForm({ params, catalog, defaultSelected, groupLabel }: ConsentFormProps) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(defaultSelected));

  const toggle = (scope: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope);
      else next.delete(scope);
      return next;
    });

  const readScopes = catalog.filter((s) => s.kind === 'read').map((s) => s.scope);
  const selectAll = () => setSelected(new Set(catalog.map((s) => s.scope)));
  const selectReadOnly = () => setSelected(new Set(readScopes));
  const clearAll = () => setSelected(new Set());

  // Group by module, preserving catalog order.
  const groups: { module: string; scopes: McpScopeMeta[] }[] = [];
  for (const meta of catalog) {
    const g = groups.find((x) => x.module === meta.module);
    if (g) g.scopes.push(meta);
    else groups.push({ module: meta.module, scopes: [meta] });
  }

  return (
    <form method="post" action="/oauth/consent/submit" className="flex min-h-0 flex-1 flex-col">
      {Object.entries(params).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="scopes" value={[...selected].join(' ')} />

      <div className="border-base-300 flex shrink-0 flex-wrap items-center gap-2 border-b px-6 py-3 sm:px-8">
        <Button type="button" size="sm" variant="outline" onClick={selectAll}>
          Everything
        </Button>
        {/* Named for what it DOES, not for a permission model: "Look, don't
            touch" is the honest description and needs no glossary. */}
        <Button type="button" size="sm" variant="outline" onClick={selectReadOnly}>
          Look, don’t touch
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
          Nothing
        </Button>
        <Text className="ml-auto text-sm font-medium">
          {selected.size} of {catalog.length} chosen
        </Text>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.module} className="flex flex-col gap-2">
              <Text className="text-sm font-semibold">{groupLabel(group.module)}</Text>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.scopes.map((meta) => {
                  const labelId = `scope-${meta.scope}-label`;
                  const descId = `scope-${meta.scope}-desc`;
                  const on = selected.has(meta.scope);
                  return (
                    <div
                      key={meta.scope}
                      className="border-base-300 flex items-start justify-between gap-3 rounded-md border p-2.5"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span id={labelId} className="text-sm font-medium">
                            {meta.label}
                          </span>
                          {/* Color carries the distinction, so the words don't
                              have to: changing things is amber, the tender stuff
                              is red. */}
                          {meta.kind === 'write' && (
                            <Badge color="warning" variant="soft" size="sm">
                              can change things
                            </Badge>
                          )}
                          {meta.sensitive && (
                            <Badge color="danger" variant="soft" size="sm">
                              sensitive
                            </Badge>
                          )}
                        </div>
                        <span id={descId} className="text-sm">
                          {meta.description}
                        </span>
                      </div>
                      <Switch
                        checked={on}
                        onCheckedChange={(v) => toggle(meta.scope, v)}
                        color={meta.kind === 'write' ? 'warning' : 'primary'}
                        aria-labelledby={labelId}
                        aria-describedby={descId}
                        className="mt-0.5 shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-base-300 bg-base-100 flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4 sm:px-8">
        <Button type="submit" name="decision" value="deny" variant="ghost">
          Cancel
        </Button>
        <Button type="submit" name="decision" value="approve" color="primary">
          Allow{selected.size > 0 ? ` (${selected.size})` : ''}
        </Button>
      </div>
    </form>
  );
}
