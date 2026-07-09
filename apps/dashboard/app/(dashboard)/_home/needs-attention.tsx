import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn, colorVars } from '@sparx/ui';

import { Icon } from './icons';
import type { ActionItem, ActionSeverity } from './types';

// "Needs attention" — rendered above the KPIs, collapsed entirely when clean.
// Each item is a soft semantic callout (danger/warning/info) that deep-links
// straight to where it's fixed. The tone color is set once as a per-item
// `--sx-sel` custom property (silicaui color token) and the soft fill / border /
// ink are color-mixes off it — never a hand-mixed hue.

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
          style={{ ['--sx-sel']: colorVars(TONE[it.severity]).sel } as CSSProperties}
          className={cn(
            'group flex items-center gap-3 rounded-lg border px-3 py-2',
            'border-[color-mix(in_oklab,var(--sx-sel)_25%,transparent)] bg-[color-mix(in_oklab,var(--sx-sel)_15%,transparent)] text-[var(--sx-sel)]',
            'transition-colors hover:border-[var(--sx-sel)]'
          )}
        >
          <span className="text-[var(--sx-sel)]">
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
