'use client';

import * as React from 'react';
import { Badge, Button, Switch, Text } from '@wizeworks/silicaui-react';
import type { McpScopeMeta } from '@sparx/auth';

export interface ConsentFormProps {
  /** Hidden authorize params to echo back to the submit route. */
  params: Record<string, string>;
  /** Scopes this user's role may grant (already role-capped). */
  catalog: McpScopeMeta[];
  /** Scopes pre-checked (client's requested ∩ grantable). */
  defaultSelected: string[];
}

export function ConsentForm({ params, catalog, defaultSelected }: ConsentFormProps) {
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
    // Fills the card's remaining height (min-h-0 lets the middle scroll) so the
    // toolbar and the Deny/Authorize footer stay pinned while only the scope list
    // scrolls — the Authorize action is always on screen, no zooming out to reach it.
    <form method="post" action="/oauth/consent/submit" className="flex min-h-0 flex-1 flex-col">
      {Object.entries(params).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="scopes" value={[...selected].join(' ')} />

      <div className="border-base-300 flex shrink-0 flex-wrap items-center gap-2 border-b px-6 py-3 sm:px-8">
        <Button type="button" size="sm" variant="outline" onClick={selectAll}>
          Select all
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={selectReadOnly}>
          Read-only
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
          Clear
        </Button>
        <Text className="ml-auto text-sm font-medium">
          {selected.size} of {catalog.length} selected
        </Text>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.module} className="flex flex-col gap-2">
              <Text className="text-sm font-semibold">{group.module}</Text>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.scopes.map((meta) => {
                  const labelId = `scope-${meta.scope}-label`;
                  const descId = `scope-${meta.scope}-desc`;
                  const on = selected.has(meta.scope);
                  return (
                    // Label on the left, Switch on the right. The Switch carries its
                    // own name/description via aria — it's the control, not the row.
                    <div
                      key={meta.scope}
                      className="border-base-300 flex items-start justify-between gap-3 rounded-md border p-2.5"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span id={labelId} className="text-sm font-medium">
                            {meta.label}
                          </span>
                          {meta.kind === 'write' && (
                            <Badge color="warning" variant="soft" size="sm">
                              write
                            </Badge>
                          )}
                          {meta.sensitive && (
                            <Badge color="danger" variant="soft" size="sm">
                              sensitive
                            </Badge>
                          )}
                        </div>
                        <span id={descId} className="text-xs">
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
          Deny
        </Button>
        <Button type="submit" name="decision" value="approve" color="primary">
          Authorize{selected.size > 0 ? ` (${selected.size})` : ''}
        </Button>
      </div>
    </form>
  );
}
