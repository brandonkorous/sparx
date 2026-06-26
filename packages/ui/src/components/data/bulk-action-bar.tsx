'use client';

import * as React from 'react';
import { Button } from '../primitives/button';
import { Text } from '../primitives/text';
import { Stack } from '../layout/stack';
import { useConfirm } from '../overlay/confirm-provider';
import { cn } from '../../utils/cn';

// BulkActionBar — slides up from the viewport bottom when 1+ rows are
// selected. Destructive actions automatically gate on useConfirm (no external
// state needed). Slides back down + fades, then UNMOUNTS, when the selection
// is cleared.
//
// Why unmount (not just fade): a `position: fixed` bar parked off-screen still
// counts toward the document's scroll height — opacity/pointer-events only
// affect painting + hit-testing, not layout/overflow — so an idle "hidden" bar
// produces a phantom scrollbar + empty strip at the bottom of the page. The
// only durable fix is to remove it from the DOM while idle. A short
// mount→animate-in / animate-out→unmount cycle keeps both slide transitions.
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

  const active = selected.length > 0;

  // Mount only while there's a selection (plus a brief exit window so the
  // slide-out animates before unmount). A `fixed` bar kept mounted in a
  // translated "hidden" state is what expands the page's scroll height, so it
  // must leave the DOM when idle — not merely fade. `shown` flips one frame
  // after mount so the slide-in transition runs.
  const [mounted, setMounted] = React.useState(active);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (active) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), 200); // match duration-200
    return () => window.clearTimeout(timer);
  }, [active]);

  // Freeze the count through the exit so the bar never flashes "0 selected"
  // once the list clears the selection.
  const lastCount = React.useRef(selected.length);
  if (active) lastCount.current = selected.length;
  const count = active ? selected.length : lastCount.current;

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

  if (!mounted) return null;

  return (
    <div
      role="toolbar"
      aria-label={`Bulk actions — ${count} selected`}
      aria-hidden={!shown}
      className={cn(
        'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
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
