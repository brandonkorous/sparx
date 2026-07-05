'use client';

import Link from 'next/link';
import { cn, Wordmark } from '@sparx/ui';
import type { OperatorCapability } from '@sparx/operator';
import { CONSOLE_NAV_GROUPS, isNavItemActive, visibleItems } from './console-nav-items';

// The mobile drawer's nav tree (rendered by SidebarAppShell below `md`). Same
// grouped, capability-gated model as the desktop rail, but always full-width with
// labels + group headings — no collapse. The shared shell closes the drawer on
// route change.

export function ConsoleMobileNav({
  pathname,
  capabilities,
}: {
  pathname: string | null;
  capabilities: OperatorCapability[];
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Operator console">
      <div className="px-2 py-1">
        <Wordmark className="h-5 w-auto" />
      </div>
      {CONSOLE_NAV_GROUPS.map((group) => {
        const items = visibleItems(group, capabilities);
        if (items.length === 0) return null;
        return (
          <div key={group.label ?? 'overview'} className="flex flex-col gap-1">
            {group.label ? (
              <div className="px-2 pt-3 pb-0.5 text-xs font-medium tracking-wider text-[var(--color-text-tertiary)] uppercase">
                {group.label}
              </div>
            ) : null}
            {items.map((item) => {
              const active = isNavItemActive(item, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--module-active-tint)] text-[var(--module-active-text)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)]'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-4 w-4 shrink-0 items-center justify-center',
                      active ? 'text-[var(--module-active)]' : 'text-[var(--color-text-tertiary)]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate text-left">{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
