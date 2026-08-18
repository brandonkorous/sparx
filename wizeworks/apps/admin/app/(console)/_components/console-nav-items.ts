import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CreditCard,
  Globe,
  GraduationCap,
  Handshake,
  Home,
  LayoutGrid,
  LifeBuoy,
  MessageSquare,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { OperatorCapability } from '@wizeworks/operator';

// The operator console's navigation model — a GROUPED, capability-gated tree
// shared by the desktop rail and the mobile drawer (docs/apps/admin/build-plan.md).
// Grouping is what a growing platform needs that flat top-tabs can't give: as the
// console accretes sections (tenants, growth, money, support, infra, and the
// later cross-product areas), related destinations stay legible under a heading
// instead of overflowing a single row. Each item is default-deny: an operator
// only sees a section they hold the capability for, and an all-hidden group drops
// out entirely.

export interface ConsoleNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Capability required to see this item; omitted = always visible. */
  capability?: OperatorCapability;
  /** Treat `href` as a prefix so detail sub-routes keep the item active. */
  prefix?: boolean;
}

export interface ConsoleNavGroup {
  /** Section heading (shown in the expanded rail + mobile drawer). `null` = the
   *  ungrouped top cluster (Overview). */
  label: string | null;
  items: ConsoleNavItem[];
}

export const CONSOLE_NAV_GROUPS: ConsoleNavGroup[] = [
  {
    label: null,
    items: [{ href: '/', label: 'Overview', icon: Home }],
  },
  {
    label: 'Accounts',
    items: [
      {
        href: '/sparx/tenants',
        label: 'Tenants',
        icon: Building2,
        capability: 'support:read',
        prefix: true,
      },
      {
        href: '/sparx/users',
        label: 'Users',
        icon: Users,
        capability: 'user:read',
        prefix: true,
      },
      {
        href: '/sparx/sites',
        label: 'Sites',
        icon: LayoutGrid,
        capability: 'site:read',
        prefix: true,
      },
    ],
  },
  {
    label: 'Growth',
    items: [
      {
        href: '/sparx/metrics',
        label: 'Metrics',
        icon: TrendingUp,
        capability: 'support:read',
        prefix: true,
      },
      {
        href: '/sparx/partners',
        label: 'Partners',
        icon: Handshake,
        capability: 'partner:read',
        prefix: true,
      },
      {
        href: '/sparx/bootcamps',
        label: 'Bootcamps',
        icon: GraduationCap,
        capability: 'partner:read',
        prefix: true,
      },
    ],
  },
  {
    label: 'Money',
    items: [
      {
        href: '/sparx/billing',
        label: 'Billing',
        icon: CreditCard,
        capability: 'billing:read',
        prefix: true,
      },
    ],
  },
  {
    label: 'Support',
    items: [
      {
        href: '/sparx/support',
        label: 'Support',
        icon: LifeBuoy,
        capability: 'support:read',
        prefix: true,
      },
      {
        href: '/sparx/feedback',
        label: 'Feedback',
        icon: MessageSquare,
        capability: 'feedback:respond',
        prefix: true,
      },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      {
        href: '/sparx/domains',
        label: 'Domains',
        icon: Globe,
        capability: 'domain:manage',
        prefix: true,
      },
    ],
  },
];

/** Filter a group's items to those the operator can see; used by both navs. */
export function visibleItems(
  group: ConsoleNavGroup,
  capabilities: readonly OperatorCapability[]
): ConsoleNavItem[] {
  return group.items.filter((i) => !i.capability || capabilities.includes(i.capability));
}

/** Whether a nav href is active for the current pathname (exact, or prefix match
 *  for sections with detail sub-routes). Overview (`/`) is exact-only. */
export function isNavItemActive(item: ConsoleNavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  if (item.href === '/') return pathname === '/';
  if (item.prefix) return pathname === item.href || pathname.startsWith(`${item.href}/`);
  return pathname === item.href;
}
