'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Stack,
  Switch,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';

import { resetAllToolPoliciesAction, resetToolPolicyAction, setToolPolicyAction } from '../actions';
import { moduleGroupLabel, PLATFORM_GROUP_LABEL, type ToolPolicyDto } from './tool-types';

// The MCP tool-policy manager: the full tool catalog grouped by owning module
// (platform tools last), each row a name + description + scope + write badge and
// a Switch toggling effective exposure. Toggling off writes an explicit disable
// (a security control — the tool disappears from every connected assistant);
// toggling a previously-overridden tool back on clears the override to default.
// "Reset all" wipes every override at once.

interface ToolPolicyManagerProps {
  tools: ToolPolicyDto[];
}

interface ToolGroup {
  module: string | null;
  label: string;
  tools: ToolPolicyDto[];
}

// Group by owning module; sort the groups alphabetically by label but always
// pin the null-module "Platform" group last.
function groupTools(tools: ToolPolicyDto[]): ToolGroup[] {
  const byModule = new Map<string | null, ToolPolicyDto[]>();
  for (const tool of tools) {
    const existing = byModule.get(tool.module);
    if (existing) existing.push(tool);
    else byModule.set(tool.module, [tool]);
  }
  return [...byModule.entries()]
    .map(([module, items]) => ({
      module,
      label: moduleGroupLabel(module),
      tools: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (a.label === PLATFORM_GROUP_LABEL) return 1;
      if (b.label === PLATFORM_GROUP_LABEL) return -1;
      return a.label.localeCompare(b.label);
    });
}

export function ToolPolicyManager({ tools }: ToolPolicyManagerProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [resetting, startReset] = React.useTransition();

  const groups = React.useMemo(() => groupTools(tools), [tools]);
  const disabledCount = tools.filter((t) => !t.enabled).length;
  const overrideCount = tools.filter((t) => t.explicit).length;

  function resetAll(): void {
    void (async () => {
      const ok = await confirm({
        title: 'Reset all tool overrides?',
        description: `This clears ${overrideCount} override${
          overrideCount === 1 ? '' : 's'
        } and returns every MCP tool to its default — exposed to your connected assistants. This can’t be undone.`,
        confirmLabel: 'Reset all tools',
        tone: 'warning',
      });
      if (!ok) return;
      startReset(async () => {
        const res = await resetAllToolPoliciesAction();
        if (!res.ok) {
          toast.error('Couldn’t reset tool overrides', { description: res.error.message });
          return;
        }
        toast.success(
          res.data.cleared > 0
            ? `Cleared ${res.data.cleared} override${res.data.cleared === 1 ? '' : 's'}`
            : 'There were no overrides to clear'
        );
        router.refresh();
      });
    })();
  }

  return (
    <>
      <Stack direction="row" gap={3} justify="between" align="center" wrap>
        <Text size="sm" variant="muted">
          {tools.length} tool{tools.length === 1 ? '' : 's'} in your MCP catalog
          {disabledCount > 0 ? ` · ${disabledCount} disabled` : ' · all exposed'}.
        </Text>
        <Button
          variant="outline"
          color="module"
          leftIcon={<RotateCcw className="h-4 w-4" />}
          onClick={resetAll}
          loading={resetting}
          disabled={resetting || overrideCount === 0}
        >
          Reset all
        </Button>
      </Stack>

      <Alert color="info" className="mt-4" icon={<ShieldCheck className="h-4 w-4" />}>
        Disabling a tool is a security control — it hides the tool from every connected MCP
        assistant, not just one. Re-enable it any time to expose it again.
      </Alert>

      <Stack gap={6} className="mt-6">
        {groups.map((group) => (
          <section key={group.label}>
            <Stack direction="row" align="center" gap={2} className="mb-3">
              <Text weight="medium">{group.label}</Text>
              <Badge variant="soft" size="sm">
                {group.tools.length}
              </Badge>
            </Stack>
            <Card variant="default" padding="none">
              <CardContent className="p-0">
                {group.tools.map((tool, index) => (
                  <ToolRow key={tool.name} tool={tool} isLast={index === group.tools.length - 1} />
                ))}
              </CardContent>
            </Card>
          </section>
        ))}
      </Stack>
    </>
  );
}

interface ToolRowProps {
  tool: ToolPolicyDto;
  isLast: boolean;
}

function ToolRow({ tool, isLast }: ToolRowProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  // Optimistic exposure so the Switch responds immediately; reconciled on
  // refresh (or rolled back on error).
  const [enabled, setEnabled] = React.useState(tool.enabled);

  React.useEffect(() => setEnabled(tool.enabled), [tool.enabled]);

  function onToggle(next: boolean): void {
    setEnabled(next);
    setPending(true);
    void (async () => {
      try {
        // Re-enabling a tool that only has an explicit DISABLE override clears the
        // override (back to default-on); every other change writes the explicit
        // exposure the user asked for.
        const res =
          next && tool.explicit
            ? await resetToolPolicyAction(tool.name)
            : await setToolPolicyAction(tool.name, next);
        if (!res.ok) {
          setEnabled(tool.enabled);
          toast.error('Couldn’t update the tool', { description: res.error.message });
          return;
        }
        router.refresh();
      } finally {
        setPending(false);
      }
    })();
  }

  return (
    <div
      className={[
        'flex items-center gap-4 px-4 py-3.5',
        isLast ? '' : 'border-b border-[var(--color-border-default)]',
      ].join(' ')}
    >
      <span aria-hidden className="mt-1 self-start text-[var(--color-text-tertiary)]">
        {tool.write ? <Pencil className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <Stack direction="row" align="center" gap={2} wrap>
          <Text weight="medium" className="font-mono text-[0.8125rem]">
            {tool.name}
          </Text>
          {tool.write ? (
            <Badge color="warning" variant="soft" size="sm">
              Write
            </Badge>
          ) : (
            <Badge color="neutral" variant="soft" size="sm">
              Read
            </Badge>
          )}
          {tool.explicit && (
            <Badge color="info" variant="outline" size="sm">
              Overridden
            </Badge>
          )}
        </Stack>
        <Text size="sm" variant="muted" className="mt-1">
          {tool.description}
        </Text>
        <Text size="xs" variant="subtle" className="mt-1 font-mono">
          {tool.scope}
        </Text>
      </div>
      <Switch
        color="module"
        checked={enabled}
        disabled={pending}
        onCheckedChange={onToggle}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${tool.name}`}
      />
    </div>
  );
}
