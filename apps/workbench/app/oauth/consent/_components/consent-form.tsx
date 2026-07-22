'use client';

import * as React from 'react';
import { Badge, Button, Checkbox, Text } from '@wizeworks/silicaui-react';
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
    <form method="post" action="/oauth/consent/submit" className="flex flex-col gap-5">
      {Object.entries(params).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="scopes" value={[...selected].join(' ')} />

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={selectReadOnly}>
          Read-only
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
          Clear
        </Button>
        <Text className="text-base-content/70 text-sm">
          {selected.size} of {catalog.length} selected
        </Text>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.module} className="flex flex-col gap-2">
            <Text className="text-sm font-medium">{group.module}</Text>
            <div className="flex flex-col gap-2">
              {group.scopes.map((meta) => {
                const id = `scope-${meta.scope}`;
                const on = selected.has(meta.scope);
                return (
                  <label
                    key={meta.scope}
                    htmlFor={id}
                    className="border-base-300 flex cursor-pointer items-start gap-3 rounded-md border p-3"
                  >
                    <Checkbox
                      id={id}
                      checked={on}
                      aria-label={meta.label}
                      color={meta.kind === 'write' ? 'warning' : 'primary'}
                      onChange={(e) => toggle(meta.scope, e.target.checked)}
                      className="mt-0.5"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Text className="text-sm font-medium">{meta.label}</Text>
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
                      <Text className="text-base-content/70 text-xs">{meta.description}</Text>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" name="decision" value="deny" variant="ghost">
          Deny
        </Button>
        <Button type="submit" name="decision" value="approve" color="primary">
          Authorize {selected.size > 0 ? `(${selected.size})` : ''}
        </Button>
      </div>
    </form>
  );
}
