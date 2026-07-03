'use client';

import * as React from 'react';
import { Badge, Button, Checkbox, Stack, Text } from '@sparx/ui';
import type { McpScopeMeta } from '@sparx/auth';

export interface ConsentFormProps {
  /** Hidden authorize params to echo back to the server actions. */
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
    <form method="post" action="/oauth/consent/submit">
      {Object.entries(params).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="scopes" value={[...selected].join(' ')} />

      <Stack gap={5}>
        <Stack direction="row" gap={2} align="center">
          <Button type="button" size="sm" variant="outline" onClick={selectReadOnly}>
            Read-only
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            Clear
          </Button>
          <Text size="sm" variant="muted">
            {selected.size} of {catalog.length} selected
          </Text>
        </Stack>

        <Stack gap={5}>
          {groups.map((group) => (
            <Stack key={group.module} gap={2}>
              <Text size="sm" weight="medium">
                {group.module}
              </Text>
              <Stack gap={2}>
                {group.scopes.map((meta) => {
                  const id = `scope-${meta.scope}`;
                  const on = selected.has(meta.scope);
                  return (
                    <label
                      key={meta.scope}
                      htmlFor={id}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] p-3"
                    >
                      <Checkbox
                        id={id}
                        checked={on}
                        aria-label={meta.label}
                        color={meta.kind === 'write' ? 'warning' : 'primary'}
                        onCheckedChange={(v) => toggle(meta.scope, v === true)}
                        className="mt-0.5"
                      />
                      <Stack gap={1} className="min-w-0 flex-1">
                        <Stack direction="row" gap={2} align="center">
                          <Text size="sm" weight="medium">
                            {meta.label}
                          </Text>
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
                        </Stack>
                        <Text size="xs" variant="muted">
                          {meta.description}
                        </Text>
                      </Stack>
                    </label>
                  );
                })}
              </Stack>
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" gap={3} justify="end">
          <Button type="submit" name="decision" value="deny" variant="ghost">
            Deny
          </Button>
          <Button type="submit" name="decision" value="approve" color="primary">
            Authorize {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
