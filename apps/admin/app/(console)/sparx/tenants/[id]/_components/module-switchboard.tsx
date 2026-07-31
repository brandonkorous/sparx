'use client';

// The operator module switchboard (build-plan §5 Slice 8) — the write-capable
// counterpart to the read-only ModulesCard, shown only to operators holding
// `module:toggle`. It mirrors the tenant's OWN Settings → Modules switch UI
// (color dot, price, Included/Required locks, one Switch per module) but acts on
// another tenant's account: every flip is confirmed (it changes the tenant's bill
// and access), then dispatched through `toggleTenantModuleAction`, which drives
// the identical event path and stamps the tenant's audit_logs as an operator
// action. Lock state is read from the server (`source`/`requiredBy`), never
// re-derived here; the action revalidates the page so cascades (enabling B2B
// co-enables Commerce and bundles Invoicing free) repaint every affected row.

import * as React from 'react';
import {
  Badge,
  Card,
  Heading,
  ModuleProvider,
  Stack,
  Text,
  cn,
  toast,
  useConfirm,
} from '@sparx/ui';
import { Switch } from '@wizeworks/silicaui-react';
import type { OperatorTenantModule } from '@sparx/operator';
import { moduleColor, moduleLabel } from '@/lib/modules';
import { formatMoneyCents } from '@/lib/format';
import { toggleTenantModuleAction } from '../actions';

type Lock = 'included' | 'required' | null;

function lockOf(m: OperatorTenantModule): Lock {
  if (m.requiredBy.length > 0) return 'required';
  if (m.source === 'bundled') return 'included';
  return null;
}

function joinLabels(keys: string[]): string {
  const names = keys.map(moduleLabel);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`;
}

export function ModuleSwitchboard({
  tenantId,
  tenantName,
  modules,
}: {
  tenantId: string;
  tenantName: string;
  modules: OperatorTenantModule[];
}) {
  const confirm = useConfirm();
  const [optimistic, setOptimistic] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [, startTransition] = React.useTransition();

  // Server props are the source of truth — clear local state when they change
  // (the action revalidates this page, so a cascade reconciles on its own).
  React.useEffect(() => {
    setOptimistic({});
    setPending({});
  }, [modules]);

  function isOn(m: OperatorTenantModule): boolean {
    return m.key in optimistic ? optimistic[m.key]! : m.enabled;
  }

  async function onToggle(m: OperatorTenantModule): Promise<void> {
    if (lockOf(m) !== null || pending[m.key]) return;
    const next = !isOn(m);
    const label = moduleLabel(m.key);
    const price = m.monthlyCents > 0 ? `${formatMoneyCents(m.monthlyCents)}/mo` : null;

    const ok = await confirm({
      title: next
        ? `Activate ${label} for ${tenantName}?`
        : `Deactivate ${label} for ${tenantName}?`,
      description: next
        ? `Turns on ${label} for this tenant${
            price ? `, adding ${price} to their bill` : ''
          }, and activates anything ${label} depends on. It appears in the tenant's account activity as a WizeWorks-initiated change.`
        : `Turns off ${label} for this tenant — its API returns MODULE_DISABLED and its dashboard routes stop. Stored data is kept. It appears in the tenant's account activity as a WizeWorks-initiated change.`,
      confirmLabel: next ? 'Activate module' : 'Deactivate module',
      tone: next ? 'module' : 'warning',
    });
    if (!ok) return;

    setOptimistic((o) => ({ ...o, [m.key]: next }));
    setPending((p) => ({ ...p, [m.key]: true }));
    startTransition(async () => {
      const res = await toggleTenantModuleAction(tenantId, m.key, next);
      if (res.ok) {
        toast.success(next ? `${label} activated` : `${label} deactivated`);
        // Hold the optimistic value until the revalidated props land.
        return;
      }
      // Revert on failure (e.g. a 409 blocking a required-module teardown).
      setOptimistic((o) => {
        const nextState = { ...o };
        delete nextState[m.key];
        return nextState;
      });
      setPending((p) => {
        const nextState = { ...p };
        delete nextState[m.key];
        return nextState;
      });
      toast.error(res.error);
    });
  }

  return (
    <Card>
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={3}>Modules</Heading>
          <Text size="sm" variant="muted">
            Activate or deactivate a module for this tenant. Changes take effect immediately, adjust
            their bill, and are recorded in their account activity as WizeWorks-initiated.
          </Text>
        </Stack>
        <div>
          {modules.map((m, i) => (
            <ModuleRow
              key={m.key}
              module={m}
              on={isOn(m)}
              lock={lockOf(m)}
              busy={Boolean(pending[m.key])}
              isLast={i === modules.length - 1}
              onToggle={() => void onToggle(m)}
            />
          ))}
        </div>
      </Stack>
    </Card>
  );
}

function ModuleRow({
  module: m,
  on,
  lock,
  busy,
  isLast,
  onToggle,
}: {
  module: OperatorTenantModule;
  on: boolean;
  lock: Lock;
  busy: boolean;
  isLast: boolean;
  onToggle: () => void;
}) {
  const caption =
    lock === 'required'
      ? `Required by ${joinLabels(m.requiredBy)}`
      : lock === 'included'
        ? `Included with ${joinLabels(m.includedBy)}`
        : null;
  const priceLabel =
    lock === 'included'
      ? 'Included'
      : m.monthlyCents > 0
        ? `+ ${formatMoneyCents(m.monthlyCents)}/mo`
        : 'Free';

  return (
    <ModuleProvider module={moduleColor(m.key)}>
      <div className={cn('flex items-center gap-4 py-3', !isLast && 'border-base-300 border-b')}>
        <span className="bg-module h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Text weight="medium">{moduleLabel(m.key)}</Text>
          {caption ? (
            <Badge
              color={lock === 'included' ? 'success' : 'neutral'}
              variant="soft"
              size="sm"
              className="mt-1 self-start"
            >
              {caption}
            </Badge>
          ) : null}
        </div>
        <span
          className={cn(
            'w-20 shrink-0 text-right text-sm',
            lock === 'included'
              ? 'text-success font-medium'
              : on
                ? 'text-base-content font-medium'
                : 'text-base-content'
          )}
        >
          {priceLabel}
        </span>
        {/* The switch takes `color="module"`, not the module's own name: the row
            is already wrapped in its <ModuleProvider>, so the hue arrives through
            --color-module. A named `module-<key>` color would need this app to
            have registered the full module palette, and the console registers
            only `module`. */}
        {lock === 'included' ? (
          <span className="w-9 shrink-0" aria-hidden="true" />
        ) : (
          <Switch
            checked={on}
            onCheckedChange={onToggle}
            disabled={lock !== null || busy}
            color="module"
            aria-label={moduleLabel(m.key)}
          />
        )}
      </div>
    </ModuleProvider>
  );
}
