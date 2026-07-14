'use client';

import * as React from 'react';
import { Button } from '../primitives/button';
import { Text } from '../primitives/text';
import { Stack } from '../layout/stack';
import { useConfirm } from '../overlay/confirm-provider';
import { cn } from '../../utils/cn';

// BulkActionBar — docks IN-FLOW above the table/cards when 1+ rows are
// selected (the Astryx Toolbar convention: a contextual toolbar sits at the
// top of the content it acts on, visually distinct via a muted tint/border —
// never a floating pill). Destructive actions automatically gate on
// useConfirm (no external state needed). Fades in on mount, fades out then
// UNMOUNTS when the selection clears — it's a temporary, contextual bar, not
// permanent chrome, so it leaves zero footprint while idle.
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
  /**
   * Template string — use `{count}` as a placeholder for the selection count,
   * and `{count === 1 ? "singular" : "plural"}` for simple pluralization
   * (resolved by `resolveConfirmLabel` below; it is NOT a real JS template
   * literal, just a matching plain-string convention).
   */
  confirmLabel?: string;
  onAction: (ids: string[]) => Promise<void>;
}

export interface BulkActionBarProps {
  selected: string[];
  onClear: () => void;
  actions: BulkAction[];
  className?: string;
}

// Groups actions into [non-destructive, destructive] — sorted, never
// reordered within a group — so Delete-type actions always land past a
// divider at the end regardless of the order the caller declared them in.
// Each entry keeps its ORIGINAL array index for the click handler / loading
// state, since `activatingIndex` is keyed against `actions`, not the group.
// `confirmLabel` is authored as if it were a real template literal (several
// call sites write `{count === 1 ? "" : "s"}` directly in the plain string),
// but as a plain prop that syntax was never evaluated — it rendered to users
// completely verbatim, unresolved braces and all. Resolve both the count
// placeholder and that pluralization shape here, once, instead of at every
// call site.
function resolveConfirmLabel(template: string, count: number): string {
  return template
    .replace(
      /\{count === 1 \? "([^"]*)" : "([^"]*)"\}/g,
      (_match, singular: string, plural: string) => (count === 1 ? singular : plural)
    )
    .replace('{count}', String(count));
}

function orderedActions(actions: BulkAction[]): { action: BulkAction; index: number }[][] {
  const withIndex = actions.map((action, index) => ({ action, index }));
  const groups = [
    withIndex.filter((x) => x.action.variant !== 'destructive'),
    withIndex.filter((x) => x.action.variant === 'destructive'),
  ];
  return groups.filter((g) => g.length > 0);
}

export function BulkActionBar({ selected, onClear, actions, className }: BulkActionBarProps) {
  const confirm = useConfirm();
  const [activatingIndex, setActivatingIndex] = React.useState<number | null>(null);

  const active = selected.length > 0;

  // Mount only while there's a selection (plus a brief exit window so the
  // fade-out animates before unmount). `shown` flips one frame after mount so
  // the fade-in transition runs.
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
        ? resolveConfirmLabel(action.confirmLabel, count)
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
        'mb-3 transition-all duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
        className
      )}
    >
      <Stack
        direction="row"
        align="center"
        gap={2}
        // Muted module tint + border — the Astryx "make a temporary toolbar
        // visually distinct" rule — so it reads as contextual against the
        // static ListToolbar above it and the table below.
        className="bg-module bg-soft border-base-300 rounded-xl border px-4 py-2.5"
      >
        {/* Selection count + clear */}
        <Stack direction="row" align="center" gap={2} className="border-base-300 border-r pr-2">
          <span className="bg-module flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white">
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

        {/* Actions — destructive actions always sort to the end past a divider,
            regardless of the order the caller passed them in (toolbar rule:
            destructive never sits next to whatever's clicked most often). */}
        {orderedActions(actions).map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <div aria-hidden className="bg-base-300 h-5 w-px shrink-0" />}
            <Stack direction="row" align="center" gap={1}>
              {group.map(({ action, index }) => {
                const Icon = action.icon;
                const isLoading = activatingIndex === index;
                return (
                  <Button
                    key={action.label}
                    variant="ghost"
                    size="sm"
                    color={action.variant === 'destructive' ? 'danger' : undefined}
                    disabled={activatingIndex !== null}
                    loading={isLoading}
                    leftIcon={Icon ? <Icon className="h-3.5 w-3.5" /> : undefined}
                    onClick={() => void handleAction(action, index)}
                  >
                    {action.label}
                  </Button>
                );
              })}
            </Stack>
          </React.Fragment>
        ))}
      </Stack>
    </div>
  );
}
