'use client';

// Route tabs for the Builder governance area (docs/61 §6/§8 Phase 6b) — the two
// brand-designer surfaces: the brand-section archetype set and the utility
// allowlist. A thin link nav (navigation chrome, not a control), with the active
// tab marked by a module-colored underline.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@sparx/ui';

const TABS = [
  { href: '/builder/governance/sections', label: 'Brand sections' },
  { href: '/builder/governance', label: 'Utility allowlist' },
];

export function GovernanceTabs() {
  const pathname = usePathname();
  return (
    <nav className="border-base-300 flex gap-1 border-b" aria-label="Governance sections">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              active
                ? 'border-module text-base-content'
                : 'text-base-content hover:text-base-content border-transparent'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
