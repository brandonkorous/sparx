'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@sparx/ui';
import type { OperatorCapability } from '@sparx/operator';

// The console's primary navigation. Items are capability-gated (default-deny) —
// an operator only sees a section they can enter. Active state is an underline +
// weight/color shift (never a filled pill), so it reads as wayfinding, not a
// re-skinned control. New slices add their section here as they land.

interface NavItem {
  href: string;
  label: string;
  /** Capability required to see this item; omitted = always visible. */
  capability?: OperatorCapability;
  /** Treat `href` as a prefix so detail sub-routes keep the tab active. */
  prefix?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview' },
  { href: '/sparx/tenants', label: 'Tenants', capability: 'support:read', prefix: true },
  { href: '/sparx/metrics', label: 'Metrics', capability: 'support:read', prefix: true },
  { href: '/sparx/billing', label: 'Billing', capability: 'billing:read', prefix: true },
  { href: '/sparx/domains', label: 'Domains', capability: 'domain:manage', prefix: true },
  { href: '/sparx/support', label: 'Support', capability: 'support:read', prefix: true },
  { href: '/sparx/feedback', label: 'Feedback', capability: 'feedback:respond', prefix: true },
];

export function ConsoleNav({ capabilities }: { capabilities: OperatorCapability[] }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.capability || capabilities.includes(item.capability)
  );

  return (
    <nav className="flex items-center gap-6" aria-label="Operator console">
      {items.map((item) => {
        const active = item.prefix
          ? pathname === item.href || pathname.startsWith(`${item.href}/`)
          : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 py-3 text-sm font-medium transition-colors',
              active
                ? 'border-[var(--module-active)] text-[var(--color-text-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
