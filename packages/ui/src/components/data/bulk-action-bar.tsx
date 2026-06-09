'use client';

import * as React from 'react';
import { Button } from '../primitives/button';
import { Text } from '../primitives/text';
import { Stack } from '../layout/stack';
import { useConfirm } from '../overlay/confirm-provider';
import { cn } from '../../utils/cn';

// BulkActionBar — slides up from the viewport bottom when 1+ rows are
// selected. Destructive actions automatically gate on useConfirm (no external
// state needed). Slides back down and unmounts when selection is cleared.
//
// Usage:
//   <BulkActionBar
//     selected={selectedIds}
//     onClear={() => setSelected([])}
//     actions={[
//       { label: 'Delete', variant: 'destructive', requiresConfirm: true,
//         confirmLabel: 'Delete {count} products? This cannot be undone.',
//         onAction: async (ids) => { ... } },
//     ]}
//   />

export interface BulkAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  requiresConfirm?: boolean;
  /** Template string — use `{count}` as a placeholder for the selection count. */
  confirmLabel?: string;
  onAction: (ids: string[]) => Promise<void>;
}

export interface BulkActionBarProps {
  selected: string[];
  onClear: () => void;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionBar({ selected, onClear, actions, className }: BulkActionBarProps) {
  const confirm = useConfirm();
  const [activatingIndex, setActivatingIndex] = React.useState<number | null>(null);

  const visible = selected.length > 0;
  const count = selected.length;

  async function handleAction(action: BulkAction, index: number) {
    if (action.requiresConfirm) {
      const label = action.confirmLabel
        ? action.confirmLabel.replace('{count}', String(count))
        : `Apply to ${count} item${count === 1 ? '' : 's'}?`;
      const confirmed = await confirm({
        title: action.label,
        description: label,
        confirmLabel: action.label,
        tone: action.variant === 'destructive' ? 'danger' : 'module',
      });
      if (!confirmed) return;
    }

    setActivatingIndex(index);
    try {
      await action.onAction(selected);
      onClear();
    } finally {
      setActivatingIndex(null);
    }
  }

  return (
    <div
      role="toolbar"
      aria-label={`Bulk actions — ${count} selected`}
      aria-hidden={!visible}
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-200 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-8 opacity-0',
        className
      )}
    >
      <Stack
        direction="row"
        align="center"
        gap={2}
        className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3 shadow-xl shadow-black/10 backdrop-blur-sm"
      >
        {/* Selection count + clear */}
        <Stack
          direction="row"
          align="center"
          gap={2}
          className="border-r border-[var(--color-border-default)] pr-2"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--module-active)] text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
          <Text size="sm" className="font-medium tabular-nums">
            selected
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label="Clear selection"
            className="h-6 px-2 text-xs"
          >
            Clear
          </Button>
        </Stack>

        {/* Actions */}
        <Stack direction="row" align="center" gap={1}>
          {actions.map((action, i) => {
            const Icon = action.icon;
            const isLoading = activatingIndex === i;
            return (
              <Button
                key={action.label}
                variant="ghost"
                size="sm"
                color={action.variant === 'destructive' ? 'danger' : undefined}
                disabled={activatingIndex !== null}
                loading={isLoading}
                leftIcon={Icon ? <Icon className="h-3.5 w-3.5" /> : undefined}
                onClick={() => void handleAction(action, i)}
              >
                {action.label}
              </Button>
            );
          })}
        </Stack>
      </Stack>
    </div>
  );
}
