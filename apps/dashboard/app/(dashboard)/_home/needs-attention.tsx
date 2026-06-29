import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn, colorClass } from '@sparx/ui';

import { Icon } from './icons';
import type { ActionItem, ActionSeverity } from './types';

// "Needs attention" — rendered above the KPIs, collapsed entirely when clean.
// Each item is a soft semantic callout (danger/warning/info) that deep-links
// straight to where it's fixed. Colored via the shared role-var recipe
// (colorClass), the same one Badge/Alert use — never a hand-mixed hue.

const TONE: Record<ActionSeverity, string> = {
  danger: 'danger',
  warning: 'warning',
  info: 'info',
};

export function NeedsAttention({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Needs attention">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          className={cn(
            colorClass(TONE[it.severity]),
            'group flex items-center gap-3 rounded-lg border px-3 py-2',
            'border-[color-mix(in_oklab,var(--c-bg)_25%,transparent)] bg-[var(--c-tint)] text-[var(--c-ink)]',
            'transition-colors hover:border-[var(--c-bg)]'
          )}
        >
          <span className="text-[var(--c-bg)]">
            <Icon name={it.icon} className="h-4 w-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-medium">{it.title}</span>
            {it.hint && <span className="text-xs opacity-80">{it.hint}</span>}
          </span>
          <ChevronRight className="h-4 w-4 opacity-40 transition-opacity group-hover:opacity-80" />
        </Link>
      ))}
    </div>
  );
}
